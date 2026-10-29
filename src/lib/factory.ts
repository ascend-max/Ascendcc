import type {
  AppState,
  Asset,
  AudioTrack,
  CalendarEntry,
  ContentPackage,
  LayerAnimation,
  MotionPresetId,
  Project,
  Scene,
  SceneLayer,
  Script,
  Settings,
  SalesPlan,
  Direction,
} from '../types';
import { uid } from './id';
import { MASCOT_ID } from './characters';
import { sequenceScenes } from './sequence';

export function defaultSettings(): Settings {
  return {
    creatorName: 'Creator',
    brandName: 'Ascend',
    slogan: 'Become greater than yesterday.',
    defaultPlatform: 'youtube-shorts',
    defaultDuration: 45,
    defaultOrientation: '9:16',
    accentColor: '#ff5470',
    cigarette: true,
    smoke: false,
    storageWarningAccepted: false,
    ai: {
      enabled: false,
      provider: 'none',
      endpoint: '',
      model: '',
      note: 'No AI provider is configured. AscendCC works entirely offline with structured templates.',
    },
  };
}

export function emptySalesPlan(): SalesPlan {
  return {
    audience: '',
    problem: '',
    outcome: '',
    awarenessLevel: 'problem-aware',
    objections: '',
    buyingContext: '',
    offer: '',
    price: '',
    evidence: '',
    desiredAction: '',
    valueProposition: '',
    positioning: '',
    hooks: [],
    variations: [],
    abTests: [],
    steps: [
      { id: uid('step'), step: 'Attention', included: true, content: '' },
      { id: uid('step'), step: 'Problem', included: true, content: '' },
      { id: uid('step'), step: 'Stakes', included: true, content: '' },
      { id: uid('step'), step: 'Explanation', included: true, content: '' },
      { id: uid('step'), step: 'Solution', included: false, content: '' },
      { id: uid('step'), step: 'Evidence', included: false, content: '' },
      { id: uid('step'), step: 'Objections', included: false, content: '' },
      { id: uid('step'), step: 'Offer', included: false, content: '' },
      { id: uid('step'), step: 'Call to action', included: true, content: '' },
    ],
  };
}

export function emptyPackage(): ContentPackage {
  return {
    hooks: [],
    titles: [],
    caption: '',
    hashtags: [],
    thumbnailText: '',
    assetList: '',
    soundNotes: '',
    factCheckNotes: '',
    callToAction: '',
  };
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

export function createAnimation(
  preset: MotionPresetId = 'popIn',
  start = 0,
  duration = 0.5,
  overrides: Partial<LayerAnimation> = {},
): LayerAnimation {
  return {
    id: uid('anim'),
    preset,
    start,
    duration,
    loop: false,
    strength: 0.5,
    easing: 'easeOut',
    direction: 'left' as Direction,
    ...overrides,
  };
}

export function createLayer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: uid('layer'),
    kind: 'shape',
    label: 'New layer',
    refId: '',
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    opacity: 1,
    z: 1,
    color: '#1a1a1c',
    text: '',
    pose: 'neutral',
    expression: 'neutral',
    mouth: 'closed',
    animations: [],
    ...overrides,
  };
}

export function createScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: uid('scene'),
    title: 'New scene',
    duration: 4,
    start: 0,
    end: 4,
    voiceOver: '',
    onScreenText: '',
    visual: '',
    motion: '',
    camera: 'static',
    cameraIntensity: 0.5,
    transition: 'cut',
    transitionDuration: 0.3,
    sfx: '',
    music: '',
    assetRefs: [],
    layers: [],
    captions: [],
    lipSync: { enabled: false, source: 'amplitude', events: [] },
    interstitial: {
      enabled: false,
      text: '',
      enter: 'fade',
      hold: 1.4,
      exit: 'fade',
      sfx: '',
      nextConnection: '',
    },
    audioAssetId: '',
    ...overrides,
  };
}

export interface ProjectInput {
  name: string;
  topic?: string;
  audience?: string;
  objective?: string;
  platform?: Settings['defaultPlatform'];
  durationSec?: number;
  contentMode?: Project['contentMode'];
  orientation?: Project['orientation'];
}

