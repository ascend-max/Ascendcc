import React, { useEffect, useMemo, useState } from 'react';
import type { CameraMove, CaptionGroup, Project, Scene, SceneTransition } from '../types';
import { ProjectGate } from '../components/ProjectGate';
import { ScenePlayer } from '../components/ScenePlayer';
import { useStore } from '../state/store';
import { createScene } from '../lib/factory';
import { fitTimelineToDuration, moveScene, sequenceScenes } from '../lib/sequence';
import { buildCaptionGroups, captionText, markWords } from '../lib/captions';
import { estimateNarrationSeconds } from '../lib/script';
import { describeLayerMotion } from '../lib/motion';
import { formatTimecode } from '../lib/time';
import { uid } from '../lib/id';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Grid,
  Notice,
  NumberInput,
  PageHeader,
  Select,
  Slider,
  TextArea,
  TextInput,
  Toggle,
} from '../components/ui';
import { Icon } from '../components/Icon';

const CAMERAS: { value: CameraMove; label: string }[] = [
  { value: 'static', label: 'Static' },
  { value: 'pushIn', label: 'Push in' },
  { value: 'pullOut', label: 'Pull out' },
  { value: 'panLeft', label: 'Pan left' },
  { value: 'panRight', label: 'Pan right' },
  { value: 'drift', label: 'Slow drift' },
];

const TRANSITIONS: { value: SceneTransition; label: string }[] = [
  { value: 'cut', label: 'Cut' },
  { value: 'fade', label: 'Fade' },
  { value: 'slideLeft', label: 'Slide left' },
  { value: 'slideUp', label: 'Slide up' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'zoom', label: 'Zoom' },
];

function hashParam(key: string): string {
  const hash = window.location.hash;
  const index = hash.indexOf('?');
  if (index < 0) return '';
  return new URLSearchParams(hash.slice(index + 1)).get(key) ?? '';
}

export function StoryboardStudio(): React.ReactElement {
  return (
    <ProjectGate feature="storyboarding">
      {(project) => <StoryboardWorkspace project={project} />}
    </ProjectGate>
  );
}

