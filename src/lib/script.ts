import type { Project, Script, ScriptVariation } from '../types';
import { uid } from './id';

/** Average spoken pace for calm short-form narration (words per second). */
export const NARRATION_WORDS_PER_SECOND = 2.5;

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * Estimate how long narration takes to speak. This is an estimate from word
 * count only — never present it as a measured recording duration.
 */
export function estimateNarrationSeconds(text: string, wps = NARRATION_WORDS_PER_SECOND): number {
  const words = countWords(text);
  if (!words) return 0;
  // A short breath/pause allowance per sentence keeps estimates realistic.
  const sentences = Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
  return Math.round(((words / wps) + sentences * 0.25) * 10) / 10;
}

export function estimateAllNarrationSeconds(project: Project): number {
  return project.scenes.reduce((sum, scene) => sum + estimateNarrationSeconds(scene.voiceOver), 0);
}

export function emptyScript(): Script {
  return {
    title: '',
    hook: '',
    narration: '',
    cta: '',
    emphasis: '',
    factCheckNotes: '',
    variations: [],
    outline: [],
  };
}

export function createVariation(label: string): ScriptVariation {
  return { id: uid('var'), label, hook: '', body: '', cta: '' };
}

/** Split a script into scenes at blank lines, so a pasted script can become a storyboard. */
export function splitScriptIntoBeats(narration: string): string[] {
  return narration
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

/** Honest pacing audit: compares spoken estimate against the timeline length. */
export function pacingAudit(project: Project): {
  spokenSeconds: number;
  timelineSeconds: number;
  status: 'fits' | 'tight' | 'over';
  advice: string;
} {
  const spokenSeconds = estimateAllNarrationSeconds(project);
  const timelineSeconds = project.scenes.reduce((sum, s) => sum + s.duration, 0);
  const ratio = timelineSeconds > 0 ? spokenSeconds / timelineSeconds : 1;
  if (ratio <= 0.9) {
    return {
      spokenSeconds,
      timelineSeconds,
      status: 'fits',
      advice: 'The narration fits inside the timeline with room for pauses.',
    };
  }
  if (ratio <= 1.05) {
    return {
      spokenSeconds,
      timelineSeconds,
      status: 'tight',
      advice: 'Very tight. Trim a sentence or add a second to the longest scene.',
    };
  }
  return {
    spokenSeconds,
    timelineSeconds,
    status: 'over',
    advice: 'Narration is longer than the timeline. Cut words or extend scenes — do not speed up the recording.',
  };
}
