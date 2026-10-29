import type { AudioTrack, Project, Scene } from '../types';
import { round } from './time';

/**
 * Scene start/end times are derived from durations so the storyboard can never
 * disagree with the timeline. `duration` remains the editable source of truth.
 */
export function sequenceScenes(scenes: Scene[]): Scene[] {
  let cursor = 0;
  return scenes.map((scene) => {
    const duration = Math.max(0.2, round(scene.duration, 2));
    const start = round(cursor, 2);
    cursor += duration;
    return { ...scene, duration, start, end: round(cursor, 2) };
  });
}

export function timelineDuration(project: Project): number {
  return round(
    project.scenes.reduce((sum, scene) => sum + scene.duration, 0),
    2,
  );
}

/** Scale every scene duration so the timeline matches the target runtime exactly. */
export function fitTimelineToDuration(scenes: Scene[], targetSeconds: number): Scene[] {
  const current = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  if (!scenes.length || current <= 0 || targetSeconds <= 0) return sequenceScenes(scenes);
  const factor = targetSeconds / current;
  return sequenceScenes(
    scenes.map((scene) => ({
      ...scene,
      duration: Math.max(0.5, round(scene.duration * factor, 2)),
    })),
  );
}

/** Move a scene up or down and re-sequence. */
export function moveScene(scenes: Scene[], sceneId: string, direction: -1 | 1): Scene[] {
  const index = scenes.findIndex((scene) => scene.id === sceneId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= scenes.length) return scenes;
  const next = [...scenes];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return sequenceScenes(next);
}

export interface SceneAtTime {
  scene: Scene;
  index: number;
  localTime: number;
  progress: number;
}

/** Resolve which scene is playing at an absolute timeline time. */
export function sceneAtTime(project: Project, time: number): SceneAtTime | undefined {
  const scenes = project.scenes;
  if (!scenes.length) return undefined;
  const total = timelineDuration(project);
  const clamped = Math.min(Math.max(0, time), Math.max(0, total - 0.001));
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    if (clamped < scene.end || index === scenes.length - 1) {
      const localTime = Math.min(Math.max(0, clamped - scene.start), scene.duration);
      return {
        scene,
        index,
        localTime,
        progress: scene.duration > 0 ? localTime / scene.duration : 1,
      };
    }
  }
  return undefined;
}

/**
 * Audio tracks follow their scene when the storyboard is re-ordered, so playback
 * and export schedule narration from the scene's current start time.
 */
export function resolvedAudioTracks(project: Project): AudioTrack[] {
  return project.audioTracks.map((track) => {
    if (!track.sceneId) return track;
    const scene = project.scenes.find((item) => item.id === track.sceneId);
    return scene ? { ...track, startTime: scene.start } : track;
  });
}

/** Absolute start time of a scene id (used to seek by clicking a scene). */
export function sceneStartTime(project: Project, sceneId: string): number {
  const scene = project.scenes.find((item) => item.id === sceneId);
  return scene ? scene.start : 0;
}
