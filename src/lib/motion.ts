import type {
  Direction,
  EasingId,
  LayerAnimation,
  MouthPose,
  MotionPresetId,
  Pose,
  Scene,
  SceneLayer,
} from '../types';
import { clamp } from './time';

/* ------------------------------------------------------------------ */
/* Easing                                                              */
/* ------------------------------------------------------------------ */

export const EASINGS: Record<EasingId, (t: number) => number> = {
  linear: (t) => t,
  easeOut: (t) => 1 - (1 - t) ** 3,
  easeIn: (t) => t ** 3,
  easeInOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  spring: (t) => {
    // Damped overshoot: settles at 1 with a small bounce.
    if (t >= 1) return 1;
    return 1 - Math.cos(t * Math.PI * 1.5) * (1 - t) ** 2;
  },
};

export function ease(id: EasingId, t: number): number {
  const fn = EASINGS[id] ?? EASINGS.easeOut;
  return fn(clamp(t, 0, 1));
}

/* ------------------------------------------------------------------ */
/* Preset catalogue                                                    */
/* ------------------------------------------------------------------ */

export type PresetGroup = 'entrance' | 'exit' | 'loop' | 'performance' | 'utility';

export interface MotionPresetInfo {
  id: MotionPresetId;
  label: string;
  group: PresetGroup;
  description: string;
  defaultDuration: number;
  defaultStrength: number;
  usesDirection: boolean;
  loopable: boolean;
  layerKinds?: SceneLayer['kind'][];
}

