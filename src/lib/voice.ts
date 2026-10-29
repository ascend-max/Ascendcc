import type { LipSyncEvent, MouthPose } from '../types';
import { mouthFromEnergy } from './characters';
import { clamp } from './time';

/* ------------------------------------------------------------------ */
/* Web Audio context                                                   */
/* ------------------------------------------------------------------ */

let sharedContext: AudioContext | null = null;

export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) {
    sharedContext = new Ctor();
  }
  return sharedContext;
}

export async function resumeAudio(): Promise<void> {
  const ctx = audioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* user gesture may still be pending */
    }
  }
}

export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const ctx = audioContext();
  if (!ctx) throw new Error('This browser does not support the Web Audio API, so audio cannot be analysed.');
  const buffer = await blob.arrayBuffer();
  // decodeAudioData detaches the ArrayBuffer in some browsers, so pass a copy.
  return ctx.decodeAudioData(buffer.slice(0));
}

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */

export interface VoiceAnalysis {
  duration: number;
  peaks: number[];
  peakLevel: number;
  rms: number;
}

export function computePeaks(buffer: AudioBuffer, buckets = 320): number[] {
  const channel = buffer.getChannelData(0);
  const bucketSize = Math.max(1, Math.floor(channel.length / buckets));
  const peaks: number[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const start = i * bucketSize;
    const end = Math.min(channel.length, start + bucketSize);
    let max = 0;
    for (let j = start; j < end; j += 1) {
      const value = Math.abs(channel[j]);
      if (value > max) max = value;
    }
    peaks.push(max);
  }
  return peaks;
}

export function analyzeBuffer(buffer: AudioBuffer): VoiceAnalysis {
  const channel = buffer.getChannelData(0);
  let peak = 0;
  let sumSquares = 0;
  for (let i = 0; i < channel.length; i += 1) {
    const value = Math.abs(channel[i]);
    if (value > peak) peak = value;
    sumSquares += channel[i] * channel[i];
  }
  return {
    duration: buffer.duration,
    peaks: computePeaks(buffer),
    peakLevel: peak,
    rms: Math.sqrt(sumSquares / Math.max(1, channel.length)),
  };
}

/* ------------------------------------------------------------------ */
/* Silence trimming                                                    */
/* ------------------------------------------------------------------ */

export interface SilenceBounds {
  startSec: number;
  endSec: number;
}

/** Find audible bounds using a small RMS window and a quiet threshold. */
export function silenceBounds(buffer: AudioBuffer, threshold = 0.008, paddingSec = 0.08): SilenceBounds {
  const channel = buffer.getChannelData(0);
  const windowSize = Math.max(1, Math.floor(buffer.sampleRate * 0.02));
  let first = -1;
  let last = -1;
  for (let start = 0; start < channel.length; start += windowSize) {
    const end = Math.min(channel.length, start + windowSize);
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += channel[i] * channel[i];
    const rms = Math.sqrt(sum / (end - start));
    if (rms > threshold) {
      if (first < 0) first = start;
      last = end;
    }
  }
  if (first < 0) return { startSec: 0, endSec: buffer.duration };
  return {
    startSec: Math.max(0, first / buffer.sampleRate - paddingSec),
    endSec: Math.min(buffer.duration, last / buffer.sampleRate + paddingSec),
  };
}

export function sliceBuffer(buffer: AudioBuffer, startSec: number, endSec: number): AudioBuffer {
  const ctx = audioContext();
  if (!ctx) throw new Error('Web Audio is unavailable.');
  const start = Math.max(0, Math.floor(startSec * buffer.sampleRate));
  const end = Math.min(buffer.length, Math.floor(endSec * buffer.sampleRate));
  const length = Math.max(1, end - start);
  const output = ctx.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const source = buffer.getChannelData(channel);
    output.getChannelData(channel).set(source.subarray(start, start + length));
  }
  return output;
}

/* ------------------------------------------------------------------ */
/* Processing chain                                                    */
/* ------------------------------------------------------------------ */

export interface ProcessOptions {
  trimSilence: boolean;
  highpass: boolean;
  compressor: boolean;
  normalize: boolean;
  targetPeak?: number;
}

export interface ProcessResult {
  buffer: AudioBuffer;
  trimmedStart: number;
  trimmedEnd: number;
  applied: string[];
}

/**
 * Real offline processing: trim → high-pass → gentle compression → peak
 * normalisation. The returned buffer is what the app plays and exports; nothing
 * is only cosmetic.
 */
