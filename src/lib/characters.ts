import type { Character, Expression, MouthPose, Pose } from '../types';
import { uid } from './id';

export const POSES: { id: Pose; label: string; note: string }[] = [
  { id: 'neutral', label: 'Neutral standing', note: 'Default. Hands relaxed, weight even.' },
  { id: 'talking', label: 'Talking', note: 'Mouth active, one hand slightly raised.' },
  { id: 'thinking', label: 'Thinking', note: 'Head tilted, eyes up, hand near chin.' },
  { id: 'sideways', label: 'Looking sideways', note: 'Eyes and head turned, body still.' },
  { id: 'smirk', label: 'Smirking', note: 'One eyebrow raised, half smile.' },
  { id: 'surprised', label: 'Surprised', note: 'Eyes wide, brows high, arms out.' },
  { id: 'disappointed', label: 'Disappointed', note: 'Eyes low, shoulders dropped.' },
  { id: 'pointing', label: 'Pointing', note: 'One arm out, index extended.' },
  { id: 'openhand', label: 'Open-hand explanation', note: 'Palm up, offering the idea.' },
  { id: 'adjustSuit', label: 'Adjusting suit', note: 'Hand on lapel, chin up.' },
  { id: 'walking', label: 'Walking', note: 'Stride, arm swing, slight lean.' },
  { id: 'sitting', label: 'Sitting', note: 'Seated on an implied block or desk.' },
  { id: 'directGaze', label: 'Direct gaze', note: 'Locked on the audience. Use sparingly.' },
];

export const EXPRESSIONS: { id: Expression; label: string; note: string }[] = [
  { id: 'neutral', label: 'Neutral', note: 'Observant, calm.' },
  { id: 'confident', label: 'Confident', note: 'Steady gaze, level brows.' },
  { id: 'smirk', label: 'Smirk', note: 'Dry amusement.' },
  { id: 'surprised', label: 'Surprised', note: 'Wide eyes, high brows.' },
  { id: 'disappointed', label: 'Disappointed', note: 'Heavy lids, flat mouth.' },
  { id: 'thinking', label: 'Thinking', note: 'Brows drawn in on one side.' },
  { id: 'alert', label: 'Alert', note: 'Eyes forward, brows tense.' },
];

export const MOUTH_POSES: { id: MouthPose; label: string; note: string }[] = [
  { id: 'closed', label: 'Closed', note: 'Rest between words.' },
  { id: 'rest', label: 'Resting', note: 'Slight relaxed opening.' },
  { id: 'open', label: 'Open', note: 'Mid vowel.' },
  { id: 'wide', label: 'Wide', note: 'Open, spread — "ah".' },
  { id: 'rounded', label: 'Rounded', note: 'Circle mouth — "oh".' },
  { id: 'teeth', label: 'Teeth / lip contact', note: 'Consonant contact.' },
];

/**
 * Marlowe — Ascend's primary narrator.
 *
 * The drawing itself lives in src/render/mascot.ts; this is the character bible,
 * which is the single source of truth for how he must be drawn and animated.
 */