function StoryboardWorkspace({ project }: { project: Project }): React.ReactElement {
  const { updateProject, toast } = useStore();
  const initial = useMemo(() => hashParam('scene'), []);
  const [selectedSceneId, setSelectedSceneId] = useState<string>(initial || project.scenes[0]?.id || '');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!project.scenes.some((scene) => scene.id === selectedSceneId)) {
      setSelectedSceneId(project.scenes[0]?.id ?? '');
    }
  }, [project.scenes, selectedSceneId]);

  const scene = project.scenes.find((item) => item.id === selectedSceneId);
  const total = project.scenes.reduce((sum, item) => sum + item.duration, 0);
  const drift = Math.round((total - project.durationSec) * 10) / 10;

  const patchScene = (sceneId: string, patch: Partial<Scene>) => {
    updateProject(project.id, (item) => ({
      ...item,
      scenes: sequenceScenes(item.scenes.map((entry) => (entry.id === sceneId ? { ...entry, ...patch } : entry))),
    }));
  };

  const addScene = () => {
    const next = createScene({ title: `Scene ${project.scenes.length + 1}`, duration: 4 });
    updateProject(project.id, (item) => ({ ...item, scenes: sequenceScenes([...item.scenes, next]) }));
    setSelectedSceneId(next.id);
  };

  const deleteScene = (sceneId: string) => {
    updateProject(project.id, (item) => ({
      ...item,
      scenes: sequenceScenes(item.scenes.filter((entry) => entry.id !== sceneId)),
    }));
    setPendingDelete(null);
    toast('Scene deleted.', 'info');
  };

  const regenerateCaptions = (target: Scene) => {
    const groups = buildCaptionGroups(target.voiceOver, {
      maxWords: 4,
      wordsPerSecond: Math.max(
        1.8,
        target.voiceOver.trim().split(/\s+/).filter(Boolean).length / Math.max(1, target.duration * 0.85),
      ),
      startOffset: 0.15,
    }).filter((group) => group.start < target.duration);
    if (!groups.length) {
      toast('Add voice-over text to this scene first.', 'warning');
      return;
    }
    patchScene(target.id, { captions: groups });
    toast('Caption groups generated (estimated from word count).', 'success');
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Shot planning"
        title="Storyboard Studio"
        description="Every scene needs explicit motion: what moves, how, when it starts, how long it lasts, and how the shot ends."
        actions={
          <div className="row gap-sm wrap">
            <Button variant="ghost" onClick={() => (window.location.hash = '#/animation')}>
              Open Animation Studio
            </Button>
            <Button variant="secondary" onClick={addScene} icon={<Icon name="plus" size={16} />}>
              Add scene
            </Button>
          </div>
        }
      />

      <Grid columns={4}>
        <div className="stat">
          <span className="stat-label">Scenes</span>
          <span className="stat-value">{project.scenes.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Timeline</span>
          <span className="stat-value">{total.toFixed(1)}s</span>
          <span className="stat-hint">Target {project.durationSec}s</span>
        </div>
        <div className={`stat ${Math.abs(drift) > 0.2 ? 'is-danger' : ''}`}>
          <span className="stat-label">Difference</span>
          <span className="stat-value">{drift > 0 ? `+${drift}` : drift}s</span>
        </div>
        <div className="stat">
          <span className="stat-label">Captions</span>
          <span className="stat-value">{project.scenes.reduce((sum, item) => sum + item.captions.length, 0)}</span>
          <span className="stat-hint">Word groups</span>
        </div>
      </Grid>

      {Math.abs(drift) > 0.2 && (
        <Notice tone={drift > 0 ? 'warning' : 'info'}>
          Scene durations add up to {total.toFixed(1)}s, not the {project.durationSec}s target.{' '}
          <button
            className="link-button"
            onClick={() =>
              updateProject(project.id, (item) => ({ ...item, scenes: fitTimelineToDuration(item.scenes, item.durationSec) }))
            }
          >
            Fit durations proportionally to {project.durationSec}s
          </button>
          . Fitting rescales every scene — check the narration still fits each one.
        </Notice>
      )}

      <div className="storyboard-layout">
        <div className="scene-list">
          <div className="scene-list-head">
            <strong>Scenes</strong>
            <span className="muted small">{project.scenes.length} total</span>
          </div>
          {project.scenes.map((item, index) => (
            <button
              key={item.id}
              className={`scene-list-item ${item.id === selectedSceneId ? 'is-active' : ''}`}
              onClick={() => setSelectedSceneId(item.id)}
            >
              <span className="scene-number">{index + 1}</span>
              <span className="scene-list-body">
                <strong>{item.title}</strong>
                <span className="small muted">
                  {formatTimecode(item.start)}–{formatTimecode(item.end)} · {item.duration.toFixed(1)}s
                </span>
                <span className="small muted">
                  {item.layers.length} layers · {item.captions.length} captions · {item.transition}
                </span>
              </span>
              {item.interstitial.enabled && <Badge tone="accent">card</Badge>}
            </button>
          ))}
          {!project.scenes.length && <p className="muted small pad">No scenes yet.</p>}
        </div>

        <div className="stack">
          <ScenePlayer project={project} sceneId={scene?.id} onSelectScene={setSelectedSceneId} />

          {scene ? (
            <>
              <Card
                title={`Scene editor — ${scene.title}`}
                subtitle={`${formatTimecode(scene.start)} → ${formatTimecode(scene.end)} (${scene.duration.toFixed(1)}s)`}
                actions={
                  <div className="row gap-xs">
                    <button className="icon-button" aria-label="Move scene up" onClick={() => updateProject(project.id, (item) => ({ ...item, scenes: moveScene(item.scenes, scene.id, -1) }))}>
                      <Icon name="arrowLeft" size={16} />
                    </button>
                    <button className="icon-button" aria-label="Move scene down" onClick={() => updateProject(project.id, (item) => ({ ...item, scenes: moveScene(item.scenes, scene.id, 1) }))}>
                      <Icon name="arrowRight" size={16} />
                    </button>
                    <button className="icon-button danger" aria-label="Delete scene" onClick={() => setPendingDelete(scene.id)}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                }
              >
                <div className="stack-sm">
                  <Grid columns={3}>
                    <Field label="Title">
                      <TextInput value={scene.title} onChange={(event) => patchScene(scene.id, { title: event.target.value })} />
                    </Field>
                    <Field label="Duration (seconds)">
                      <NumberInput
                        value={scene.duration}
                        min={0.5}
                        step={0.1}
                        suffix="s"
                        onChange={(value) => patchScene(scene.id, { duration: Math.max(0.5, value) })}
                      />
                    </Field>
                    <Field label="Transition in">
                      <Select
                        value={scene.transition}
                        options={TRANSITIONS}
                        onChange={(event) => patchScene(scene.id, { transition: event.target.value as SceneTransition })}
                      />
                    </Field>
                  </Grid>

                  <Grid columns={2}>
                    <Field label="Voice-over" hint={`Estimated ${estimateNarrationSeconds(scene.voiceOver).toFixed(1)}s at 2.5 words/second.`}>
                      <TextArea rows={4} value={scene.voiceOver} onChange={(event) => patchScene(scene.id, { voiceOver: event.target.value })} />
                    </Field>
                    <Field label="On-screen text" hint="Large type in the shot. Keep it under six words.">
                      <TextArea rows={4} value={scene.onScreenText} onChange={(event) => patchScene(scene.id, { onScreenText: event.target.value })} />
                    </Field>
                    <Field label="Visual description">
                      <TextArea rows={4} value={scene.visual} onChange={(event) => patchScene(scene.id, { visual: event.target.value })} />
                    </Field>
                    <Field
                      label="Motion direction"
                      hint="What moves, how, when it starts, how long, whether it loops, how layers move independently, and the transition."
                    >
                      <TextArea rows={4} value={scene.motion} onChange={(event) => patchScene(scene.id, { motion: event.target.value })} />
                    </Field>
                  </Grid>

                  <Grid columns={3}>
                    <Field label="Camera">
                      <Select
                        value={scene.camera}
                        options={CAMERAS}
                        onChange={(event) => patchScene(scene.id, { camera: event.target.value as CameraMove })}
                      />
                    </Field>
                    <Field label="Camera intensity">
                      <Slider
                        label="Intensity"
                        min={0}
                        max={1.5}
                        step={0.1}
                        value={scene.cameraIntensity}
                        display={scene.cameraIntensity.toFixed(1)}
                        onChange={(value) => patchScene(scene.id, { cameraIntensity: value })}
                      />
                    </Field>
                    <Field label="Transition length">
                      <NumberInput
                        value={scene.transitionDuration}
                        min={0}
                        max={2}
                        step={0.1}
                        suffix="s"
                        onChange={(value) => patchScene(scene.id, { transitionDuration: value })}
                      />
                    </Field>
                    <Field label="Sound effects">
                      <TextInput value={scene.sfx} onChange={(event) => patchScene(scene.id, { sfx: event.target.value })} />
                    </Field>
                    <Field label="Music direction">
                      <TextInput value={scene.music} onChange={(event) => patchScene(scene.id, { music: event.target.value })} />
                    </Field>
                    <Field label="Asset references" hint="Comma separated labels used by the Animation Studio.">
                      <TextInput
                        value={scene.assetRefs.join(', ')}
                        onChange={(event) =>
                          patchScene(scene.id, {
                            assetRefs: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                          })
                        }
                      />
                    </Field>
                  </Grid>

                  <div className="scene-layers">
                    <div className="row-between">
                      <strong>Layers ({scene.layers.length})</strong>
                      <a className="link small" href={`#/animation?scene=${scene.id}`}>
                        Edit animation →
                      </a>
                    </div>
                    {scene.layers.length ? (
                      <ul className="layer-summary">
                        {scene.layers.map((layer) => (
                          <li key={layer.id}>
                            <Badge tone={layer.kind === 'character' ? 'accent' : 'neutral'}>{layer.kind}</Badge>
                            <strong>{layer.label}</strong>
                            <span className="muted small">{describeLayerMotion(layer)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted small">
                        This scene has no layers yet. Add Marlowe and a prop in the Animation Studio, or use the generated
                        scaffold.
                      </p>
                    )}
                  </div>

                  <Toggle
                    checked={scene.interstitial.enabled}
                    onChange={(checked) => patchScene(scene.id, { interstitial: { ...scene.interstitial, enabled: checked } })}
                    label="Black interstitial card"
                    hint="Full-screen cursive card between acts. Creates anticipation, not filler."
                  />
                  {scene.interstitial.enabled && (
                    <Grid columns={2}>
                      <Field label="Card text">
                        <TextInput
                          value={scene.interstitial.text}
                          onChange={(event) =>
                            patchScene(scene.id, { interstitial: { ...scene.interstitial, text: event.target.value } })
                          }
                        />
                      </Field>
                      <Field label="Hold (seconds)">
                        <NumberInput
                          value={scene.interstitial.hold}
                          min={0.4}
                          step={0.1}
                          suffix="s"
                          onChange={(value) =>
                            patchScene(scene.id, { interstitial: { ...scene.interstitial, hold: value } })
                          }
                        />
                      </Field>
                      <Field label="Sound effect">
                        <TextInput
                          value={scene.interstitial.sfx}
                          onChange={(event) =>
                            patchScene(scene.id, { interstitial: { ...scene.interstitial, sfx: event.target.value } })
                          }
                        />
                      </Field>
                      <Field label="Connection to next scene">
                        <TextInput
                          value={scene.interstitial.nextConnection}
                          onChange={(event) =>
                            patchScene(scene.id, {
                              interstitial: { ...scene.interstitial, nextConnection: event.target.value },
                            })
                          }
                        />
                      </Field>
                    </Grid>
                  )}
                </div>
              </Card>

              <Card
                title="Captions"
                subtitle="2–5 words per group. Emphasised words render larger and in coral."
                actions={
                  <div className="row gap-xs">
                    <Button size="sm" variant="ghost" onClick={() => regenerateCaptions(scene)}>
                      Generate from voice-over
                    </Button>
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() =>
                        patchScene(scene.id, {
                          captions: [
                            ...scene.captions,
                            {
                              id: uid('cap'),
                              words: markWords('NEW LINE'),
                              start: scene.captions.reduce((max, group) => Math.max(max, group.end), 0),
                              end: Math.min(scene.duration, scene.captions.reduce((max, group) => Math.max(max, group.end), 0) + 1),
                              estimated: false,
                            },
                          ],
                        })
                      }
                    >
                      Add group
                    </Button>
                  </div>
                }
              >
                {scene.captions.length ? (
                  <div className="caption-editor">
                    {scene.captions.map((group, index) => (
                      <CaptionRow
                        key={group.id}
                        group={group}
                        index={index}
                        sceneDuration={scene.duration}
                        onChange={(next) =>
                          patchScene(scene.id, { captions: scene.captions.map((item) => (item.id === group.id ? next : item)) })
                        }
                        onDelete={() => patchScene(scene.id, { captions: scene.captions.filter((item) => item.id !== group.id) })}
                      />
                    ))}
                    <p className="muted small">
                      {scene.captions.some((group) => group.estimated)
                        ? 'Timing is estimated from word count. Attach a measured recording in Voice Studio to replace the estimate.'
                        : 'Timing is manually set or measured.'}
                    </p>
                  </div>
                ) : (
                  <p className="muted">No caption groups. Generate them from the voice-over text, then adjust emphasis.</p>
                )}
              </Card>
            </>
          ) : (
            <Card>
              <p className="muted">Add a scene to start the storyboard.</p>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete scene?"
        body="Removing the scene shifts every later scene earlier on the timeline. This cannot be undone."
        confirmLabel="Delete scene"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteScene(pendingDelete)}
      />
    </div>
  );
}

function CaptionRow({
  group,
  index,
  sceneDuration,
  onChange,
  onDelete,
}: {
  group: CaptionGroup;
  index: number;
  sceneDuration: number;
  onChange: (group: CaptionGroup) => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <div className="caption-row">
      <div className="caption-row-head">
        <span className="caption-index">{index + 1}</span>
        <span className="caption-preview">{captionText(group)}</span>
        {group.estimated && <Badge tone="warning">estimated</Badge>}
        <button className="icon-button danger" aria-label="Delete caption group" onClick={onDelete}>
          <Icon name="trash" size={14} />
        </button>
      </div>
      <div className="caption-row-body">
        <TextInput
          value={group.words.map((word) => word.text).join(' ')}
          onChange={(event) => onChange({ ...group, words: markWords(event.target.value) })}
          aria-label="Caption text"
        />
        <label className="caption-time">
          <span>in</span>
          <NumberInput
            value={group.start}
            min={0}
            max={sceneDuration}
            step={0.05}
            suffix="s"
            onChange={(value) => onChange({ ...group, start: Math.max(0, value), estimated: false })}
          />
        </label>
        <label className="caption-time">
          <span>out</span>
          <NumberInput
            value={group.end}
            min={0.2}
            max={sceneDuration + 2}
            step={0.05}
            suffix="s"
            onChange={(value) => onChange({ ...group, end: Math.max(group.start + 0.2, value), estimated: false })}
          />
        </label>
      </div>
      <div className="caption-words">
        {group.words.map((word, wordIndex) => (
          <button
            key={`${word.text}-${wordIndex}`}
            className={`word-chip ${word.emphasis ? 'is-emphasis' : ''}`}
            onClick={() =>
              onChange({
                ...group,
                words: group.words.map((item, itemIndex) =>
                  itemIndex === wordIndex ? { ...item, emphasis: !item.emphasis } : item,
                ),
              })
            }
            title="Toggle coral emphasis"
          >
            {word.text}
          </button>
        ))}
      </div>
    </div>
  );
}
