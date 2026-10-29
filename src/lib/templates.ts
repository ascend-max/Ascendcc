import type {
  CalendarEntry,
  ContentMode,
  ContentPackage,
  Idea,
  Platform,
  Project,
  Scene,
  SceneLayer,
  Settings,
} from '../types';
import { buildCaptionGroups } from './captions';
import { createAnimation, createCalendarEntry, createLayer, createScene } from './factory';
import { uid } from './id';
import { MASCOT_ID } from './characters';
import { describeLayerMotion, PRESET_BY_ID } from './motion';
import { sequenceScenes } from './sequence';
import { addDays, isoDate, round } from './time';

/* ------------------------------------------------------------------ */
/* Mode routing                                                        */
/* ------------------------------------------------------------------ */

export type Archetype = 'story' | 'explainer' | 'sales';

export function archetypeForMode(mode: ContentMode): Archetype {
  switch (mode) {
    case 'documentary':
    case 'brand-story':
    case 'founder-story':
    case 'case-study':
      return 'story';
    case 'promotional':
    case 'direct-response':
    case 'lead-generation':
      return 'sales';
    default:
      return 'explainer';
  }
}

export const CONTENT_MODES: { id: ContentMode; label: string }[] = [
  { id: 'educational', label: 'Educational' },
  { id: 'documentary', label: 'Documentary storytelling' },
  { id: 'product-demo', label: 'Product demonstration' },
  { id: 'comparison', label: 'Product comparison' },
  { id: 'brand-story', label: 'Brand story' },
  { id: 'promotional', label: 'Promotional' },
  { id: 'direct-response', label: 'Direct response' },
  { id: 'founder-story', label: 'Founder story' },
  { id: 'case-study', label: 'Case study' },
  { id: 'lead-generation', label: 'Lead generation' },
];

/* ------------------------------------------------------------------ */
/* Beat definitions                                                    */
/* ------------------------------------------------------------------ */

export interface BeatTemplate {
  key: string;
  label: string;
  weight: number;
  spoken: string;
  scaffold: string;
  visual: string;
  camera: Scene['camera'];
  pose: SceneLayer['pose'];
  expression: SceneLayer['expression'];
  prop?: { label: string; shape: string; color: string; effect?: boolean };
  sfx: string;
  music: string;
  transition: Scene['transition'];
  interstitial?: string;
}

const HOOK_BEAT: BeatTemplate = {
  key: 'hook',
  label: 'Hook',
  weight: 1,
  spoken: 'You know the name. You do not know how close it came to ending.',
  scaffold:
    'Open on the strongest true fact you can defend. [VERIFY] Insert the single most surprising number with its year and source. Keep the sentence under 12 words.',
  visual:
    'Marlowe stands dead centre in a white studio void. A single dark spotlight pool sits on the floor. One coral accent — the tie — is the only colour in frame.',
  camera: 'pushIn',
  pose: 'directGaze',
  expression: 'confident',
  sfx: 'Low room tone. One soft sub thump on the last word.',
  music: 'No melody for the first two seconds. Sparse pulse only.',
  transition: 'cut',
};

