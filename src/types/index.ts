/**
 * AscendCC domain model.
 *
 * Every persisted shape lives here so the data layer, business logic and UI
 * stay in agreement. These types are intentionally plain data (JSON-safe) so a
 * cloud database can replace localStorage later without rewriting the app.
 */

export type ID = string;

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export type Platform =
  | 'youtube-shorts'
  | 'tiktok'
  | 'instagram-reels'
  | 'youtube'
  | 'linkedin';

export type Orientation = '9:16' | '16:9' | '1:1';

export type ProjectStatus =
  | 'idea'
  | 'research'
  | 'script'
  | 'storyboard'
  | 'assets'
  | 'voice'
  | 'animation'
  | 'review'
  | 'published';

export type ResearchStatus = 'none' | 'in-progress' | 'verified';

export type ContentMode =
  | 'educational'
  | 'documentary'
  | 'product-demo'
  | 'comparison'
  | 'brand-story'
  | 'promotional'
  | 'direct-response'
  | 'founder-story'
  | 'case-study'
  | 'lead-generation';

export interface ScriptVariation {
  id: ID;
  label: string;
  hook: string;
  body: string;
  cta: string;
}

export interface OutlineBeat {
  id: ID;
  label: string;
  summary: string;
}

export interface Script {
  title: string;
  hook: string;
  narration: string;
  cta: string;
  emphasis: string;
  factCheckNotes: string;
  variations: ScriptVariation[];
  outline: OutlineBeat[];
}

export interface Project {
  id: ID;
  name: string;
  topic: string;
  audience: string;
  objective: string;
  platform: Platform;
  contentMode: ContentMode;
  format: string;
  durationSec: number;
  orientation: Orientation;
  narrationStyle: string;
  visualStyle: string;
  status: ProjectStatus;
  researchStatus: ResearchStatus;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  script: Script;
  scenes: Scene[];
  audioTracks: AudioTrack[];
  claims: Claim[];
  sources: Source[];
  researchNotes: ResearchNote[];
  salesPlan: SalesPlan;
  package: ContentPackage;
  settings: ProjectRenderSettings;
}

export interface ProjectRenderSettings {
  colourAccents: boolean;
  captionMode: 'auto' | 'manual' | 'off';
  safeAreaGuides: boolean;
}

/* ------------------------------------------------------------------ */
/* Research                                                            */
/* ------------------------------------------------------------------ */

export type ClaimStatus = 'unverified' | 'in-progress' | 'verified' | 'disputed' | 'opinion';

export interface Claim {
  id: ID;
  text: string;
  status: ClaimStatus;
  sourceIds: ID[];
  notes: string;
  sceneId?: ID;
  createdAt: number;
}

export interface Source {
  id: ID;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  accessedAt: string;
  primary: boolean;
  notes: string;
}

export interface ResearchNote {
  id: ID;
  text: string;
  createdAt: number;
}

/* ------------------------------------------------------------------ */
/* Storyboard + scene animation                                        */
/* ------------------------------------------------------------------ */

export type Pose =
  | 'neutral'
  | 'talking'
  | 'thinking'
  | 'sideways'
  | 'smirk'
  | 'surprised'
  | 'disappointed'
  | 'pointing'
  | 'openhand'
  | 'adjustSuit'
  | 'walking'
  | 'sitting'
  | 'directGaze';

export type Expression =
  | 'neutral'
  | 'confident'
  | 'smirk'
  | 'surprised'
  | 'disappointed'
  | 'thinking'
  | 'alert';

export type MouthPose = 'closed' | 'open' | 'wide' | 'rounded' | 'teeth' | 'rest';

export type CameraMove =
  | 'static'
  | 'pushIn'
  | 'pullOut'
  | 'panLeft'
  | 'panRight'
  | 'drift';

export type SceneTransition = 'cut' | 'fade' | 'slideLeft' | 'slideUp' | 'wipe' | 'zoom';

