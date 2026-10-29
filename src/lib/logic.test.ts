import { describe, expect, it } from 'vitest';
import {
  buildCaptionGroups,
  buildSrt,
  flattenCaptions,
  markWords,
} from './captions';
import { createAnimation, createLayer, createProject, createScene, defaultSettings } from './factory';
import { estimateNarrationSeconds, countWords, pacingAudit } from './script';
import { fitTimelineToDuration, moveScene, sceneAtTime, sequenceScenes, timelineDuration } from './sequence';
import { sampleCamera, sampleLayer } from './motion';
import { buildContentPackage, generateStoryboard, thirtyDayPlan } from './templates';
import { productionPackageMarkdown } from './exporter';

const settings = defaultSettings();

describe('timeline sequencing', () => {
  it('derives start and end times from durations', () => {
    const scenes = sequenceScenes([
      createScene({ title: 'a', duration: 2 }),
      createScene({ title: 'b', duration: 3 }),
    ]);
    expect(scenes[0].start).toBe(0);
    expect(scenes[0].end).toBe(2);
    expect(scenes[1].start).toBe(2);
    expect(scenes[1].end).toBe(5);
  });

  it('fits a timeline to a target duration', () => {
    const scenes = sequenceScenes([
      createScene({ title: 'a', duration: 3 }),
      createScene({ title: 'b', duration: 5 }),
    ]);
    const fitted = fitTimelineToDuration(scenes, 20);
    const total = fitted.reduce((sum, scene) => sum + scene.duration, 0);
    expect(Math.abs(total - 20)).toBeLessThan(0.2);
  });

  it('reorders scenes and re-sequences', () => {
    const scenes = sequenceScenes([
      createScene({ title: 'a', duration: 1 }),
      createScene({ title: 'b', duration: 1 }),
    ]);
    const moved = moveScene(scenes, scenes[1].id, -1);
    expect(moved[0].title).toBe('b');
    expect(moved[0].start).toBe(0);
  });

  it('resolves the scene at an absolute time', () => {
    const project = createProject({ name: 'Test', durationSec: 10 }, settings);
    project.scenes = sequenceScenes([
      createScene({ title: 'a', duration: 4 }),
      createScene({ title: 'b', duration: 6 }),
    ]);
    expect(timelineDuration(project)).toBe(10);
    const at = sceneAtTime(project, 5);
    expect(at?.scene.title).toBe('b');
    expect(at?.localTime).toBe(1);
  });
});

describe('captions', () => {
  it('emphasises a meaningful word, not every word', () => {
    const words = markWords('Revenue fell 43% in one year');
    const emphasised = words.filter((word) => word.emphasis);
    expect(emphasised).toHaveLength(1);
    expect(emphasised[0].text).toContain('43');
  });

  it('groups narration into short caption chunks flagged as estimated', () => {
    const groups = buildCaptionGroups('You know the name. You do not know how close it came to ending.', { maxWords: 4 });
    expect(groups.length).toBeGreaterThan(1);
    groups.forEach((group) => expect(group.words.length).toBeLessThanOrEqual(5));
    expect(groups[0].estimated).toBe(true);
    expect(groups[0].start).toBeGreaterThanOrEqual(0);
  });

  it('marks timing as measured when a real recording duration is supplied', () => {
    const groups = buildCaptionGroups('This is a measured take of narration.', { measuredDuration: 3 });
    expect(groups.every((group) => group.estimated === false)).toBe(true);
    expect(groups[groups.length - 1].end).toBeLessThanOrEqual(3.0001);
  });

  it('exports valid SRT timestamps', () => {
    const project = createProject({ name: 'SRT', durationSec: 5 }, settings);
    project.scenes = sequenceScenes([
      createScene({
        title: 'one',
        duration: 5,
        captions: buildCaptionGroups('Hello there and welcome back.', { startOffset: 0.2 }),
      }),
    ]);
    const srt = buildSrt(project);
    expect(srt).toContain('1\n');
    expect(srt).toMatch(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/);
    expect(flattenCaptions(project).length).toBeGreaterThan(0);
  });
});

describe('script estimation', () => {
  it('counts words and estimates narration length', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('   ')).toBe(0);
    expect(estimateNarrationSeconds('')).toBe(0);
    expect(estimateNarrationSeconds('one two three four five')).toBeGreaterThan(1);
  });

  it('flags narration that cannot fit the timeline', () => {
    const project = createProject({ name: 'Pacing', durationSec: 10 }, settings);
    project.scenes = sequenceScenes([createScene({ title: 'one', duration: 10 })]);
    project.scenes[0].voiceOver = Array.from({ length: 120 }, () => 'word').join(' ');
    const audit = pacingAudit(project);
    expect(audit.status).toBe('over');
    expect(audit.advice.toLowerCase()).toContain('cut');
  });
});