const STORY_BEATS: BeatTemplate[] = [
  {
    key: 'background',
    label: 'Background',
    weight: 1.1,
    spoken: 'Every collapse starts somewhere ordinary.',
    scaffold:
      '[VERIFY] Give the founding context: who started it, when, and what the business actually did. One sentence per fact, each with a source.',
    visual:
      'A flat grayscale skyline slides in behind Marlowe. A single building block rises from the ground line, stamped in place.',
    camera: 'panRight',
    pose: 'openhand',
    expression: 'neutral',
    prop: { label: 'Building block', shape: 'block', color: '#2a2a2e' },
    sfx: 'Soft city rumble, distant traffic, quiet.',
    music: 'Single plucked note per beat.',
    transition: 'fade',
  },
  {
    key: 'collapse',
    label: 'Near-collapse',
    weight: 1.3,
    spoken: 'Then the ground moved.',
    scaffold:
      '[VERIFY] Name the crisis precisely — a figure, a date, a decision. Distinguish what was reported from what was later confirmed. Mark any claim you cannot source as [VERIFY].',
    visual:
      'The building block cracks progressively. Three cracks appear one after another. Marlowe does not move except to blink.',
    camera: 'pushIn',
    pose: 'sideways',
    expression: 'alert',
    prop: { label: 'Cracks', shape: 'cracks', color: '#ff5470', effect: true },
    sfx: 'Stone crack at each break. Low impact on the third.',
    music: 'Pulse drops out for one second before the last crack.',
    transition: 'cut',
  },
  {
    key: 'cliffhanger',
    label: 'Cliffhanger card',
    weight: 0.7,
    spoken: 'Then somebody made one decision.',
    scaffold:
      '[VERIFY] Confirm the decision, who made it, and the date before promising a reveal. The card must point at a real event, not invented mystery.',
    visual:
      'Full black interstitial card. Elegant cursive line, coral underline that draws in. No character, no background artwork.',
    camera: 'static',
    pose: 'neutral',
    expression: 'neutral',
    sfx: 'Pen scratch, then silence.',
    music: 'Silence. Let the card breathe.',
    transition: 'fade',
    interstitial: 'One decision changed everything.',
  },
  {
    key: 'strategy',
    label: 'Hidden strategy',
    weight: 1.5,
    spoken: 'The move looked small from the outside.',
    scaffold:
      '[VERIFY] Explain the mechanism, not the mythology. What did they actually change: price, product, supply, staffing, positioning? Cite the reporting or filing.',
    visual:
      'A three-step diagram builds beside Marlowe: three grayscale panels appear in sequence, one at a time, with the decisive step in coral.',
    camera: 'drift',
    pose: 'pointing',
    expression: 'confident',
    prop: { label: 'Strategy panels', shape: 'panel', color: '#ff5470' },
    sfx: 'Three soft UI ticks, one per panel.',
    music: 'Steady pulse returns, one layer richer.',
    transition: 'fade',
  },
  {
    key: 'growth',
    label: 'Growth and consequences',
    weight: 1.3,
    spoken: 'And then the numbers moved.',
    scaffold:
      '[VERIFY] Use real reported figures with dates. If the growth is contested, say so. Never round up to a more dramatic number.',
    visual:
      'Three bars grow upward from a baseline, staggered. Marlowe steps back to let the data read. The tallest bar flashes coral once, then settles.',
    camera: 'pullOut',
    pose: 'adjustSuit',
    expression: 'smirk',
    prop: { label: 'Growth bars', shape: 'bar', color: '#3ddc97' },
    sfx: 'Ascending ticks as each bar lands.',
    music: 'Fullest arrangement of the video.',
    transition: 'cut',
  },
  {
    key: 'twist',
    label: 'Ironic twist',
    weight: 1.1,
    spoken: 'The part nobody repeats is the expensive part.',
    scaffold:
      '[VERIFY] Only keep this beat if the record supports it. If there is no honest twist, delete this scene rather than inventing one.',
    visual:
      'The background drains to pitch black. Marlowe is lit from one side. The tie is the only coral shape remaining.',
    camera: 'static',
    pose: 'smirk',
    expression: 'smirk',
    sfx: 'One dry, quiet beat of silence.',
    music: 'Strip back to a single low note.',
    transition: 'fade',
  },
  {
    key: 'lesson',
    label: 'One-line lesson',
    weight: 0.9,
    spoken: 'Survival is rarely dramatic. It is usually one boring decision, repeated.',
    scaffold:
      'Write one sentence, under 14 words, that a viewer could repeat to a friend. No new facts here.',
    visual:
      'Single line of large white type on black, centred. Marlowe small in the lower corner, looking at the audience.',
    camera: 'static',
    pose: 'directGaze',
    expression: 'confident',
    sfx: 'Clean hit on the line.',
    music: 'Warm resolved chord.',
    transition: 'cut',
  },
  {
    key: 'cta',
    label: 'Follow call to action',
    weight: 0.7,
    spoken: 'Follow for the next one. It gets stranger.',
    scaffold:
      'One clear action. No fake urgency, no promises about returns or results.',
    visual:
      'Marlowe adjusts his suit, coral tie visible, holds the final pose. Coral brand mark bottom centre.',
    camera: 'pullOut',
    pose: 'adjustSuit',
    expression: 'smirk',
    sfx: 'Soft outro whoosh.',
    music: 'Outro tail, cut on the beat.',
    transition: 'cut',
  },
];

