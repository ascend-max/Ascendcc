import type { CaptionGroup, CaptionWord, Project } from '../types';
import { uid } from './id';
import { clamp } from './time';

const NUMBER_LIKE = /[0-9$%]/;

/**
 * Decide which words deserve emphasis. Deliberately conservative — highlighting
 * every word is the fastest way to make captions unreadable.
 */
export function markWords(text: string): CaptionWord[] {
  const raw = text
    .replace(/\*+/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!raw.length) return [];

  const words: CaptionWord[] = raw.map((word) => ({
    text: word,
    emphasis: false,
    }));

  const candidates = words
    .map((word, index) => ({ index, word }))
    .filter(({ word }) => NUMBER_LIKE.test(word.text) || /^[A-Z]{3,}[,.]?$/.test(word.text));

  if (candidates.length) {
    candidates.slice(0, 1).forEach(({ index }) => {
      words[index].emphasis = true;
    });
  } else {
    // Fall back to the longest meaningful word (ignoring tiny joining words).
    let best = -1;
    let bestLength = 0;
    words.forEach((word, index) => {
      const clean = word.text.replace(/[^A-Za-z'-]/g, '');
      if (clean.length > bestLength && clean.length > 3) {
        bestLength = clean.length;
        best = index;
      }
    });
    if (best >= 0) words[best].emphasis = true;
  }

  return words;
}

export interface GroupOptions {
  maxWords?: number;
  minWords?: number;
  wordsPerSecond?: number;
  startOffset?: number;
  /** Real measured duration of the narration; when provided, timing is scaled to it. */
  measuredDuration?: number;
}

/**
 * Turn free narration into 2–5 word caption groups.
 *
 * Timing is distributed by word length across the available duration. When the
 * narration has no measured audio duration this is an ESTIMATE and the groups
 * are flagged as such everywhere they are shown or exported.
 */
export function buildCaptionGroups(text: string, options: GroupOptions = {}): CaptionGroup[] {
  const maxWords = options.maxWords ?? 4;
  const minWords = options.minWords ?? 2;
  const wordsPerSecond = options.wordsPerSecond ?? 2.6;
  const startOffset = options.startOffset ?? 0;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const words = markWords(clean);
  const chunks: CaptionWord[][] = [];
  let current: CaptionWord[] = [];

  const sentenceEnds = new Set<number>();
  let running = 0;
  text
    .trim()
    .split(/\s+/)
    .forEach((word, index) => {
      running += 1;
      if (/[.!?]$/.test(word) || /[,;:]$/.test(word)) sentenceEnds.add(index);
    });

  words.forEach((word, index) => {
    current.push(word);
    const atSentenceEnd = sentenceEnds.has(index);
    if (current.length >= maxWords || (atSentenceEnd && current.length >= minWords)) {
      chunks.push(current);
      current = [];
    }
  });
  if (current.length) {
    if (current.length === 1 && chunks.length) {
      // Avoid orphan single words by merging into the previous group when it has room.
      const prev = chunks[chunks.length - 1];
      if (prev.length < maxWords + 1) prev.push(...current);
      else chunks.push(current);
    } else {
      chunks.push(current);
    }
  }

  const totalChars = words.reduce((sum, word) => sum + word.text.length + 1, 0);
  const estimatedTotal = totalChars / (wordsPerSecond * 6);
  const totalDuration = options.measuredDuration && options.measuredDuration > 0
    ? options.measuredDuration
    : estimatedTotal;
  const estimated = !(options.measuredDuration && options.measuredDuration > 0);

  let cursor = startOffset;
  return chunks.map((chunk) => {
    const chars = chunk.reduce((sum, word) => sum + word.text.length + 1, 0);
    const share = totalChars > 0 ? chars / totalChars : 0;
    const duration = Math.max(0.5, totalDuration * share);
    const start = cursor;
    cursor += duration;
    return {
      id: uid('cap'),
      words: chunk,
      start,
      end: cursor,
      estimated,
    };
  });
}

export interface FlatCaption {
  words: CaptionWord[];
  /** Absolute seconds on the project timeline. */
  start: number;
  end: number;
  estimated: boolean;
  sceneId: string;
}

/** Project captions flattened to absolute timeline positions (for preview + SRT). */
export function flattenCaptions(project: Project): FlatCaption[] {
  const out: FlatCaption[] = [];
  project.scenes.forEach((scene) => {
    scene.captions.forEach((group) => {
      out.push({
        words: group.words,
        start: scene.start + group.start,
        end: scene.start + group.end,
        estimated: group.estimated,
        sceneId: scene.id,
      });
    });
  });
  return out.sort((a, b) => a.start - b.start);
}

export function captionText(group: { words: CaptionWord[] }): string {
  return group.words.map((word) => word.text).join(' ');
}

function srtTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Build an SRT file. Emphasis is preserved as uppercase because SRT has no
 * styling contract that every player honours.
 */
export function buildSrt(project: Project): string {
  const captions = flattenCaptions(project);
  return captions
    .map((caption, index) => {
      const text = caption.words
        .map((word) => (word.emphasis ? word.text.toUpperCase() : word.text))
        .join(' ');
      return `${index + 1}\n${srtTime(caption.start)} --> ${srtTime(caption.end)}\n${text}\n`;
    })
    .join('\n');
}

/** Re-time an existing caption group (used by the manual caption editor). */
export function retimeGroup(
  group: CaptionGroup,
  start: number,
  end: number,
): CaptionGroup {
  const sceneSafeStart = Math.max(0, start);
  return {
    ...group,
    start: sceneSafeStart,
    end: Math.max(sceneSafeStart + 0.3, end),
    estimated: false,
  };
}

/** Find the caption group visible at a scene-relative time. */
export function activeCaption(groups: CaptionGroup[], t: number): CaptionGroup | undefined {
  return groups.find((group) => t >= group.start && t < group.end);
}

export function captionProgress(group: CaptionGroup, t: number): number {
  if (group.end <= group.start) return 1;
  return clamp((t - group.start) / (group.end - group.start), 0, 1);
}