describe('animation sampling', () => {
  it('hides a layer before a pop-in starts and shows it afterwards', () => {
    const layer = createLayer({ animations: [createAnimation('popIn', 1, 0.4)] });
    expect(sampleLayer(layer, 0.2).opacity).toBe(0);
    expect(sampleLayer(layer, 2).opacity).toBe(1);
  });

  it('produces a blink value inside the blink window', () => {
    const layer = createLayer({ animations: [createAnimation('blink', 0, 3, { loop: true })] });
    expect(sampleLayer(layer, 0.05).blink).toBeGreaterThan(0);
    expect(sampleLayer(layer, 0.9).blink).toBe(0);
  });

  it('applies a camera push-in over the scene duration', () => {
    const scene = createScene({ camera: 'pushIn', cameraIntensity: 1, duration: 4 });
    expect(sampleCamera(scene, 0).zoom).toBeCloseTo(1, 2);
    expect(sampleCamera(scene, 4).zoom).toBeGreaterThan(1.1);
    expect(sampleCamera({ ...scene, camera: 'static' }, 4).zoom).toBe(1);
  });

  it('holds a pointing pose only inside the gesture window', () => {
    const layer = createLayer({
      pose: 'neutral',
      animations: [createAnimation('point', 1, 1)],
    });
    expect(sampleLayer(layer, 0.2).pose).toBeUndefined();
    expect(sampleLayer(layer, 1.4).pose).toBe('pointing');
    expect(sampleLayer(layer, 3).pose).toBeUndefined();
  });
});

describe('storyboard generation', () => {
  const scenes = generateStoryboard({
    topic: 'Acme Corporation',
    audience: 'beginners',
    durationSec: 45,
    mode: 'documentary',
    platform: 'youtube-shorts',
    settings,
  });

  it('creates a full narrative with explicit timing that sums to the target', () => {
    expect(scenes.length).toBeGreaterThanOrEqual(8);
    const total = scenes.reduce((sum, scene) => sum + scene.duration, 0);
    expect(Math.abs(total - 45)).toBeLessThan(0.2);
    scenes.forEach((scene) => {
      expect(scene.duration).toBeGreaterThan(0);
      expect(scene.start).toBeGreaterThanOrEqual(0);
      expect(scene.end).toBeGreaterThan(scene.start);
    });
  });

  it('gives every shot explicit motion and a camera instruction', () => {
    scenes.forEach((scene) => {
      expect(scene.motion.length).toBeGreaterThan(40);
      expect(scene.motion).toMatch(/Camera/);
      expect(scene.visual.length).toBeGreaterThan(20);
    });
  });

  it('marks unsourced factual slots with [VERIFY] rather than inventing facts', () => {
    expect(scenes.some((scene) => scene.voiceOver.includes('[VERIFY]'))).toBe(true);
  });

  it('stages layers and captions for non-interstitial shots', () => {
    const normal = scenes.filter((scene) => !scene.interstitial.enabled);
    expect(normal.length).toBeGreaterThan(5);
    normal.forEach((scene) => {
      expect(scene.layers.some((layer) => layer.kind === 'character')).toBe(true);
      expect(scene.layers.some((layer) => layer.animations.length > 0)).toBe(true);
      expect(scene.captions.length).toBeGreaterThan(0);
    });
  });

  it('builds editable deliverables and a markdown production package', () => {
    const project = createProject({ name: 'Package', topic: 'Acme Corporation', durationSec: 45 }, settings);
    project.scenes = scenes;
    const pkg = buildContentPackage(project);
    expect(pkg.hooks).toHaveLength(5);
    expect(pkg.titles).toHaveLength(3);
    expect(pkg.hashtags.length).toBeGreaterThan(0);
    expect(pkg.hashtags.length).toBeLessThanOrEqual(5);
    const markdown = productionPackageMarkdown(project);
    expect(markdown).toContain('## Storyboard');
    expect(markdown).toContain('| Time |');
    expect(markdown).toContain('[VERIFY]');
  });
});

describe('content calendar planning', () => {
  it('generates 30 daily entries and skips existing dates', () => {
    const first = thirtyDayPlan(['Wealth', 'Business'], '2026-01-01', 'youtube-shorts', []);
    expect(first).toHaveLength(30);
    expect(first[0].date).toBe('2026-01-01');
    expect(first[29].date).toBe('2026-01-30');
    const second = thirtyDayPlan(['Wealth'], '2026-01-01', 'youtube-shorts', first);
    expect(second).toHaveLength(0);
  });
});
