import type { AudioTrack, Project } from '../types';
import { getBlob } from './storage';
import { audioContext, decodeAudioBlob, resumeAudio } from './voice';

/**
 * Real Web Audio playback for the timeline.
 *
 * Tracks are scheduled sample-accurately against the AudioContext clock, which
 * is what makes caption and lip-sync previews honest. Decoded buffers are cached
 * per asset id for the session.
 */
export class TimelineAudio {
  private buffers = new Map<string, AudioBuffer>();
  private sources: AudioBufferSourceNode[] = [];
  private master: GainNode | null = null;
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    const ctx = audioContext();
    if (ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
    }
  }

  /** Decode and cache one asset. Returns undefined when the blob is missing. */
  async load(assetId: string, blobId: string | undefined): Promise<AudioBuffer | undefined> {
    if (!assetId || !blobId) return undefined;
    const cached = this.buffers.get(assetId);
    if (cached) return cached;
    const blob = await getBlob(blobId);
    if (!blob) return undefined;
    try {
      const buffer = await decodeAudioBlob(blob);
      this.buffers.set(assetId, buffer);
      return buffer;
    } catch (error) {
      console.warn('Could not decode audio for playback', assetId, error);
      return undefined;
    }
  }

  async preload(project: Project, assets: { id: string; blobId?: string }[]): Promise<void> {
    const ids = new Set(project.audioTracks.map((track) => track.assetId).filter(Boolean));
    await Promise.all(
      Array.from(ids).map((id) => this.load(id, assets.find((asset) => asset.id === id)?.blobId)),
    );
  }

  hasBuffer(assetId: string): boolean {
    return this.buffers.has(assetId);
  }

  /** Schedule every track that is still audible from `fromTime` onward. */
  play(tracks: AudioTrack[], fromTime: number): void {
    const ctx = audioContext();
    if (!ctx) return;
    void resumeAudio();
    this.stop();
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(ctx.destination);
    }

    const start = ctx.currentTime + 0.06;
    for (const track of tracks) {
      const buffer = this.buffers.get(track.assetId);
      if (!buffer) continue;
      const trackStart = Math.max(0, track.startTime);
      const trackEnd = trackStart + buffer.duration;
      if (trackEnd <= fromTime) continue;

      const offset = Math.max(0, fromTime - trackStart);
      const when = start + Math.max(0, trackStart - fromTime);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(2, track.gain));
      source.connect(gain);
      gain.connect(this.master);
      source.start(when, offset);
      this.sources.push(source);
    }
  }

  stop(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
    }
    this.sources = [];
  }

  /** Duration of one asset's audio, if loaded. */
  duration(assetId: string): number {
    return this.buffers.get(assetId)?.duration ?? 0;
  }

  clearCache(): void {
    this.stop();
    this.buffers.clear();
  }
}

export const timelineAudio = new TimelineAudio();