export function createMascot(): Character {
  return {
    id: 'char_marlowe',
    name: 'Marlowe',
    role: 'Primary narrator — the black jackal in the suit.',
    concept:
      'A black jackal/dog in a tailored suit who narrates Ascend stories. Dry, calm, observant, confident, intelligent, slightly ironic. Never needlessly loud.',
    silhouette:
      'Tall, narrow humanoid with a jackal head: two upright triangular ears and a long muzzle. Straight shoulders, minimal waist, long legs. Silhouette must read at thumbnail size in solid black.',
    proportions:
      'Roughly 7 heads tall. Head height ~14% of total. Shoulders ~2.2 head widths. Legs ~45% of total height. Hands are simple rounded mittens with a separate index finger shape.',
    face:
      'Long tapered muzzle, small nose, almond eyes with heavy upper lids, straight brows that angle for expression, thin mouth line. Eyes are white sclera with ink-black pupils — the only high-contrast feature.',
    outfit:
      'Ink-black two-piece suit, charcoal lapels, white shirt collar, narrow coral-pink #ff5470 tie. Black shoes. Optional cigarette held in the right hand. No logos, no patterns.',
    colorRules: [
      'Body, suit, head and backgrounds: black, white and grayscale only.',
      'One coral accent (#ff5470) maximum per shot — normally the tie.',
      'No colourful gradients, no multicoloured fur, no neon.',
      'Additional colour only when it carries meaning: gold for money, red for risk, green for growth.',
    ],
    expressions: EXPRESSIONS.map((item) => item.label),
    poses: POSES.map((item) => item.label),
    animationRules: [
      'One purposeful gesture per narrative beat. Idle motion stays subtle.',
      'Blink at most every 2.5 seconds; never blink both eyes twice in a row at the same camera.',
      'Talking mouth cycles only while narration is playing; closed between lines.',
      'Never move arms, head and legs simultaneously unless the pose is walking.',
      'Body faces camera unless the script calls for a side look; then the head turns first, eyes lead.',
      'Cigarette and smoke are optional and always separate layers.',
      'Hold a strong pose for at least 1.2 seconds so the audience can read it.',
    ],
    namingConvention:
      'ascend.marlowe.<part>.<pose>.<variant> — e.g. ascend.marlowe.arm.pointing.v1, ascend.marlowe.mouth.rounded.v1, ascend.marlowe.smoke.loop.v1',
    cigarette: true,
    smoke: false,
    notes:
      'The cigarette is a configurable design element, not an endorsement of smoking. Toggle it off in Settings; smoke always renders as a separate effect layer.',
    accentColor: '#ff5470',
    builtin: true,
    createdAt: Date.now(),
    referenceStatus: 'Built-in specification.',
  };
}

export const MASCOT_ID = 'char_marlowe';

/**
 * A placeholder for the Dani character reference. No Dani artwork exists in the
 * repository, so nothing about that design is invented here — it stays empty
 * until the creator supplies the reference.
 */
export function createDaniPlaceholder(): Character {
  return {
    id: 'char_dani',
    name: 'Dani',
    role: 'Separate established character — reference not supplied.',
    concept:
      'Dani is an established Ascend character. No reference art was present in this repository, so AscendCC does not invent an appearance for Dani.',
    silhouette: 'Awaiting reference.',
    proportions: 'Awaiting reference.',
    face: 'Awaiting reference.',
    outfit: 'Awaiting reference.',
    colorRules: ['Awaiting reference — do not redesign without the original artwork.'],
    expressions: [],
    poses: [],
    animationRules: ['Do not reuse Marlowe geometry for Dani. Keep both characters distinct.'],
    namingConvention: 'ascend.dani.<part>.<pose>.<variant>',
    cigarette: false,
    smoke: false,
    notes:
      'Upload any existing Dani artwork in the Asset Library and attach it here. This record exists so Dani is never merged into Marlowe by accident.',
    accentColor: '#ff5470',
    builtin: false,
    createdAt: Date.now(),
    referenceStatus: 'No reference found in repository. Add artwork to preserve the design.',
  };
}

export function defaultCharacters(): Character[] {
  return [createMascot(), createDaniPlaceholder()];
}

/** Mouth pose selected by narration loudness analysis. */
export function mouthFromEnergy(energy: number): MouthPose {
  if (energy < 0.06) return 'closed';
  if (energy < 0.18) return 'rest';
  if (energy < 0.38) return 'open';
  if (energy < 0.62) return 'rounded';
  if (energy < 0.82) return 'wide';
  return 'teeth';
}

/** Naming helper so imported assets stay consistent with the bible. */
export function assetName(category: string, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `ascend.${category}.${slug}`;
}

export function newCharacterTemplate(): Character {
  return {
    id: uid('char'),
    name: 'New character',
    role: '',
    concept: '',
    silhouette: '',
    proportions: '',
    face: '',
    outfit: '',
    colorRules: ['Grayscale body. Coral accent only when it carries meaning.'],
    expressions: [],
    poses: [],
    animationRules: ['One gesture per beat.'],
    namingConvention: 'ascend.<character>.<part>.<pose>.<variant>',
    cigarette: false,
    smoke: false,
    notes: '',
    accentColor: '#ff5470',
    builtin: false,
    createdAt: Date.now(),
    referenceStatus: 'Specification only — no artwork attached.',
  };
}