export const MOTION_PRESETS: MotionPresetInfo[] = [
  {
    id: 'popIn',
    label: 'Pop-in',
    group: 'entrance',
    description: 'Appears from small and transparent, landing with a light overshoot.',
    defaultDuration: 0.4,
    defaultStrength: 0.6,
    usesDirection: false,
    loopable: false,
  },
  {
    id: 'fadeIn',
    label: 'Fade-in',
    group: 'entrance',
    description: 'Soft opacity ramp. Use for backgrounds and quiet reveals.',
    defaultDuration: 0.6,
    defaultStrength: 0.5,
    usesDirection: false,
    loopable: false,
  },
  {
    id: 'slideIn',
    label: 'Slide-in',
    group: 'entrance',
    description: 'Enters from an edge and settles. Independent per layer.',
    defaultDuration: 0.6,
    defaultStrength: 0.5,
    usesDirection: true,
    loopable: false,
  },
  {
    id: 'scaleBounce',
    label: 'Scale-bounce',
    group: 'entrance',
    description: 'Snappy spring scale for emphasis beats and stamps.',
    defaultDuration: 0.5,
    defaultStrength: 0.7,
    usesDirection: false,
    loopable: false,
    layerKinds: ['character', 'image', 'text', 'shape', 'effect'],
  },
  {
    id: 'slideOut',
    label: 'Slide-out',
    group: 'exit',
    description: 'Leaves the frame toward an edge. Pair with a cut or fade.',
    defaultDuration: 0.5,
    defaultStrength: 0.5,
    usesDirection: true,
    loopable: false,
  },
  {
    id: 'fadeOut',
    label: 'Fade-out',
    group: 'exit',
    description: 'Soft opacity fall for exits and memory beats.',
    defaultDuration: 0.6,
    defaultStrength: 0.5,
    usesDirection: false,
    loopable: false,
  },
  {
    id: 'pushIn',
    label: 'Slow push-in',
    group: 'loop',
    description: 'Continuous scale-in across the shot. Motion without a cut.',
    defaultDuration: 4,
    defaultStrength: 0.4,
    usesDirection: false,
    loopable: true,
  },
  {
    id: 'pullOut',
    label: 'Slow pull-out',
    group: 'loop',
    description: 'Starts close and eases out, revealing context.',
    defaultDuration: 4,
    defaultStrength: 0.4,
    usesDirection: false,
    loopable: true,
  },
  {
    id: 'parallax',
    label: 'Parallax drift',
    group: 'loop',
    description: 'Slow independent horizontal drift. Give layered artwork depth.',
    defaultDuration: 6,
    defaultStrength: 0.4,
    usesDirection: false,
    loopable: true,
  },
  {
    id: 'driftLeft',
    label: 'Drift left',
    group: 'loop',
    description: 'Linear pan left, wrapping. Useful for skyline and city plates.',
    defaultDuration: 8,
    defaultStrength: 0.4,
    usesDirection: false,
    loopable: true,
  },
  {
    id: 'driftRight',
    label: 'Drift right',
    group: 'loop',
    description: 'Linear pan right, wrapping.',
    defaultDuration: 8,
    defaultStrength: 0.4,
    usesDirection: false,
    loopable: true,
  },
  {
    id: 'float',
    label: 'Idle float',
    group: 'loop',
    description: 'Subtle vertical breathing. Keep it small — one purposeful gesture per beat.',
    defaultDuration: 4,
    defaultStrength: 0.3,
    usesDirection: false,
    loopable: true,
  },
  {
    id: 'loopRotate',
    label: 'Looping rotation',
    group: 'loop',
    description: 'Constant rotation for gears, coins and machinery.',
    defaultDuration: 4,
    defaultStrength: 0.4,
    usesDirection: false,
    loopable: true,
  },
  {
    id: 'machine',
    label: 'Looping machinery',
    group: 'loop',
    description: 'Rotating, slightly juddering loop for engines, gears and production lines.',
    defaultDuration: 4,
    defaultStrength: 0.5,
    usesDirection: false,
    loopable: true,
  },
  {
    id: 'headBob',
    label: 'Head bob',
    group: 'performance',
    description: 'Small head rotation while the body stays settled.',
    defaultDuration: 2.2,
    defaultStrength: 0.4,
    usesDirection: false,
    loopable: true,
    layerKinds: ['character'],
  },
  {
    id: 'blink',
    label: 'Blink',
    group: 'performance',
    description: 'Periodic eyelid close. The cheapest way to keep a still frame alive.',
    defaultDuration: 2.8,
    defaultStrength: 0.4,
    usesDirection: false,
    loopable: true,
    layerKinds: ['character'],
  },
  {
    id: 'talk',
    label: 'Talking mouth',
    group: 'performance',
    description: 'Approximate mouth movement for narration (visual cadence, not phonemes).',
    defaultDuration: 3,
    defaultStrength: 0.6,
    usesDirection: false,
    loopable: true,
    layerKinds: ['character'],
  },
  {
    id: 'point',
    label: 'Point gesture',
    group: 'performance',
    description: 'Holds a pointing pose for the duration — one beat, then returns.',
    defaultDuration: 1.6,
    defaultStrength: 0.5,
    usesDirection: false,
    loopable: false,
    layerKinds: ['character'],
  },
  {
    id: 'openhand',
    label: 'Open-hand explanation',
    group: 'performance',
    description: 'Palm-up explanatory gesture held for the beat.',
    defaultDuration: 1.8,
    defaultStrength: 0.5,
    usesDirection: false,
    loopable: false,
    layerKinds: ['character'],
  },
  {
    id: 'adjustSuit',
    label: 'Adjust suit',
    group: 'performance',
    description: 'Brief lapel adjustment. Dry, confident punctuation.',
    defaultDuration: 1.2,
    defaultStrength: 0.5,
    usesDirection: false,
    loopable: false,
    layerKinds: ['character'],
  },
  {
    id: 'progressive',
    label: 'Progressive change',
    group: 'utility',
    description: 'Grows a layer in over the duration. Ideal for cracks, charts and text builds.',
    defaultDuration: 2,
    defaultStrength: 0.6,
    usesDirection: false,
    loopable: false,
  },
  {
    id: 'shake',
    label: 'Impact shake',
    group: 'utility',
    description: 'Damped shake at the start time. Pair with a sound effect.',
    defaultDuration: 0.5,
    defaultStrength: 0.5,
    usesDirection: false,
    loopable: false,
  },
  {
    id: 'pulse',
    label: 'Pulse highlight',
    group: 'utility',
    description: 'Soft coral pulse for the one number or object that matters.',
    defaultDuration: 1.6,
    defaultStrength: 0.5,
    usesDirection: false,
    loopable: true,
  },
  {
    id: 'none',
    label: 'No motion',
    group: 'utility',
    description: 'Holds still. Use deliberately, not by accident.',
    defaultDuration: 1,
    defaultStrength: 0.5,
    usesDirection: false,
    loopable: false,
  },
];

export const PRESET_BY_ID: Record<MotionPresetId, MotionPresetInfo> = MOTION_PRESETS.reduce(
  (acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  },
  {} as Record<MotionPresetId, MotionPresetInfo>,
);

/* ------------------------------------------------------------------ */
/* Sampling                                                            */
/* ------------------------------------------------------------------ */

export interface LayerSample {
  visible: boolean;
  opacity: number;
  /** Fraction of canvas width. */
  dx: number;
  /** Fraction of canvas height. */
  dy: number;
  scale: number;
  /** Degrees. */
  rotation: number;
  /** 0 = eyes open, 1 = closed. */
  blink: number;
  /** 0..1 grow-in used for progressive builds. */
  reveal: number;
  /** 0..1 coral emphasis glow. */
  glow: number;
  pose?: Pose;
  mouth?: MouthPose;
}