const EXPLAINER_BEATS: BeatTemplate[] = [
  {
    key: 'question',
    label: 'The question',
    weight: 1,
    spoken: 'Here is the question worth asking.',
    scaffold:
      '[VERIFY] State the question precisely. Name the actors involved and the period you are examining.',
    visual: 'Two grayscale panels slide in from opposite sides and stop short of touching. A question mark sits in the gap.',
    camera: 'static',
    pose: 'openhand',
    expression: 'thinking',
    prop: { label: 'Two panels', shape: 'panel', color: '#6b6b70' },
    sfx: 'Two soft slides, one quiet tick.',
    music: 'Minimal pulse.',
    transition: 'cut',
  },
  {
    key: 'misconception',
    label: 'The misconception',
    weight: 1.1,
    spoken: 'Most explanations get this part backwards.',
    scaffold:
      '[VERIFY] Quote the common claim accurately, then name the source that contradicts it. Do not build a straw man.',
    visual: 'A large white claim card snaps in, then a red grayscale strike-through wipes across it. Marlowe raises one brow.',
    camera: 'pushIn',
    pose: 'sideways',
    expression: 'disappointed',
    prop: { label: 'Struck claim', shape: 'panel', color: '#c92a3f' },
    sfx: 'Marker squeak for the strike.',
    music: 'Pulse continues, one note lower.',
    transition: 'fade',
  },
  {
    key: 'mechanism',
    label: 'How it actually works',
    weight: 1.5,
    spoken: 'Follow the incentive, not the story.',
    scaffold:
      '[VERIFY] Explain the mechanism step by step. Each step needs a source or must be labelled as your interpretation.',
    visual:
      'A three-stage diagram: block, arrow, block. Gears rotate slowly behind. Each block pops in on its own beat and the middle one is coral.',
    camera: 'drift',
    pose: 'pointing',
    expression: 'confident',
    prop: { label: 'Mechanism gear', shape: 'circle', color: '#ff5470' },
    sfx: 'Mechanical loop, quiet underneath narration.',
    music: 'Looping machinery rhythm.',
    transition: 'fade',
  },
  {
    key: 'example',
    label: 'Concrete example',
    weight: 1.3,
    spoken: 'One example makes it obvious.',
    scaffold:
      '[VERIFY] Give a documented example with a date and source. Use real numbers or none at all.',
    visual: 'A chart baseline draws left to right, then two bars rise. Marlowe steps to the side so the data is unobstructed.',
    camera: 'panLeft',
    pose: 'openhand',
    expression: 'neutral',
    prop: { label: 'Example bars', shape: 'bar', color: '#3ddc97' },
    sfx: 'Two rising ticks.',
    music: 'Arrangement opens up.',
    transition: 'cut',
  },
  {
    key: 'caveat',
    label: 'The caveat',
    weight: 0.8,
    spoken: 'Two things could still break this explanation.',
    scaffold: '[VERIFY] List the strongest counter-argument and any conflicting reporting.',
    visual: 'Two small panels drop in beneath the chart, grey on grey. Camera holds still.',
    camera: 'static',
    pose: 'thinking',
    expression: 'thinking',
    sfx: 'Two soft thuds.',
    music: 'Pulse thins out.',
    transition: 'fade',
  },
  {
    key: 'lesson',
    label: 'What to do with it',
    weight: 1,
    spoken: 'Use it like a checklist, not a slogan.',
    scaffold: 'Give one practical, honest application. No guarantees about money or results.',
    visual: 'Checklist lines appear one at a time, each with a coral tick that draws in.',
    camera: 'pushIn',
    pose: 'adjustSuit',
    expression: 'confident',
    prop: { label: 'Checklist', shape: 'panel', color: '#ff5470' },
    sfx: 'Tick per line.',
    music: 'Resolved chord.',
    transition: 'cut',
  },
  {
    key: 'cta',
    label: 'Follow call to action',
    weight: 0.7,
    spoken: 'Follow for the next breakdown.',
    scaffold: 'One clear action. No fake scarcity.',
    visual: 'Marlowe holds the final pose, tie visible. Coral mark bottom centre.',
    camera: 'pullOut',
    pose: 'directGaze',
    expression: 'smirk',
    sfx: 'Soft outro.',
    music: 'Outro tail.',
    transition: 'cut',
  },
];