export function createProject(input: ProjectInput, settings: Settings = defaultSettings()): Project {
  const now = Date.now();
  const durationSec = input.durationSec ?? settings.defaultDuration;
  const scenes = sequenceScenes([createScene({ duration: durationSec, title: 'Scene 1' })]);
  return {
    id: uid('proj'),
    name: input.name.trim() || 'Untitled project',
    topic: input.topic ?? '',
    audience: input.audience ?? '',
    objective: input.objective ?? '',
    platform: input.platform ?? settings.defaultPlatform,
    contentMode: input.contentMode ?? 'educational',
    format: 'Animated documentary',
    durationSec,
    orientation: input.orientation ?? settings.defaultOrientation,
    narrationStyle: 'Calm, dry, confident',
    visualStyle: 'Monochrome characters, selective colour accents',
    status: 'idea',
    researchStatus: 'none',
    createdAt: now,
    updatedAt: now,
    archived: false,
    script: emptyScript(),
    scenes,
    audioTracks: [],
    claims: [],
    sources: [],
    researchNotes: [],
    salesPlan: emptySalesPlan(),
    package: emptyPackage(),
    settings: { colourAccents: true, captionMode: 'auto', safeAreaGuides: false },
  };
}

export function duplicateProject(project: Project): Project {
  const now = Date.now();
  const sceneMap = new Map<string, string>();
  const scenes = project.scenes.map((scene) => {
    const id = uid('scene');
    sceneMap.set(scene.id, id);
    return {
      ...scene,
      id,
      layers: scene.layers.map((layer) => ({ ...layer, id: uid('layer'), animations: layer.animations.map((a) => ({ ...a, id: uid('anim') })) })),
      captions: scene.captions.map((c) => ({ ...c, id: uid('cap') })),
      lipSync: { ...scene.lipSync, events: [...scene.lipSync.events] },
    };
  });
  return {
    ...project,
    id: uid('proj'),
    name: `${project.name} (copy)`,
    createdAt: now,
    updatedAt: now,
    archived: false,
    scenes,
    audioTracks: project.audioTracks.map((track) => ({
      ...track,
      id: uid('track'),
      sceneId: track.sceneId ? sceneMap.get(track.sceneId) : undefined,
    })),
    claims: project.claims.map((claim) => ({ ...claim, id: uid('claim'), sceneId: claim.sceneId ? sceneMap.get(claim.sceneId) : undefined })),
    sources: project.sources.map((source) => ({ ...source, id: uid('source') })),
  };
}

export function createAudioTrack(overrides: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: uid('track'),
    kind: 'voice',
    label: 'Narration',
    assetId: '',
    startTime: 0,
    gain: 1,
    ...overrides,
  };
}

export function createAsset(overrides: Partial<Asset>): Asset {
  return {
    id: uid('asset'),
    name: 'Untitled asset',
    category: 'prop',
    kind: 'image',
    mime: '',
    size: 0,
    transparent: false,
    colorNotes: '',
    usageNotes: '',
    createdAt: Date.now(),
    ...overrides,
  };
}

export function createCalendarEntry(overrides: Partial<CalendarEntry>): CalendarEntry {
  return {
    id: uid('cal'),
    date: new Date().toISOString().slice(0, 10),
    title: 'New entry',
    pillar: 'Wealth',
    platform: 'youtube-shorts',
    status: 'scheduled',
    notes: '',
    ...overrides,
  };
}

export function initialState(): AppState {
  return {
    version: 1,
    projects: [],
    characters: [],
    assets: [],
    ideas: [],
    calendar: [],
    metrics: [],
    settings: defaultSettings(),
  };
}

/** Initial project payload with the mascot already on stage — the Stage 2 acceptance path. */
export function starterScene(settings: Settings): Scene {
  return createScene({
    title: 'Hook',
    duration: 4,
    voiceOver: '',
    visual: 'Marlowe stands centre frame against a white studio wall. One spotlight pool on the floor.',
    motion:
      'Marlowe pop-in at 0.0s over 0.4s, then idle float for the rest of the shot. Blink at 1.4s and 3.1s. Camera pushes in slowly for the full 4 seconds. Cut to the next scene on the last syllable.',
    layers: [
      createLayer({
        kind: 'shape',
        label: 'Backdrop',
        x: 0.5,
        y: 0.5,
        scale: 1,
        z: 0,
        color: '#f4f4f5',
        animations: [createAnimation('fadeIn', 0, 0.5, { strength: 0.4 })],
      }),
      createLayer({
        kind: 'character',
        label: 'Marlowe',
        refId: MASCOT_ID,
        x: 0.5,
        y: 0.82,
        scale: 1,
        z: 2,
        pose: 'neutral',
        expression: 'confident',
        animations: [
          createAnimation('popIn', 0, 0.4, { easing: 'spring' }),
          createAnimation('float', 0.4, 4, { loop: true, strength: 0.25 }),
          createAnimation('blink', 1.4, 2.6, { loop: true }),
          createAnimation('talk', 0.2, 3.6, { loop: true }),
        ],
      }),
    ],
    camera: 'pushIn',
    cameraIntensity: 0.6,
    transition: 'cut',
  });
}