export type MotionPresetId =
  | 'none'
  | 'popIn'
  | 'fadeIn'
  | 'fadeOut'
  | 'slideIn'
  | 'slideOut'
  | 'scaleBounce'
  | 'pushIn'
  | 'pullOut'
  | 'float'
  | 'driftLeft'
  | 'driftRight'
  | 'parallax'
  | 'loopRotate'
  | 'progressive'
  | 'blink'
  | 'talk'
  | 'headBob'
  | 'point'
  | 'openhand'
  | 'adjustSuit'
  | 'shake'
  | 'pulse'
  | 'machine';

export type EasingId = 'linear' | 'easeOut' | 'easeIn' | 'easeInOut' | 'spring';

export type Direction = 'left' | 'right' | 'up' | 'down';

export type LayerKind = 'character' | 'image' | 'shape' | 'text' | 'effect';

export type EffectKind = 'smoke' | 'dust' | 'speedlines' | 'grain' | 'vignette' | 'cracks';

export interface LayerAnimation {
  id: ID;
  preset: MotionPresetId;
  /** Seconds, relative to the start of the scene. */
  start: number;
  duration: number;
  loop: boolean;
  /** 0..1 intensity used differently by each preset (distance, amplitude, etc). */
  strength: number;
  easing: EasingId;
  direction: Direction;
}

export interface SceneLayer {
  id: ID;
  kind: LayerKind;
  label: string;
  /** Character id, asset id, or effect name depending on `kind`. */
  refId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  z: number;
  color: string;
  text: string;
  pose: Pose;
  expression: Expression;
  mouth: MouthPose;
  animations: LayerAnimation[];
}

export interface CaptionWord {
  text: string;
  emphasis: boolean;
}

export interface CaptionGroup {
  id: ID;
  words: CaptionWord[];
  /** Seconds, relative to the start of the scene. */
  start: number;
  end: number;
  estimated: boolean;
}

export interface LipSyncEvent {
  t: number;
  pose: MouthPose;
}

export interface LipSyncTrack {
  enabled: boolean;
  /** `amplitude` = derived from audio loudness (not phonetic). `manual` = edited by hand. */
  source: 'amplitude' | 'manual';
  events: LipSyncEvent[];
}

export interface InterstitialCard {
  enabled: boolean;
  text: string;
  enter: string;
  hold: number;
  exit: string;
  sfx: string;
  nextConnection: string;
}

