import type { Asset, Character, Project, Settings } from '../types';
import { buildSrt } from './captions';
import { drawProjectFrame, frameSize } from '../render/draw';
import { resolvedAudioTracks, timelineDuration } from './sequence';
import { downloadBlob, getBlob } from './storage';
import { audioContext, decodeAudioBlob, resumeAudio } from './voice';
import { formatTimecode } from './time';

/* ------------------------------------------------------------------ */
/* Capability reporting                                                */
/* ------------------------------------------------------------------ */

export interface WebmSupport {
  supported: boolean;
  mimeType: string;
  reason: string;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export function checkWebmSupport(): WebmSupport {
  if (typeof window === 'undefined') {
    return { supported: false, mimeType: '', reason: 'Video export needs a browser.' };
  }
  if (typeof MediaRecorder === 'undefined') {
    return { supported: false, mimeType: '', reason: 'This browser has no MediaRecorder, so canvas video cannot be captured.' };
  }
  const mimeType = pickMimeType();
  if (!mimeType) {
    return {
      supported: false,
      mimeType: '',
      reason: 'This browser cannot record WebM from a canvas. Chrome, Edge or Firefox on desktop/Android is required.',
    };
  }
  return { supported: true, mimeType, reason: `Records real-time WebM (${mimeType}). MP4 is not produced by this build.` };
}

/* ------------------------------------------------------------------ */
/* Frame export                                                        */
/* ------------------------------------------------------------------ */

export interface FrameExportOptions {
  project: Project;
  characters: Character[];
  settings: Settings;
  images: Map<string, HTMLImageElement>;
  time: number;
}

export function renderFrameToCanvas(options: FrameExportOptions): HTMLCanvasElement {
  const { width, height } = frameSize(options.project);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.');
  drawProjectFrame({
    ctx,
    width,
    height,
    project: options.project,
    images: options.images,
    characters: options.characters,
    settings: options.settings,
    time: options.time,
  });
  return canvas;
}

export async function exportFramePng(options: FrameExportOptions): Promise<Blob> {
  const canvas = renderFrameToCanvas(options);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode the PNG frame.'));
    }, 'image/png');
  });
}

/* ------------------------------------------------------------------ */
/* WebM export (real-time canvas + Web Audio capture)                  */
/* ------------------------------------------------------------------ */

export interface VideoExportOptions {
  project: Project;
  characters: Character[];
  settings: Settings;
  images: Map<string, HTMLImageElement>;
  assets: Asset[];
  onProgress?: (progress: number, message: string) => void;
}

export interface VideoExportResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  audioIncluded: boolean;
}

/**
 * Records the real rendered timeline, including decoded voice-over tracks, to
 * WebM using MediaRecorder. This is a real capture, not a simulation: the canvas
 * and audio graph are recorded in real time, so a 45s video takes ~45s.
 */
export async function exportWebM(options: VideoExportOptions): Promise<VideoExportResult> {
  const support = checkWebmSupport();
  if (!support.supported) throw new Error(support.reason);

  const { project } = options;
  const duration = timelineDuration(project);
  if (duration <= 0) throw new Error('Add at least one scene before exporting.');

  const { width, height } = frameSize(project);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable.');

  drawProjectFrame({
    ctx,
    width,
    height,
    project,
    images: options.images,
    characters: options.characters,
    settings: options.settings,
    time: 0,
  });

  const stream = canvas.captureStream(30);
  const audio = audioContext();
  const started: AudioBufferSourceNode[] = [];
  let audioIncluded = false;

  if (audio) {
    await resumeAudio();
    const destination = audio.createMediaStreamDestination();
    for (const track of resolvedAudioTracks(project)) {
      const asset = options.assets.find((item) => item.id === track.assetId);
      if (!asset?.blobId) continue;
      const blob = await getBlob(asset.blobId);
      if (!blob) continue;
      try {
        const buffer = await decodeAudioBlob(blob);
        const source = audio.createBufferSource();
        source.buffer = buffer;
        const gain = audio.createGain();
        gain.gain.value = Math.max(0, Math.min(2, track.gain));
        source.connect(gain);
        gain.connect(destination);
        source.start(audio.currentTime + 0.2 + Math.max(0, track.startTime));
        started.push(source);
        audioIncluded = true;
      } catch (error) {
        console.warn('Skipped an audio track that could not be decoded.', error);
      }
    }
    if (audioIncluded) {
      destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    }
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: support.mimeType,
    videoBitsPerSecond: 6_000_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: support.mimeType }));
    recorder.onerror = () => reject(new Error('The recorder stopped with an error.'));
  });

  recorder.start(250);
  options.onProgress?.(0, 'Preparing audio…');

  // Allow audio scheduling to start before the frame clock so both line up.
  await new Promise((resolve) => window.setTimeout(resolve, 220));

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const step = () => {
      const elapsed = (performance.now() - start) / 1000;
      const time = Math.min(elapsed, duration);
      drawProjectFrame({
        ctx,
        width,
        height,
        project,
        images: options.images,
        characters: options.characters,
        settings: options.settings,
        time,
      });
      options.onProgress?.(Math.min(1, elapsed / duration), `Recording ${formatTimecode(time)} of ${formatTimecode(duration)}`);
      if (elapsed >= duration) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  recorder.stop();
  started.forEach((source) => {
    try {
      source.stop();
    } catch {
      /* already finished */
    }
  });
  stream.getTracks().forEach((track) => track.stop());

  const blob = await finished;
  if (!blob.size) throw new Error('The recorder returned an empty file. Try a shorter timeline.');
  options.onProgress?.(1, 'Export complete');
  return { blob, mimeType: support.mimeType, durationSec: duration, audioIncluded };
}

