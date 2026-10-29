import React, { useEffect, useMemo, useState } from 'react';
import type {
  Direction,
  EasingId,
  LayerAnimation,
  LayerKind,
  MotionPresetId,
  Project,
  Scene,
  SceneLayer,
} from '../types';
import { ProjectGate } from '../components/ProjectGate';
import { ScenePlayer } from '../components/ScenePlayer';
import { useAssetImages } from '../components/useAssetImages';
import { useStore } from '../state/store';
import { createAnimation, createLayer } from '../lib/factory';
import { createScene } from '../lib/factory';
import { MOTION_PRESETS, PRESET_BY_ID } from '../lib/motion';
import { sequenceScenes } from '../lib/sequence';
import { MASCOT_ID } from '../lib/characters';
import { checkWebmSupport, downloadSrt, exportProjectVideo, exportFramePng, safeName, storyboardCsv, productionPackageMarkdown } from '../lib/exporter';
import { downloadBlob, downloadText } from '../lib/storage';
import { formatDuration, formatTimecode } from '../lib/time';
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
  ProgressBar,
  Select,
  Slider,
  TextInput,
  Toggle,
} from '../components/ui';
import { Icon } from '../components/Icon';

const SHAPES = [
  { value: 'bg', label: 'Backdrop (full frame)' },
  { value: 'panel', label: 'Panel / card' },
  { value: 'block', label: 'Block / building' },
  { value: 'bar', label: 'Chart bar' },
  { value: 'circle', label: 'Circle / coin' },
  { value: 'line', label: 'Line / rule' },
];

const EFFECTS = [
  { value: 'cracks', label: 'Cracks (progressive)' },
  { value: 'smoke', label: 'Smoke loop' },
  { value: 'dust', label: 'Dust motes' },
  { value: 'speedlines', label: 'Speed lines' },
  { value: 'grain', label: 'Film grain' },
  { value: 'vignette', label: 'Vignette' },
];

function hashParam(key: string): string {
  const hash = window.location.hash;
  const index = hash.indexOf('?');
  if (index < 0) return '';
  return new URLSearchParams(hash.slice(index + 1)).get(key) ?? '';
}

export function AnimationStudio(): React.ReactElement {
  return (
    <ProjectGate feature="animation">
      {(project) => <AnimationWorkspace project={project} />}
    </ProjectGate>
  );
}