export const IDENTITY_SAMPLE: LayerSample = {
  visible: true,
  opacity: 1,
  dx: 0,
  dy: 0,
  scale: 1,
  rotation: 0,
  blink: 0,
  reveal: 1,
  glow: 0,
};

function directionSign(direction: Direction): { x: number; y: number } {
  switch (direction) {
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    case 'up':
      return { x: 0, y: -1 };
    default:
      return { x: 0, y: 1 };
  }
}

/** Deterministic blink gate: one blink every `interval` seconds. */
export function blinkAmount(elapsed: number, interval: number): number {
  if (elapsed < 0) return 0;
  const period = Math.max(1.2, interval);
  const phase = elapsed % period;
  const duration = 0.14;
  if (phase > duration) return 0;
  const p = phase / duration;
  return Math.sin(p * Math.PI);
}

const TALK_POSES: MouthPose[] = ['open', 'rounded', 'wide', 'closed', 'teeth', 'open'];

/**
 * Visual mouth cadence for narration. This is approximate by design — it is not
 * phoneme lip-sync and the UI says so wherever it appears.
 */
export function talkMouthAt(elapsed: number, strength: number): MouthPose {
  if (elapsed < 0) return 'closed';
  const rate = clamp(6 + strength * 8, 4, 14);
  const step = Math.floor(elapsed * rate);
  const seed = Math.abs(Math.sin(step * 12.9898) * 43758.5453) % 1;
  if (seed < 0.35) return 'closed';
  return TALK_POSES[Math.floor(seed * TALK_POSES.length)];
}

function activeWindow(anim: LayerAnimation, t: number): { active: boolean; before: boolean; p: number } {
  const end = anim.start + anim.duration;
  const before = t < anim.start;
  const active = !before && t <= end;
  const raw = anim.duration <= 0 ? 1 : (t - anim.start) / anim.duration;
  const p = anim.loop && !before ? ((t - anim.start) % anim.duration) / anim.duration : clamp(raw, 0, 1);
  return { active, before, p: anim.loop && !before ? p : clamp(raw, 0, 1) };
}

const POSE_MAP: Partial<Record<MotionPresetId, Pose>> = {
  point: 'pointing',
  openhand: 'openhand',
  adjustSuit: 'adjustSuit',
};

/**
 * Apply every animation on a layer to produce its state at scene time `t`.
 * Animations compose: offsets add, scales and opacities multiply.
 */