const SALES_BEATS: BeatTemplate[] = [
  {
    key: 'problem',
    label: 'Problem',
    weight: 1.1,
    spoken: 'Here is the problem, in one sentence.',
    scaffold:
      'Name the audience problem in their own words. No exaggeration, no invented statistics.',
    visual: 'A single grey panel with a short line of text. Marlowe points at it, then lowers his hand.',
    camera: 'static',
    pose: 'pointing',
    expression: 'neutral',
    prop: { label: 'Problem card', shape: 'panel', color: '#6b6b70' },
    sfx: 'Dry tick.',
    music: 'Sparse pulse.',
    transition: 'cut',
  },
  {
    key: 'stakes',
    label: 'Consequences',
    weight: 1.1,
    spoken: 'Left alone, it gets more expensive.',
    scaffold: '[VERIFY] Only use costs or losses you can document. Otherwise describe the stakes qualitatively.',
    visual: 'The panel fractures with progressive cracks. Camera pushes in. Marlowe stays still.',
    camera: 'pushIn',
    pose: 'sideways',
    expression: 'alert',
    prop: { label: 'Cracks', shape: 'cracks', color: '#c92a3f', effect: true },
    sfx: 'Three cracks, last one heavier.',
    music: 'Pulse drops, tension note.',
    transition: 'cut',
  },
  {
    key: 'explanation',
    label: 'Explanation',
    weight: 1.4,
    spoken: 'The reason is structural, not personal.',
    scaffold:
      'Explain why the problem exists. Be specific and fair. This is where trust is earned or lost.',
    visual: 'Three blocks build a simple diagram. The middle block is coral, everything else is grayscale.',
    camera: 'drift',
    pose: 'openhand',
    expression: 'thinking',
    prop: { label: 'Diagram', shape: 'block', color: '#ff5470' },
    sfx: 'Three ticks.',
    music: 'Steady pulse.',
    transition: 'fade',
  },
  {
    key: 'solution',
    label: 'Solution',
    weight: 1.3,
    spoken: 'So we built the smallest possible version of the fix.',
    scaffold:
      'Describe what the product or method actually does. No capability you cannot demonstrate on screen.',
    visual: 'The coral block resolves into a clean panel. A check list ticks in beside it.',
    camera: 'pushIn',
    pose: 'adjustSuit',
    expression: 'confident',
    prop: { label: 'Solution panel', shape: 'panel', color: '#ff5470' },
    sfx: 'Clean confirm tone.',
    music: 'Arrangement lifts.',
    transition: 'fade',
  },
  {
    key: 'evidence',
    label: 'Evidence',
    weight: 1,
    spoken: 'Here is exactly what we can show you.',
    scaffold:
      '[VERIFY] Only real evidence: screenshots, documentation, a genuinely documented case. Never invent testimonials or results.',
    visual: 'Two verified panels appear side by side with a coral underline. No metrics are displayed unless entered manually.',
    camera: 'panRight',
    pose: 'openhand',
    expression: 'neutral',
    prop: { label: 'Evidence panels', shape: 'panel', color: '#3ddc97' },
    sfx: 'Paper slide.',
    music: 'Pulse holds.',
    transition: 'cut',
  },
  {
    key: 'objection',
    label: 'Objection handling',
    weight: 1.1,
    spoken: 'The obvious objection is fair. Here is the honest answer.',
    scaffold:
      'Name the real objection, then answer it without dismissing it. If the answer is "not yet", say that.',
    visual: 'A grey panel turns to face the viewer, then rotates away as the answer panel pops in.',
    camera: 'static',
    pose: 'thinking',
    expression: 'thinking',
    prop: { label: 'Objection card', shape: 'panel', color: '#6b6b70' },
    sfx: 'Two soft turns.',
    music: 'Steady.',
    transition: 'fade',
  },
  {
    key: 'offer',
    label: 'Offer',
    weight: 0.9,
    spoken: 'The offer is simple, and the limits are real.',
    scaffold:
      'State price, scope and limits honestly. Never invent scarcity, guarantees or bonus value.',
    visual: 'One clean coral-bordered card. Marlowe stands beside it, not in front of it.',
    camera: 'pushIn',
    pose: 'pointing',
    expression: 'confident',
    prop: { label: 'Offer card', shape: 'panel', color: '#ff5470' },
    sfx: 'Single clean hit.',
    music: 'Peak of the track.',
    transition: 'cut',
  },
  {
    key: 'cta',
    label: 'Call to action',
    weight: 0.7,
    spoken: 'If that is useful, the next step is below.',
    scaffold: 'One action, one link, no pressure. No promises about sales or results.',
    visual: 'Marlowe adjusts his suit and holds. Coral call-to-action line at the bottom third.',
    camera: 'pullOut',
    pose: 'adjustSuit',
    expression: 'smirk',
    sfx: 'Soft outro.',
    music: 'Outro tail.',
    transition: 'cut',
  },
];