function AnimationWorkspace({ project }: { project: Project }): React.ReactElement {
  const { state, updateProject, toast } = useStore();
  const { images } = useAssetImages();
  const initialScene = useMemo(() => hashParam('scene'), []);
  const initialLayer = useMemo(() => hashParam('layer'), []);
  const [sceneId, setSceneId] = useState(initialScene || project.scenes[0]?.id || '');
  const [layerId, setLayerId] = useState(initialLayer);
  const [newPreset, setNewPreset] = useState<MotionPresetId>('popIn');
  const [newLayerKind, setNewLayerKind] = useState<LayerKind>('shape');
  const [newLayerRef, setNewLayerRef] = useState('panel');
  const [frameOffset, setFrameOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState('');
  const [pendingLayerDelete, setPendingLayerDelete] = useState<string | null>(null);

  const scene = project.scenes.find((item) => item.id === sceneId) ?? project.scenes[0];
  const layer = scene?.layers.find((item) => item.id === layerId) ?? scene?.layers[0];
  const support = checkWebmSupport();

  useEffect(() => {
    if (!scene) return;
    if (scene.id !== sceneId) setSceneId(scene.id);
    if (!scene.layers.some((item) => item.id === layerId)) setLayerId(scene.layers[0]?.id ?? '');
  }, [scene, sceneId, layerId]);

  const total = project.scenes.reduce((sum, item) => sum + item.duration, 0);

  const patchScene = (patch: Partial<Scene>) => {
    if (!scene) return;
    updateProject(project.id, (item) => ({
      ...item,
      scenes: sequenceScenes(item.scenes.map((entry) => (entry.id === scene.id ? { ...entry, ...patch } : entry))),
    }));
  };

  const patchLayer = (targetId: string, patch: Partial<SceneLayer>) => {
    if (!scene) return;
    updateProject(project.id, (item) => ({
      ...item,
      scenes: item.scenes.map((entry) =>
        entry.id === scene.id
          ? { ...entry, layers: entry.layers.map((candidate) => (candidate.id === targetId ? { ...candidate, ...patch } : candidate)) }
          : entry,
      ),
    }));
  };

  const patchAnimation = (animId: string, patch: Partial<LayerAnimation>) => {
    if (!layer) return;
    patchLayer(layer.id, {
      animations: layer.animations.map((anim) => (anim.id === animId ? { ...anim, ...patch } : anim)),
    });
  };

  const addLayer = () => {
    if (!scene) {
      toast('Add a scene in Storyboard Studio first.', 'warning');
      return;
    }
    const z = scene.layers.reduce((max, item) => Math.max(max, item.z), 0) + 1;
    let created: SceneLayer;
    if (newLayerKind === 'character') {
      created = createLayer({
        kind: 'character',
        label: state.characters.find((character) => character.id === newLayerRef)?.name ?? 'Character',
        refId: newLayerRef,
        x: 0.5,
        y: 0.84,
        z: z + 2,
        pose: 'neutral',
        expression: 'confident',
        animations: [createAnimation('popIn', 0, 0.4, { easing: 'spring' }), createAnimation('blink', 1.2, 2.6, { loop: true })],
      });
    } else if (newLayerKind === 'image') {
      const asset = state.assets.find((item) => item.id === newLayerRef);
      created = createLayer({
        kind: 'image',
        label: asset?.name ?? 'Image layer',
        refId: newLayerRef,
        x: 0.5,
        y: 0.5,
        z,
        animations: [createAnimation('popIn', 0.2, 0.5)],
      });
    } else if (newLayerKind === 'text') {
      created = createLayer({
        kind: 'text',
        label: 'Text',
        text: 'ON-SCREEN TEXT',
        x: 0.5,
        y: 0.28,
        z: z + 3,
        color: '#ffffff',
        animations: [createAnimation('progressive', 0.3, 0.8)],
      });
    } else if (newLayerKind === 'effect') {
      created = createLayer({
        kind: 'effect',
        label: EFFECTS.find((effect) => effect.value === newLayerRef)?.label ?? 'Effect',
        refId: newLayerRef,
        x: 0.5,
        y: 0.5,
        z: z + 4,
        color: '#ff5470',
        animations: [createAnimation('progressive', 0.4, Math.max(1, scene.duration * 0.5))],
      });
    } else {
      created = createLayer({
        kind: 'shape',
        label: SHAPES.find((shape) => shape.value === newLayerRef)?.label ?? 'Shape',
        refId: newLayerRef,
        x: 0.5,
        y: 0.45,
        z,
        color: newLayerRef === 'bg' ? '#f2f2f4' : '#ff5470',
        animations: [createAnimation(newLayerRef === 'bg' ? 'fadeIn' : 'popIn', 0.2, 0.5)],
      });
    }
    updateProject(project.id, (item) => ({
      ...item,
      scenes: item.scenes.map((entry) => (entry.id === scene.id ? { ...entry, layers: [...entry.layers, created] } : entry)),
    }));
    setLayerId(created.id);
    toast('Layer added.', 'success');
  };

  const deleteLayer = (targetId: string) => {
    if (!scene) return;
    updateProject(project.id, (item) => ({
      ...item,
      scenes: item.scenes.map((entry) =>
        entry.id === scene.id ? { ...entry, layers: entry.layers.filter((candidate) => candidate.id !== targetId) } : entry,
      ),
    }));
    setPendingLayerDelete(null);
    toast('Layer removed.', 'info');
  };

  const addAnimation = () => {
    if (!layer) return;
    const info = PRESET_BY_ID[newPreset];
    const animation = createAnimation(newPreset, 0, info.defaultDuration, {
      strength: info.defaultStrength,
      loop: info.loopable && (newPreset === 'float' || newPreset === 'blink' || newPreset === 'talk'),
      easing: newPreset === 'popIn' || newPreset === 'scaleBounce' ? 'spring' : 'easeOut',
    });
    patchLayer(layer.id, { animations: [...layer.animations, animation] });
    toast(`${info.label} added at 0.0s.`, 'success');
  };

  const exportFrame = async () => {
    if (!scene) return;
    try {
      const blob = await exportFramePng({
        project,
        characters: state.characters,
        settings: state.settings,
        images,
        time: Math.min(scene.end - 0.01, scene.start + frameOffset),
      });
      downloadBlob(`${safeName(project.name)}-scene${project.scenes.indexOf(scene) + 1}-${frameOffset.toFixed(1)}s.png`, blob);
      toast('PNG frame exported.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Frame export failed.', 'error');
    }
  };

  const exportVideo = async () => {
    setExporting(true);
    setExportProgress(0);
    setExportMessage('Preparing…');
    try {
      const result = await exportProjectVideo({
        project,
        characters: state.characters,
        settings: state.settings,
        images,
        assets: state.assets,
        filename: `${safeName(project.name)}.webm`,
        onProgress: (progress, message) => {
          setExportProgress(progress);
          setExportMessage(message);
        },
      });
      toast(
        `Exported ${formatDuration(result.durationSec)} WebM${result.audioIncluded ? ' with audio' : ' without audio'}.`,
        'success',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Video export failed.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Renderer"
        title="Animation Studio"
        description="Layered 2D motion with a moving camera. Everything you see here is the renderer that draws the export — not a separate mock-up."
        actions={
          <div className="row gap-sm wrap">
            <Badge tone={support.supported ? 'success' : 'warning'}>{support.supported ? 'WebM available' : 'WebM unavailable'}</Badge>
            <Button variant="ghost" onClick={() => (window.location.hash = '#/storyboard')}>
              Edit scenes
            </Button>
          </div>
        }
      />

      <div className="scene-strip">
        {project.scenes.map((item, index) => (
          <button
            key={item.id}
            className={`scene-strip-item ${item.id === scene?.id ? 'is-active' : ''}`}
            style={{ flexGrow: Math.max(1, item.duration) }}
            onClick={() => setSceneId(item.id)}
            title={`${item.title} · ${item.duration.toFixed(1)}s`}
          >
            <span>{index + 1}</span>
            <em>{item.duration.toFixed(1)}s</em>
          </button>
        ))}
        {!project.scenes.length && (
          <Button variant="secondary" onClick={() => {
            const created = createScene({ title: 'Scene 1', duration: 4 });
            updateProject(project.id, (item) => ({ ...item, scenes: sequenceScenes([...item.scenes, created]) }));
            setSceneId(created.id);
          }}>
            Add first scene
          </Button>
        )}
      </div>

      <div className="studio-layout">
        <div className="stack">
          <ScenePlayer project={project} sceneId={scene?.id} onSelectScene={setSceneId} showGuidesDefault={project.settings.safeAreaGuides} />

          <Card
            title="Timeline"
            subtitle={scene ? `${scene.title} · ${scene.duration.toFixed(1)}s · ${scene.layers.length} layers` : 'No scene selected'}
          >
            {scene ? (
              <div className="timeline">
                <div className="timeline-ruler">
                  {Array.from({ length: Math.ceil(scene.duration) + 1 }).map((_, index) => (
                    <span key={index} style={{ left: `${(index / Math.max(scene.duration, 1)) * 100}%` }}>
                      {index}s
                    </span>
                  ))}
                </div>
                {[...scene.layers]
                  .sort((a, b) => a.z - b.z)
                  .map((item) => (
                    <div key={item.id} className={`timeline-row ${item.id === layer?.id ? 'is-active' : ''}`}>
                      <button className="timeline-label" onClick={() => setLayerId(item.id)}>
                        <Badge tone={item.kind === 'character' ? 'accent' : 'neutral'}>{item.kind}</Badge>
                        {item.label}
                      </button>
                      <div className="timeline-track">
                        {item.animations.map((anim) => (
                          <button
                            key={anim.id}
                            className="timeline-bar"
                            style={{
                              left: `${Math.min(100, (anim.start / Math.max(scene.duration, 0.1)) * 100)}%`,
                              width: `${Math.max(3, Math.min(100 - (anim.start / Math.max(scene.duration, 0.1)) * 100, (anim.duration / Math.max(scene.duration, 0.1)) * 100))}%`,
                            }}
                            title={`${PRESET_BY_ID[anim.preset]?.label ?? anim.preset} · ${anim.start.toFixed(1)}s → ${(anim.start + anim.duration).toFixed(1)}s`}
                            onClick={() => {
                              setLayerId(item.id);
                            }}
                          >
                            {anim.preset}
                          </button>
                        ))}
                        {!item.animations.length && <span className="timeline-empty">held still</span>}
                      </div>
                    </div>
                  ))}
                {!scene.layers.length && <p className="muted small">No layers. Add Marlowe or a shape below.</p>}
              </div>
            ) : (
              <p className="muted">Select a scene.</p>
            )}
          </Card>

          <Card title="Add a layer" subtitle="Layers render from lowest z to highest">
            <div className="row gap-sm wrap">
              <Select
                value={newLayerKind}
                options={[
                  { value: 'character', label: 'Character' },
                  { value: 'shape', label: 'Shape' },
                  { value: 'text', label: 'Text' },
                  { value: 'effect', label: 'Effect' },
                  { value: 'image', label: 'Image asset' },
                ]}
                onChange={(event) => {
                  const kind = event.target.value as LayerKind;
                  setNewLayerKind(kind);
                  setNewLayerRef(
                    kind === 'character'
                      ? MASCOT_ID
                      : kind === 'shape'
                        ? 'panel'
                        : kind === 'effect'
                          ? 'cracks'
                          : kind === 'image'
                            ? state.assets.find((asset) => asset.kind === 'image')?.id ?? ''
                            : '',
                  );
                }}
              />
              {newLayerKind === 'character' && (
                <Select
                  value={newLayerRef}
                  options={state.characters.map((character) => ({ value: character.id, label: character.name }))}
                  onChange={(event) => setNewLayerRef(event.target.value)}
                />
              )}
              {newLayerKind === 'shape' && (
                <Select value={newLayerRef} options={SHAPES} onChange={(event) => setNewLayerRef(event.target.value)} />
              )}
              {newLayerKind === 'effect' && (
                <Select value={newLayerRef} options={EFFECTS} onChange={(event) => setNewLayerRef(event.target.value)} />
              )}
              {newLayerKind === 'image' && (
                <Select
                  value={newLayerRef}
                  options={
                    state.assets.filter((asset) => asset.kind === 'image').length
                      ? state.assets.filter((asset) => asset.kind === 'image').map((asset) => ({ value: asset.id, label: asset.name }))
                      : [{ value: '', label: 'No image assets yet' }]
                  }
                  onChange={(event) => setNewLayerRef(event.target.value)}
                />
              )}
              <Button variant="primary" onClick={addLayer} disabled={newLayerKind === 'image' && !newLayerRef}>
                Add layer
              </Button>
            </div>
            <p className="muted small">
              A flat imported image is one layer. AscendCC does not invent editable parts inside artwork.
            </p>
          </Card>
        </div>

        <div className="stack">
          <Card
            title="Layer inspector"
            subtitle={layer ? `${layer.label} · z${layer.z}` : 'Select a layer'}
            actions={
              layer && (
                <button className="icon-button danger" aria-label="Delete layer" onClick={() => setPendingLayerDelete(layer.id)}>
                  <Icon name="trash" size={15} />
                </button>
              )
            }
          >
            {layer ? (
              <div className="stack-sm">
                <Field label="Label">
                  <TextInput value={layer.label} onChange={(event) => patchLayer(layer.id, { label: event.target.value })} />
                </Field>
                <Grid columns={2}>
                  <Field label="Horizontal (0–1)">
                    <Slider label="x" value={layer.x} min={-0.2} max={1.2} onChange={(value) => patchLayer(layer.id, { x: value })} display={layer.x.toFixed(2)} />
                  </Field>
                  <Field label="Vertical (0–1)">
                    <Slider label="y" value={layer.y} min={-0.2} max={1.2} onChange={(value) => patchLayer(layer.id, { y: value })} display={layer.y.toFixed(2)} />
                  </Field>
                  <Field label="Scale">
                    <Slider label="scale" value={layer.scale} min={0.1} max={2.4} onChange={(value) => patchLayer(layer.id, { scale: value })} display={`${layer.scale.toFixed(2)}×`} />
                  </Field>
                  <Field label="Rotation">
                    <Slider label="deg" value={layer.rotation} min={-45} max={45} onChange={(value) => patchLayer(layer.id, { rotation: value })} display={`${layer.rotation.toFixed(0)}°`} />
                  </Field>
                  <Field label="Opacity">
                    <Slider label="alpha" value={layer.opacity} min={0} max={1} onChange={(value) => patchLayer(layer.id, { opacity: value })} display={layer.opacity.toFixed(2)} />
                  </Field>
                  <Field label="Depth order (z)">
                    <NumberInput value={layer.z} min={0} max={20} step={1} onChange={(value) => patchLayer(layer.id, { z: value })} />
                  </Field>
                </Grid>

                {layer.kind === 'character' && (
                  <Grid columns={2}>
                    <Field label="Pose">
                      <Select
                        value={layer.pose}
                        options={['neutral', 'talking', 'thinking', 'sideways', 'smirk', 'surprised', 'disappointed', 'pointing', 'openhand', 'adjustSuit', 'walking', 'sitting', 'directGaze'].map((pose) => ({ value: pose, label: pose }))}
                        onChange={(event) => patchLayer(layer.id, { pose: event.target.value as SceneLayer['pose'] })}
                      />
                    </Field>
                    <Field label="Expression">
                      <Select
                        value={layer.expression}
                        options={['neutral', 'confident', 'smirk', 'surprised', 'disappointed', 'thinking', 'alert'].map((expression) => ({ value: expression, label: expression }))}
                        onChange={(event) => patchLayer(layer.id, { expression: event.target.value as SceneLayer['expression'] })}
                      />
                    </Field>
                    <Field label="Mouth (base)">
                      <Select
                        value={layer.mouth}
                        options={['closed', 'rest', 'open', 'wide', 'rounded', 'teeth'].map((mouth) => ({ value: mouth, label: mouth }))}
                        onChange={(event) => patchLayer(layer.id, { mouth: event.target.value as SceneLayer['mouth'] })}
                      />
                    </Field>
                  </Grid>
                )}

                {layer.kind === 'text' && (
                  <Field label="Text">
                    <TextInput value={layer.text} onChange={(event) => patchLayer(layer.id, { text: event.target.value })} />
                  </Field>
                )}

                {(layer.kind === 'shape' || layer.kind === 'effect' || layer.kind === 'text') && (
                  <Field label="Colour" hint="Grayscale by default; coral, gold, red or green only when the meaning needs it.">
                    <div className="row gap-xs wrap">
                      {['#0e0e10', '#f4f4f5', '#6b6b70', '#ff5470', '#c9a227', '#c92a3f', '#3ddc97'].map((color) => (
                        <button
                          key={color}
                          className={`swatch ${layer.color === color ? 'is-active' : ''}`}
                          style={{ background: color }}
                          aria-label={`Set colour ${color}`}
                          onClick={() => patchLayer(layer.id, { color })}
                        />
                      ))}
                    </div>
                  </Field>
                )}
              </div>
            ) : (
              <p className="muted">No layer selected.</p>
            )}
          </Card>

          {layer && (
            <Card
              title="Animations"
              subtitle="Compose presets. Offsets add, scale and opacity multiply."
              actions={
                <div className="row gap-xs">
                  <Select
                    value={newPreset}
                    options={MOTION_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
                    onChange={(event) => setNewPreset(event.target.value as MotionPresetId)}
                  />
                  <Button size="sm" variant="primary" onClick={addAnimation}>
                    Add
                  </Button>
                </div>
              }
            >
              <p className="muted small">{PRESET_BY_ID[newPreset]?.description}</p>
              {layer.animations.length ? (
                <div className="stack-sm">
                  {layer.animations.map((anim) => {
                    const info = PRESET_BY_ID[anim.preset];
                    return (
                      <div key={anim.id} className="anim-card">
                        <div className="row-between">
                          <Select
                            value={anim.preset}
                            options={MOTION_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
                            onChange={(event) => patchAnimation(anim.id, { preset: event.target.value as MotionPresetId })}
                          />
                          <button
                            className="icon-button danger"
                            aria-label="Delete animation"
                            onClick={() => patchLayer(layer.id, { animations: layer.animations.filter((item) => item.id !== anim.id) })}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                        <div className="anim-grid">
                          <Field label="Start (s)">
                            <NumberInput value={anim.start} min={0} max={scene?.duration ?? 60} step={0.1} suffix="s" onChange={(value) => patchAnimation(anim.id, { start: Math.max(0, value) })} />
                          </Field>
                          <Field label="Duration (s)">
                            <NumberInput value={anim.duration} min={0.1} step={0.1} suffix="s" onChange={(value) => patchAnimation(anim.id, { duration: Math.max(0.1, value) })} />
                          </Field>
                          <Field label="Strength">
                            <Slider label="strength" value={anim.strength} min={0} max={1.5} step={0.05} display={anim.strength.toFixed(2)} onChange={(value) => patchAnimation(anim.id, { strength: value })} />
                          </Field>
                          <Field label="Easing">
                            <Select
                              value={anim.easing}
                              options={(['linear', 'easeOut', 'easeIn', 'easeInOut', 'spring'] as EasingId[]).map((easing) => ({ value: easing, label: easing }))}
                              onChange={(event) => patchAnimation(anim.id, { easing: event.target.value as EasingId })}
                            />
                          </Field>
                          {info?.usesDirection && (
                            <Field label="Direction">
                              <Select
                                value={anim.direction}
                                options={(['left', 'right', 'up', 'down'] as Direction[]).map((direction) => ({ value: direction, label: direction }))}
                                onChange={(event) => patchAnimation(anim.id, { direction: event.target.value as Direction })}
                              />
                            </Field>
                          )}
                          <Field label="Loop">
                            <Toggle checked={anim.loop} onChange={(checked) => patchAnimation(anim.id, { loop: checked })} label="Loop" />
                          </Field>
                        </div>
                        <p className="muted small">{info?.description}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="muted small">This layer is held still. Add a preset to give it timed motion.</p>
              )}
            </Card>
          )}

          <Card title="Camera and transitions" subtitle="Camera motion is applied to the whole scene">
            {scene ? (
              <Grid columns={2}>
                <Field label="Camera">
                  <Select
                    value={scene.camera}
                    options={[
                      { value: 'static', label: 'Static' },
                      { value: 'pushIn', label: 'Slow push-in' },
                      { value: 'pullOut', label: 'Pull-out' },
                      { value: 'panLeft', label: 'Pan left' },
                      { value: 'panRight', label: 'Pan right' },
                      { value: 'drift', label: 'Drift' },
                    ]}
                    onChange={(event) => patchScene({ camera: event.target.value as Scene['camera'] })}
                  />
                </Field>
                <Field label="Intensity">
                  <Slider label="intensity" min={0} max={1.5} step={0.1} value={scene.cameraIntensity} display={scene.cameraIntensity.toFixed(1)} onChange={(value) => patchScene({ cameraIntensity: value })} />
                </Field>
                <Field label="Transition in">
                  <Select
                    value={scene.transition}
                    options={['cut', 'fade', 'slideLeft', 'slideUp', 'wipe', 'zoom'].map((transition) => ({ value: transition, label: transition }))}
                    onChange={(event) => patchScene({ transition: event.target.value as Scene['transition'] })}
                  />
                </Field>
                <Field label="Transition length">
                  <NumberInput value={scene.transitionDuration} min={0} max={2} step={0.1} suffix="s" onChange={(value) => patchScene({ transitionDuration: value })} />
                </Field>
              </Grid>
            ) : (
              <p className="muted">No scene selected.</p>
            )}
          </Card>

          <Card title="Export" subtitle="Real output only. Unsupported formats say so.">
            <div className="stack-sm">
              <Notice tone={support.supported ? 'info' : 'warning'}>{support.reason}</Notice>
              <Button
                variant="primary"
                icon={<Icon name="download" size={16} />}
                onClick={() => void exportVideo()}
                disabled={exporting || !support.supported || !project.scenes.length}
              >
                {exporting ? 'Recording…' : 'Export WebM'}
              </Button>
              {exporting && <ProgressBar value={exportProgress} label={exportMessage} />}

              {scene && (
                <>
                  <Field label={`PNG still of “${scene.title}” at ${frameOffset.toFixed(1)}s`}>
                    <Slider label="offset" min={0} max={Math.max(0.1, scene.duration - 0.1)} step={0.1} value={frameOffset} display={`${frameOffset.toFixed(1)}s`} onChange={setFrameOffset} />
                  </Field>
                  <Button variant="secondary" onClick={() => void exportFrame()} disabled={exporting}>
                    Export PNG frame
                  </Button>
                </>
              )}

              <div className="row gap-sm wrap">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    try {
                      downloadSrt(project);
                      toast('SRT exported.', 'success');
                    } catch (error) {
                      toast(error instanceof Error ? error.message : 'SRT export failed.', 'error');
                    }
                  }}
                >
                  Export captions (.srt)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadText(`${safeName(project.name)}-storyboard.csv`, storyboardCsv(project), 'text/csv')}
                >
                  Storyboard (.csv)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadText(`${safeName(project.name)}-package.md`, productionPackageMarkdown(project), 'text/markdown')}
                >
                  Package (.md)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadText(`${safeName(project.name)}.json`, JSON.stringify(project, null, 2), 'application/json')}
                >
                  Project (.json)
                </Button>
              </div>

              <div className="audit-row">
                <span>Timeline length</span>
                <strong>{formatTimecode(total)}</strong>
              </div>
              <p className="muted small">
                WebM export records in real time, so a {formatDuration(total)} video takes about {formatDuration(total)} to
                render. MP4 is not produced by this build; convert the WebM with a free local tool if a platform requires
                MP4.
              </p>
            </div>
          </Card>

          <Card title="Scene settings" subtitle="Project-level render options">
            <Toggle
              checked={project.settings.safeAreaGuides}
              onChange={(checked) =>
                updateProject(project.id, (item) => ({ ...item, settings: { ...item.settings, safeAreaGuides: checked } }))
              }
              label="Show safe-area guides by default"
              hint="Guides are never baked into exports."
            />
            <Toggle
              checked={project.settings.captionMode !== 'off'}
              onChange={(checked) =>
                updateProject(project.id, (item) => ({
                  ...item,
                  settings: { ...item.settings, captionMode: checked ? 'auto' : 'off' },
                }))
              }
              label="Burn captions into the render"
              hint="Rendered captions are word-grouped with coral emphasis on selected words."
            />
            <Toggle
              checked={project.settings.colourAccents}
              onChange={(checked) =>
                updateProject(project.id, (item) => ({ ...item, settings: { ...item.settings, colourAccents: checked } }))
              }
              label="Allow meaning-carrying colour"
              hint="Gold for money, red for risk, green for growth. Everything else stays monochrome."
            />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingLayerDelete)}
        title="Delete layer?"
        body="The layer and its animations are removed from this scene. Missing assets are not deleted from the library."
        onCancel={() => setPendingLayerDelete(null)}
        onConfirm={() => pendingLayerDelete && deleteLayer(pendingLayerDelete)}
      />
    </div>
  );
}