export async function exportProjectVideo(options: VideoExportOptions & { filename: string }): Promise<VideoExportResult> {
  const result = await exportWebM(options);
  downloadBlob(options.filename, result.blob);
  return result;
}

/* ------------------------------------------------------------------ */
/* Text deliverables                                                   */
/* ------------------------------------------------------------------ */

export function downloadSrt(project: Project): void {
  const srt = buildSrt(project);
  if (!srt.trim()) throw new Error('No captions yet. Generate caption groups in Storyboard Studio first.');
  downloadBlob(`${safeName(project.name)}.srt`, new Blob([srt], { type: 'text/plain;charset=utf-8' }));
}

export function safeName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'ascendcc-project'
  );
}

export function storyboardCsv(project: Project): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = ['Time', 'Voice-over', 'On-screen text', 'Visual + animation direction', 'Sound', 'Transition'];
  const rows = project.scenes.map((scene) => [
    `${formatTimecode(scene.start)}–${formatTimecode(scene.end)} (${scene.duration.toFixed(1)}s)`,
    scene.voiceOver,
    scene.onScreenText,
    `${scene.visual} ${scene.motion}`.trim(),
    `${scene.sfx} ${scene.music}`.trim(),
    `${scene.transition} ${scene.transitionDuration.toFixed(1)}s`,
  ]);
  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}

export function productionPackageMarkdown(project: Project): string {
  const lines: string[] = [];
  lines.push(`# ${project.name}`);
  lines.push('');
  lines.push(project.script.hook ? `**Hook:** ${project.script.hook}` : '_No hook written yet._');
  lines.push('');
  lines.push(`- Topic: ${project.topic || '—'}`);
  lines.push(`- Audience: ${project.audience || '—'}`);
  lines.push(`- Platform: ${project.platform} · ${project.orientation} · ${project.durationSec}s target`);
  lines.push(`- Mode: ${project.contentMode}`);
  lines.push(`- Research status: ${project.researchStatus}`);
  lines.push('');
  lines.push('## Storyboard');
  lines.push('');
  lines.push('| Time | Voice-over | On-screen text | Visual + motion | Sound |');
  lines.push('| --- | --- | --- | --- | --- |');
  project.scenes.forEach((scene) => {
    const time = `${formatTimecode(scene.start)}–${formatTimecode(scene.end)}`;
    const visual = `${scene.visual} ${scene.motion}`.replace(/\|/g, '/');
    const sound = `${scene.sfx} ${scene.music}`.replace(/\|/g, '/');
    lines.push(
      `| ${time} | ${scene.voiceOver.replace(/\|/g, '/')} | ${scene.onScreenText.replace(/\|/g, '/')} | ${visual} | ${sound} |`,
    );
  });
  lines.push('');
  lines.push('## Deliverables');
  lines.push('');
  if (project.script.title) lines.push(`- Title: ${project.script.title}`);
  if (project.package.titles.length) lines.push(`- Title options: ${project.package.titles.join(' / ')}`);
  if (project.package.hooks.length) {
    lines.push('- Alternate hooks:');
    project.package.hooks.forEach((hook) => lines.push(`  - ${hook}`));
  }
  if (project.package.caption) lines.push(`- Caption: ${project.package.caption}`);
  if (project.package.hashtags.length) lines.push(`- Hashtags: ${project.package.hashtags.join(' ')}`);
  if (project.package.thumbnailText) lines.push(`- Thumbnail text: ${project.package.thumbnailText}`);
  if (project.package.assetList) lines.push(`- Asset list: ${project.package.assetList}`);
  if (project.salesPlan.audience) {
    lines.push('');
    lines.push('## Sales plan');
    lines.push('');
    lines.push(`- Audience: ${project.salesPlan.audience}`);
    lines.push(`- Problem: ${project.salesPlan.problem}`);
    lines.push(`- Outcome: ${project.salesPlan.outcome}`);
    lines.push(`- Offer: ${project.salesPlan.offer} ${project.salesPlan.price ? `(${project.salesPlan.price})` : ''}`);
    lines.push(`- Desired action: ${project.salesPlan.desiredAction}`);
    lines.push(`- Awareness: ${project.salesPlan.awarenessLevel}`);
  }
  if (project.claims.length || project.sources.length) {
    lines.push('');
    lines.push('## Claims and sources');
    lines.push('');
    project.claims.forEach((claim) => {
      const sources = claim.sourceIds
        .map((id) => project.sources.find((source) => source.id === id))
        .filter(Boolean)
        .map((source) => source?.url || source?.title)
        .join(', ');
      lines.push(`- [${claim.status}] ${claim.text}${sources ? ` — sources: ${sources}` : ''}`);
    });
    project.sources.forEach((source) => {
      lines.push(`- Source: ${source.title}${source.publisher ? ` (${source.publisher})` : ''} ${source.url}`);
    });
  }
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  const verifyScenes = project.scenes.filter((scene) => /\[VERIFY\]/i.test(scene.voiceOver));
  if (verifyScenes.length) {
    lines.push(`${verifyScenes.length} scene(s) contain [VERIFY] slots. AscendCC did not research or verify these facts.`);
    verifyScenes.forEach((scene) => lines.push(`- Scene ${project.scenes.indexOf(scene) + 1} (${scene.title})`));
  } else {
    lines.push('No [VERIFY] markers remain. Confirm every figure and quote against a primary source before publishing.');
  }
  lines.push('');
  lines.push('_Generated by AscendCC. Caption timings marked estimated are word-count estimates, not measured speech._');
  return lines.join('\n');
}