export async function processVoice(buffer: AudioBuffer, options: ProcessOptions): Promise<ProcessResult> {
  const ctx = audioContext();
  if (!ctx) throw new Error('Web Audio is unavailable in this browser.');
  const applied: string[] = [];

  let source = buffer;
  let trimmedStart = 0;
  let trimmedEnd = buffer.duration;
  if (options.trimSilence) {
    const bounds = silenceBounds(buffer);
    trimmedStart = bounds.startSec;
    trimmedEnd = bounds.endSec;
    if (bounds.endSec - bounds.startSec > 0.2) {
      source = sliceBuffer(buffer, bounds.startSec, bounds.endSec);
      applied.push('Silence trimmed');
    }
  }

  const gainValue = options.normalize
    ? clamp((options.targetPeak ?? 0.89) / Math.max(0.001, analyzeBuffer(source).peakLevel), 0.2, 8)
    : 1;
  if (options.normalize) applied.push('Peak normalised');

  const OfflineCtor = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!OfflineCtor) {
    // Without an offline context we can still return the trimmed buffer honestly.
    return {
      buffer: source,
      trimmedStart,
      trimmedEnd,
      applied: applied.length ? applied : ['No processing available'],
    };
  }

  const offline = new OfflineCtor(source.numberOfChannels, source.length, source.sampleRate);
  const node = offline.createBufferSource();
  node.buffer = source;
  let tail: AudioNode = node;

  if (options.highpass) {
    const highpass = offline.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 85;
    highpass.Q.value = 0.7;
    tail.connect(highpass);
    tail = highpass;
    applied.push('High-pass at 85 Hz');
  }

  if (options.compressor) {
    const compressor = offline.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    tail.connect(compressor);
    tail = compressor;
    applied.push('Gentle compression');
  }

  const gain = offline.createGain();
  gain.gain.value = gainValue;
  tail.connect(gain);
  gain.connect(offline.destination);
  node.start(0);

  const rendered = await offline.startRendering();
  return { buffer: rendered, trimmedStart, trimmedEnd, applied };
}

/* ------------------------------------------------------------------ */
/* WAV export                                                          */
/* ------------------------------------------------------------------ */

export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const dataBytes = frames * channels * 2;
  const out = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(out);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataBytes, true);

  const channelData: Float32Array[] = [];
  for (let channel = 0; channel < channels; channel += 1) {
    channelData.push(buffer.getChannelData(channel));
  }

  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([out], { type: 'audio/wav' });
}

/* ------------------------------------------------------------------ */
/* Lip sync (amplitude based)                                          */
/* ------------------------------------------------------------------ */

/**
 * Derive mouth shapes from loudness. This is amplitude driven, NOT phonetic
 * lip-sync: it gives believable movement for a stylised cartoon without
 * misrepresenting accuracy. The Voice Studio labels it that way.
 */
export function lipSyncFromBuffer(
  buffer: AudioBuffer,
  options: { windowSec?: number; minHoldSec?: number; offsetSec?: number } = {},
): LipSyncEvent[] {
  const windowSec = options.windowSec ?? 0.05;
  const minHold = options.minHoldSec ?? 0.09;
  const offset = options.offsetSec ?? 0;
  const channel = buffer.getChannelData(0);
  const windowSize = Math.max(1, Math.floor(buffer.sampleRate * windowSec));
  const events: LipSyncEvent[] = [];
  let lastPose: MouthPose | null = null;
  let lastTime = -Infinity;

  for (let start = 0; start < channel.length; start += windowSize) {
    const end = Math.min(channel.length, start + windowSize);
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += channel[i] * channel[i];
    const rms = Math.sqrt(sum / (end - start));
    const pose = mouthFromEnergy(rms * 4);
    const time = offset + start / buffer.sampleRate;
    if (pose === lastPose) continue;
    if (time - lastTime < minHold) continue;
    events.push({ t: Math.round(time * 100) / 100, pose });
    lastPose = pose;
    lastTime = time;
  }

  return events;
}

export function mouthAtEvents(events: LipSyncEvent[], t: number, fallback: MouthPose = 'closed'): MouthPose {
  let pose = fallback;
  for (const event of events) {
    if (event.t > t) break;
    pose = event.pose;
  }
  return pose;
}

/** Fit a voice-over to a scene: warns when the recording is longer than the shot. */
export function recordingFit(recordingDuration: number, sceneDuration: number): {
  status: 'fits' | 'tight' | 'over';
  message: string;
} {
  if (recordingDuration > sceneDuration + 0.15) {
    return {
      status: 'over',
      message: `Recording is ${(recordingDuration - sceneDuration).toFixed(1)}s longer than this scene. Extend the scene or trim the take — do not speed up the audio.`,
    };
  }
  if (recordingDuration > sceneDuration - 0.3) {
    return { status: 'tight', message: 'Recording nearly fills the scene. Leave a little air at the end.' };
  }
  return { status: 'fits', message: 'Recording fits this scene with room to breathe.' };
}