export function beatsFor(mode: ContentMode): BeatTemplate[] {
  const archetype = archetypeForMode(mode);
  const body = archetype === 'story' ? STORY_BEATS : archetype === 'sales' ? SALES_BEATS : EXPLAINER_BEATS;
  return [HOOK_BEAT, ...body];
}

/* ------------------------------------------------------------------ */
/* Scene generation                                                    */
/* ------------------------------------------------------------------ */

function motionCopy(layers: SceneLayer[], camera: Scene['camera'], transition: Scene['transition'], duration: number): string {
  const parts = layers
    .slice()
    .sort((a, b) => a.z - b.z)
    .map((layer) => `${layer.label}: ${describeLayerMotion(layer)}`);
  const cameraText =
    camera === 'static'
      ? 'Camera holds still for the full shot.'
      : `Camera ${camera === 'pushIn' ? 'pushes in slowly' : camera === 'pullOut' ? 'pulls out slowly' : camera === 'panLeft' ? 'pans left' : camera === 'panRight' ? 'pans right' : 'drifts'} across the full ${duration.toFixed(1)} seconds.`;
  return `${parts.join('. ')}. ${cameraText} Transition: ${transition} at the end of the shot.`;
}

function buildBackdrop(duration: number): SceneLayer {
  return createLayer({
    kind: 'shape',
    label: 'Backdrop',
    refId: 'bg',
    x: 0.5,
    y: 0.5,
    z: 0,
    color: '#f2f2f4',
    animations: [createAnimation('fadeIn', 0, Math.min(0.6, duration * 0.2), { strength: 0.4 })],
  });
}

function buildMascot(beat: BeatTemplate, duration: number, index: number): SceneLayer {
  const blinkAt = round(Math.min(1.2 + index * 0.3, Math.max(0.4, duration - 0.8)), 1);
  const animations = [
    createAnimation('popIn', 0, 0.4, { easing: 'spring' }),
    createAnimation('float', 0.4, Math.max(1, duration - 0.4), { loop: true, strength: 0.2 }),
    createAnimation('blink', blinkAt, Math.max(2, duration * 0.6), { loop: true, strength: 0.4 }),
    createAnimation('talk', 0.2, Math.max(0.8, duration - 0.4), { loop: true, strength: 0.55 }),
  ];
  if (beat.pose === 'pointing') animations.push(createAnimation('point', 0.6, Math.max(0.8, duration * 0.5)));
  if (beat.pose === 'openhand') animations.push(createAnimation('openhand', 0.6, Math.max(0.8, duration * 0.5)));
  if (beat.pose === 'adjustSuit') animations.push(createAnimation('adjustSuit', 0.4, 1.2));
  return createLayer({
    kind: 'character',
    label: 'Marlowe',
    refId: MASCOT_ID,
    x: 0.5,
    y: 0.84,
    scale: 1,
    z: 3,
    pose: beat.pose,
    expression: beat.expression,
    animations,
  });
}