export function sampleLayer(layer: SceneLayer, t: number): LayerSample {
  let sample: LayerSample = { ...IDENTITY_SAMPLE, reveal: 1 };
  let pose: Pose | undefined;
  let mouth: MouthPose | undefined;

  for (const anim of layer.animations) {
    const info = PRESET_BY_ID[anim.preset];
    if (!info) continue;
    const { active, before, p } = activeWindow(anim, t);
    const eased = ease(anim.easing, p);
    const strength = clamp(anim.strength, 0, 2);
    const dir = directionSign(anim.direction);

    if (before && (info.group === 'entrance' || anim.preset === 'progressive')) {
      // An entrance animation means the layer is not on screen yet. Progressive
      // builds start fully unbuilt. Without this, "appears at 0.8s" would render
      // from frame one and the timing would be a lie.
      if (info.group === 'entrance') sample.opacity = 0;
      else sample.reveal = 0;
      continue;
    }

    switch (anim.preset) {
      case 'popIn':
        sample.scale *= 0.55 + 0.45 * ease('spring', clamp(p * 1.15, 0, 1));
        sample.opacity *= clamp(p * 2.2, 0, 1);
        break;
      case 'fadeIn':
        sample.opacity *= eased;
        break;
      case 'fadeOut':
        if (t >= anim.start) sample.opacity *= 1 - eased;
        break;
      case 'slideIn':
        sample.dx += dir.x * (1 - eased) * 0.45 * strength;
        sample.dy += dir.y * (1 - eased) * 0.45 * strength;
        sample.opacity *= clamp(p * 2.2, 0, 1);
        break;
      case 'slideOut':
        if (t >= anim.start) {
          sample.dx += dir.x * eased * 0.5 * strength;
          sample.dy += dir.y * eased * 0.5 * strength;
          sample.opacity *= 1 - eased;
        }
        break;
      case 'scaleBounce':
        sample.scale *= 0.7 + 0.3 * ease('spring', p);
        sample.opacity *= clamp(p * 2, 0, 1);
        break;
      case 'pushIn':
        if (t >= anim.start) sample.scale *= 1 + eased * 0.35 * strength;
        break;
      case 'pullOut':
        if (t >= anim.start) sample.scale *= 1 + (1 - eased) * 0.35 * strength;
        break;
      case 'float':
        sample.dy += Math.sin(((t - anim.start) / 3.5) * Math.PI * 2) * 0.012 * strength;
        break;
      case 'parallax':
        sample.dx += Math.sin(((t - anim.start) / 9) * Math.PI * 2) * 0.03 * strength;
        break;
      case 'driftLeft':
      case 'driftRight': {
        const period = Math.max(2, anim.duration);
        const progress = (((t - anim.start) % period) + period) % period / period;
        const offset = (anim.preset === 'driftLeft' ? -1 : 1) * progress * 0.08 * strength;
        sample.dx += offset;
        break;
      }
      case 'loopRotate':
        sample.rotation += ((t - anim.start) * 40 * strength) % 360;
        break;
      case 'machine':
        sample.rotation += ((t - anim.start) * 90 * strength) % 360;
        sample.dy += Math.sin((t - anim.start) * 22) * 0.002 * strength;
        break;
      case 'headBob':
        sample.rotation += Math.sin((((t - anim.start) / 2.2) * Math.PI * 2)) * 1.8 * strength;
        sample.dy += Math.sin((((t - anim.start) / 2.2) * Math.PI * 2)) * 0.002;
        break;
      case 'blink':
        sample.blink = Math.max(sample.blink, blinkAmount(t - anim.start, 2.6 + (1 - strength) * 2));
        break;
      case 'talk':
        mouth = talkMouthAt(t - anim.start, strength);
        break;
      case 'point':
      case 'openhand':
      case 'adjustSuit':
        if (active || (!anim.loop && t > anim.start + anim.duration * 0.15 && t < anim.start + anim.duration)) {
          pose = POSE_MAP[anim.preset] ?? pose;
        }
        break;
      case 'progressive':
        sample.reveal = Math.min(sample.reveal, clamp(p, 0, 1));
        sample.opacity *= clamp(p * 3, 0, 1);
        break;
      case 'shake':
        if (t >= anim.start) {
          const dt = t - anim.start;
          const decay = Math.exp(-dt * 7);
          sample.dx += Math.sin(dt * 55) * 0.02 * strength * decay;
          sample.dy += Math.cos(dt * 47) * 0.012 * strength * decay;
        }
        break;
      case 'pulse':
        if (t >= anim.start) {
          const wave = 0.5 + 0.5 * Math.sin((((t - anim.start) / 1.5) * Math.PI * 2));
          sample.glow = Math.max(sample.glow, wave);
          sample.scale *= 1 + wave * 0.02 * strength;
        }
        break;
      case 'none':
        break;
      default:
        break;
    }
  }

  if (pose) sample.pose = pose;
  if (mouth) sample.mouth = mouth;
  return sample;
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

export interface CameraSample {
  zoom: number;
  dx: number;
  dy: number;
}

export function sampleCamera(scene: Scene, t: number): CameraSample {
  const intensity = clamp(scene.cameraIntensity, 0, 2);
  const progress = scene.duration > 0 ? clamp(t / scene.duration, 0, 1) : 1;
  const eased = ease('easeInOut', progress);
  switch (scene.camera) {
    case 'pushIn':
      return { zoom: 1 + eased * 0.16 * intensity, dx: 0, dy: 0 };
    case 'pullOut':
      return { zoom: 1 + (1 - eased) * 0.16 * intensity, dx: 0, dy: 0 };
    case 'panLeft':
      return { zoom: 1.06, dx: -(eased - 0.5) * 0.12 * intensity, dy: 0 };
    case 'panRight':
      return { zoom: 1.06, dx: (eased - 0.5) * 0.12 * intensity, dy: 0 };
    case 'drift':
      return {
        zoom: 1.03,
        dx: Math.sin(eased * Math.PI * 2) * 0.02 * intensity,
        dy: Math.cos(eased * Math.PI * 2) * 0.015 * intensity,
      };
    default:
      return { zoom: 1, dx: 0, dy: 0 };
  }
}

/* ------------------------------------------------------------------ */
/* Motion copy                                                         */
/* ------------------------------------------------------------------ */

export function describeAnimation(anim: LayerAnimation): string {
  const info = PRESET_BY_ID[anim.preset];
  const label = info ? info.label.toLowerCase() : anim.preset;
  const loop = anim.loop ? ', looping' : '';
  const dir = info?.usesDirection ? ` from ${anim.direction}` : '';
  return `${label}${dir} at ${anim.start.toFixed(1)}s for ${anim.duration.toFixed(1)}s${loop}`;
}

export function describeLayerMotion(layer: SceneLayer): string {
  if (!layer.animations.length) return 'held still';
  return layer.animations.map(describeAnimation).join(' · ');
}