export interface Scene {
  id: ID;
  title: string;
  /** Seconds. Source of truth for scene length; start/end are derived. */
  duration: number;
  /** Derived by sequenceScenes(). Kept in state so the table can render without recomputation. */
  start: number;
  end: number;
  voiceOver: string;
  onScreenText: string;
  visual: string;
  motion: string;
  camera: CameraMove;
  cameraIntensity: number;
  transition: SceneTransition;
  transitionDuration: number;
  sfx: string;
  music: string;
  assetRefs: string[];
  layers: SceneLayer[];
  captions: CaptionGroup[];
  lipSync: LipSyncTrack;
  interstitial: InterstitialCard;
  audioAssetId: string;
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

export type AudioTrackKind = 'voice' | 'music' | 'sfx';

export interface AudioTrack {
  id: ID;
  kind: AudioTrackKind;
  label: string;
  assetId: string;
  /** Seconds on the project timeline where playback starts. */
  startTime: number;
  gain: number;
  sceneId?: ID;
}

/* ------------------------------------------------------------------ */
/* Characters                                                          */
/* ------------------------------------------------------------------ */

export interface Character {
  id: ID;
  name: string;
  role: string;
  concept: string;
  silhouette: string;
  proportions: string;
  face: string;
  outfit: string;
  colorRules: string[];
  expressions: string[];
  poses: string[];
  animationRules: string[];
  namingConvention: string;
  cigarette: boolean;
  smoke: boolean;
  notes: string;
  accentColor: string;
  builtin: boolean;
  createdAt: number;
  referenceStatus: string;
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export type AssetCategory =
  | 'character'
  | 'pose'
  | 'expression'
  | 'mouth'
  | 'prop'
  | 'background'
  | 'building'
  | 'money'
  | 'vehicle'
  | 'machine'
  | 'chart'
  | 'effect'
  | 'sfx'
  | 'music'
  | 'voice'
  | 'scene-art';

export type AssetKind = 'image' | 'audio' | 'other';

export interface Asset {
  id: ID;
  name: string;
  category: AssetCategory;
  kind: AssetKind;
  blobId?: ID;
  projectId?: ID;
  characterId?: ID;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  /** Measured duration for audio assets, decoded in the browser. */
  duration?: number;
  transparent: boolean;
  colorNotes: string;
  usageNotes: string;
  createdAt: number;
}

/* ------------------------------------------------------------------ */
/* Ideas, calendar, analytics                                          */
/* ------------------------------------------------------------------ */

export interface Idea {
  id: ID;
  title: string;
  angle: string;
  category: string;
  hook: string;
  createdAt: number;
  archived: boolean;
}

export type CalendarStatus =
  | 'scheduled'
  | 'research'
  | 'script'
  | 'production'
  | 'published'
  | 'skipped';

export interface CalendarEntry {
  id: ID;
  date: string;
  title: string;
  pillar: string;
  platform: Platform;
  status: CalendarStatus;
  projectId?: ID;
  notes: string;
}

export interface VideoMetric {
  id: ID;
  title: string;
  projectId?: ID;
  platform: Platform;
  publishedAt: string;
  views: number;
  holdRate3s: number;
  avgWatchSec: number;
  avgPercentViewed: number;
  completionRate: number;
  shares: number;
  likes: number;
  comments: number;
  followersGained: number;
  topic: string;
  hook: string;
  sample: boolean;
}

/* ------------------------------------------------------------------ */
/* Sales                                                               */
/* ------------------------------------------------------------------ */

export interface SalesPlan {
  audience: string;
  problem: string;
  outcome: string;
  awarenessLevel: 'unaware' | 'problem-aware' | 'solution-aware' | 'product-aware' | 'most-aware';
  objections: string;
  buyingContext: string;
  offer: string;
  price: string;
  evidence: string;
  desiredAction: string;
  valueProposition: string;
  positioning: string;
  hooks: string[];
  variations: string[];
  abTests: string[];
  steps: SalesStep[];
}

export interface SalesStep {
  id: ID;
  step: string;
  included: boolean;
  content: string;
}

/* ------------------------------------------------------------------ */
/* Content package                                                     */
/* ------------------------------------------------------------------ */

export interface ContentPackage {
  hooks: string[];
  titles: string[];
  caption: string;
  hashtags: string[];
  thumbnailText: string;
  assetList: string;
  soundNotes: string;
  factCheckNotes: string;
  callToAction: string;
}

/* ------------------------------------------------------------------ */
/* Settings + app state                                                */
/* ------------------------------------------------------------------ */

export interface AIConfig {
  /** Always false in this release. Kept for the future provider interface. */
  enabled: boolean;
  provider: 'none' | 'custom';
  endpoint: string;
  model: string;
  note: string;
}

export interface Settings {
  creatorName: string;
  brandName: string;
  slogan: string;
  defaultPlatform: Platform;
  defaultDuration: number;
  defaultOrientation: Orientation;
  accentColor: string;
  cigarette: boolean;
  smoke: boolean;
  storageWarningAccepted: boolean;
  ai: AIConfig;
}

export interface AppState {
  version: number;
  projects: Project[];
  characters: Character[];
  assets: Asset[];
  ideas: Idea[];
  calendar: CalendarEntry[];
  metrics: VideoMetric[];
  settings: Settings;
}

export type RouteId =
  | 'dashboard'
  | 'projects'
  | 'research'
  | 'ideas'
  | 'scripts'
  | 'storyboard'
  | 'characters'
  | 'assets'
  | 'animation'
  | 'voice'
  | 'sales'
  | 'calendar'
  | 'analytics'
  | 'settings';