function buildProp(beat: BeatTemplate, duration: number): SceneLayer | null {
  const prop = beat.prop;
  if (!prop) return null;
  if (prop.effect) {
    return createLayer({
      kind: 'effect',
      label: prop.label,
      refId: prop.shape,
      x: 0.5,
      y: 0.5,
      z: 4,
      color: prop.color,
      animations: [createAnimation('progressive', 0.4, Math.max(1.2, duration * 0.6), { strength: 0.6 })],
    });
  }
  const z = beat.key === 'growth' || beat.key === 'example' ? 1 : 2;
  const position =
    beat.key === 'growth' || beat.key === 'example'
      ? { x: 0.5, y: 0.55 }
      : beat.key === 'strategy' || beat.key === 'mechanism' || beat.key === 'explanation'
        ? { x: 0.72, y: 0.42 }
        : { x: 0.5, y: 0.34 };
  return createLayer({
    kind: 'shape',
    label: prop.label,
    refId: prop.shape,
    x: position.x,
    y: position.y,
    z,
    color: prop.color,
    scale: 0.9,
    animations: [
      createAnimation('popIn', 0.5, 0.5, { strength: 0.6 }),
      createAnimation('progressive', 0.9, Math.max(0.8, duration * 0.4), { strength: 0.5 }),
      ...(beat.key === 'mechanism' ? [createAnimation('machine', 0.5, Math.max(2, duration - 0.5), { loop: true, strength: 0.4 })] : []),
      ...(beat.key === 'growth' ? [createAnimation('pulse', Math.max(1, duration - 1.2), 1.2, { strength: 0.4 })] : []),
    ],
  });
}

function allocateDurations(beats: BeatTemplate[], durationSec: number): number[] {
  const totalWeight = beats.reduce((sum, beat) => sum + beat.weight, 0);
  const raw = beats.map((beat) => (beat.weight / totalWeight) * durationSec);
  const rounded = raw.map((value) => Math.max(1.2, round(value, 1)));
  const sum = rounded.reduce((a, b) => a + b, 0);
  const diff = round(durationSec - sum, 2);
  // Give the remainder to the longest beat so the timeline matches the target exactly.
  const longest = rounded.indexOf(Math.max(...rounded));
  rounded[longest] = round(Math.max(1.2, rounded[longest] + diff), 2);
  return rounded;
}

export interface GenerateOptions {
  topic: string;
  audience: string;
  durationSec: number;
  mode: ContentMode;
  platform: Platform;
  settings: Settings;
}

/**
 * Build a complete, editable storyboard from a topic using structured templates.
 *
 * This is deliberately template-driven: no external model is called, nothing is
 * invented, and every factual slot is a bracketed [VERIFY] instruction for the
 * creator to fill from a real source.
 */
export function generateStoryboard(options: GenerateOptions): Scene[] {
  const beats = beatsFor(options.mode);
  const durations = allocateDurations(beats, options.durationSec);
  const scenes = beats.map((beat, index) => {
    const duration = durations[index];
    // Interstitial shots are drawn by the renderer as a full-screen card, so they
    // carry no layers. Everything else gets a backdrop, an optional prop, and the
    // narrator on stage.
    const layers: SceneLayer[] = [];
    if (!beat.interstitial) {
      layers.push(buildBackdrop(duration));
      const prop = buildProp(beat, duration);
      if (prop) layers.push(prop);
      layers.push(buildMascot(beat, duration, index));
    }
    const captions = buildCaptionGroups(beat.spoken, {
      maxWords: 4,
      minWords: 2,
      wordsPerSecond: Math.max(1.8, beat.spoken.split(/\s+/).length / Math.max(1, duration * 0.85)),
      startOffset: 0.15,
    }).filter((group) => group.start < duration);
    return createScene({
      title: beat.label,
      duration,
      voiceOver: beat.scaffold,
      onScreenText: beat.key === 'lesson' ? beat.spoken : '',
      visual: beat.visual,
      motion: beat.interstitial
        ? `Full-screen black interstitial card. Camera holds still. Cursive line “${beat.interstitial}” fades in over 0.4s, the coral underline draws in beneath it, the card holds for ${Math.max(1.2, duration * 0.5).toFixed(1)}s, then fades out over 0.35s into the next shot. No character movement. ${beat.sfx}`
        : motionCopy(layers, beat.camera, beat.transition, duration),
      camera: beat.camera,
      cameraIntensity: beat.camera === 'static' ? 0 : 0.6,
      transition: beat.transition,
      transitionDuration: 0.3,
      sfx: beat.sfx,
      music: beat.music,
      assetRefs: layers.filter((layer) => layer.kind !== 'character').map((layer) => layer.label),
      layers,
      captions,
      interstitial: {
        enabled: Boolean(beat.interstitial),
        text: beat.interstitial ?? '',
        enter: 'fade in over 0.4s from black',
        hold: Math.max(1.2, duration * 0.5),
        exit: 'fade out over 0.3s into the next shot',
        sfx: beat.sfx,
        nextConnection: 'Reveal the decision the card promised. Do not repeat it.',
      },
    });
  });
  return sequenceScenes(scenes);
}

/* ------------------------------------------------------------------ */
/* Copy deliverables                                                   */
/* ------------------------------------------------------------------ */

function topicLabel(topic: string): string {
  return topic.trim() || 'this company';
}

export function hookOptions(topic: string, audience: string): string[] {
  const subject = topicLabel(topic);
  return [
    `Everything you were told about ${subject} is missing one number.`,
    `${subject} almost died. Here is the decision that saved it.`,
    `The most expensive mistake ${subject} ever made looked sensible at the time.`,
    `Three sentences that explain ${subject} better than a business degree.`,
    `If you are ${audience || 'building something small'}, this is the part of ${subject} worth stealing.`,
  ];
}

export function titleOptions(topic: string): string[] {
  const subject = topicLabel(topic);
  return [
    `How ${subject} survived its worst year`,
    `${subject}: the decision nobody priced in`,
    `What ${subject} understood too late`,
  ];
}

export function thumbnailTextFor(topic: string): string {
  const words = topicLabel(topic).toUpperCase().split(/\s+/).slice(0, 3).join(' ');
  return words || 'THE DECISION';
}

export function hashtagsFor(topic: string, mode: ContentMode): string[] {
  const base = topicLabel(topic)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => `#${word}`);
  const modeTags =
    archetypeForMode(mode) === 'sales'
      ? ['#marketing', '#business']
      : archetypeForMode(mode) === 'story'
        ? ['#businessstory', '#finance']
        : ['#explained', '#economics'];
  return Array.from(new Set([...base, ...modeTags, '#ascendcc'])).slice(0, 5);
}

export function buildContentPackage(project: Project): ContentPackage {
  const verifyCount = project.scenes.filter((scene) => /\[VERIFY\]/i.test(scene.voiceOver)).length;
  return {
    hooks: hookOptions(project.topic, project.audience),
    titles: titleOptions(project.topic),
    caption: `${project.script.hook || hookOptions(project.topic, project.audience)[0]} ${project.topic ? `— a short breakdown of ${project.topic}.` : ''}`.trim(),
    hashtags: hashtagsFor(project.topic, project.contentMode),
    thumbnailText: thumbnailTextFor(project.topic),
    assetList: Array.from(
      new Set(
        project.scenes.flatMap((scene) =>
          scene.layers.map((layer) =>
            `${layer.label} (${layer.kind}${layer.refId ? `: ${layer.refId}` : ''})`,
          ),
        ),
      ),
    ).join(', '),
    soundNotes: Array.from(new Set(project.scenes.map((scene) => scene.sfx).filter(Boolean))).join(' · '),
    factCheckNotes:
      verifyCount > 0
        ? `${verifyCount} of ${project.scenes.length} scenes still contain [VERIFY] slots. The script has not been fact-checked by AscendCC.`
        : 'No [VERIFY] markers found. Confirm every figure against a primary source before publishing.',
    callToAction: project.script.cta || 'Follow for the next breakdown.',
  };
}

/* ------------------------------------------------------------------ */
/* Ideas                                                               */
/* ------------------------------------------------------------------ */

export function ideaAngles(topic: string): Idea[] {
  const subject = topicLabel(topic);
  const angles: { title: string; angle: string; category: string; hook: string }[] = [
    {
      title: `${subject}: the near-collapse`,
      angle: 'Find the moment the business almost failed, then the decision that changed it.',
      category: 'Business',
      hook: `${subject} almost died. The rescue was boring.`,
    },
    {
      title: `The number behind ${subject}`,
      angle: 'One number, its year, its source, and why it matters more than the headline.',
      category: 'Wealth',
      hook: 'One number explains the whole story.',
    },
    {
      title: `What ${subject} got right too late`,
      angle: 'A timing story: the right move, made years after it was obvious.',
      category: 'Strategy',
      hook: 'They were right. They were also late.',
    },
    {
      title: `${subject} versus the obvious rival`,
      angle: 'A fair comparison with two documented differences and one honest caveat.',
      category: 'Economics',
      hook: 'Two companies, one structural difference.',
    },
    {
      title: `The myth about ${subject}`,
      angle: 'Quote the popular claim, then test it against the primary record.',
      category: 'Psychology',
      hook: 'The popular version is wrong in a specific way.',
    },
    {
      title: `${subject}: what a beginner should copy`,
      angle: 'Extract one transferable behaviour. No guarantees, no hype.',
      category: 'Discipline',
      hook: 'You cannot copy the outcome. You can copy the behaviour.',
    },
  ];
  return angles.map((angle) => ({
    id: uid('idea'),
    title: angle.title,
    angle: angle.angle,
    category: angle.category,
    hook: angle.hook,
    createdAt: Date.now(),
    archived: false,
  }));
}

export const SERIES_IDEAS: string[] = [
  'One Decision — the single choice that changed a company.',
  'Filed vs Reported — what the filing said, what the headline said.',
  'Cheap Advantage — boring operational edges that compound.',
  'The Expensive Lesson — failures priced in real money.',
  'Two Numbers — a weekly comparison of a claim and its source.',
  'Quiet Monopolies — businesses you use without noticing.',
  'Incentive Maps — why sensible people made terrible choices.',
  'Founder Maths — the arithmetic behind a famous decision.',
  'Priced In — how markets and people misread the same news.',
  'Small Discipline — one habit, one documented effect.',
];

/* ------------------------------------------------------------------ */
/* 30-day plan                                                         */
/* ------------------------------------------------------------------ */

export const DEFAULT_PILLARS = ['Wealth', 'Business', 'Economics', 'Psychology', 'Discipline', 'Technology', 'Sales'];

export function thirtyDayPlan(
  pillars: string[],
  startISO: string,
  platform: Platform,
  existing: CalendarEntry[],
): CalendarEntry[] {
  const activePillars = pillars.length ? pillars : DEFAULT_PILLARS;
  const start = new Date(`${startISO}T09:00:00`);
  const formats = ['Documentary', 'Breakdown', 'Myth test', 'Comparison', 'Lesson'];
  const created: CalendarEntry[] = [];
  for (let day = 0; day < 30; day += 1) {
    const date = isoDate(addDays(start, day));
    if (existing.some((entry) => entry.date === date)) continue;
    const pillar = activePillars[day % activePillars.length];
    const format = formats[Math.floor(day / activePillars.length) % formats.length];
    created.push(
      createCalendarEntry({
        date,
        title: `${pillar} — ${format.toLowerCase()} #${day + 1}`,
        pillar,
        platform,
        status: 'scheduled',
        notes: 'Replace with a specific topic before scripting. One video per day.',
      }),
    );
  }
  return created;
}
