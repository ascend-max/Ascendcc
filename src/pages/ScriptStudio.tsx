import React, { useState } from 'react';
import type { Project, Scene } from '../types';
import { ProjectGate } from '../components/ProjectGate';
import { useStore } from '../state/store';
import {
  buildContentPackage,
  beatsFor,
  generateStoryboard,
  hookOptions,
  titleOptions,
} from '../lib/templates';
import { createAnimation, createLayer, createScene } from '../lib/factory';
import { createVariation } from '../lib/script';
import { estimateNarrationSeconds, pacingAudit, splitScriptIntoBeats } from '../lib/script';
import { buildCaptionGroups } from '../lib/captions';
import { sequenceScenes } from '../lib/sequence';
import { MASCOT_ID } from '../lib/characters';
import { productionPackageMarkdown, safeName } from '../lib/exporter';
import { downloadText } from '../lib/storage';
import { uid } from '../lib/id';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CopyButton,
  Field,
  Grid,
  Notice,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from '../components/ui';
import { Icon } from '../components/Icon';

export function ScriptStudio(): React.ReactElement {
  return (
    <ProjectGate feature="scripting">
      {(project) => <ScriptWorkspace project={project} />}
    </ProjectGate>
  );
}

function ScriptWorkspace({ project }: { project: Project }): React.ReactElement {
  const { updateProject, toast, state } = useStore();
  const [confirmAction, setConfirmAction] = useState<'split' | 'generate' | null>(null);

  const fullNarration = [project.script.hook, project.script.narration, project.script.cta].filter(Boolean).join('\n\n');
  const words = fullNarration.trim() ? fullNarration.trim().split(/\s+/).length : 0;
  const estimate = estimateNarrationSeconds(fullNarration);
  const audit = pacingAudit(project);
  const verifyFlags = project.scenes.flatMap((scene, index) =>
    (scene.voiceOver.match(/\[VERIFY[^\]]*\]/gi) ?? []).map((flag) => ({
      flag,
      sceneId: scene.id,
      number: index + 1,
      title: scene.title,
    })),
  );

  const patchScript = (patch: Partial<Project['script']>) => {
    updateProject(project.id, (item) => ({ ...item, script: { ...item.script, ...patch } }));
  };

  const buildOutline = () => {
    const beats = beatsFor(project.contentMode);
    patchScript({
      outline: beats.map((beat) => ({ id: uid('beat'), label: beat.label, summary: beat.spoken })),
    });
    toast('Outline built from the selected narrative structure.', 'success');
  };

  const splitIntoScenes = () => {
    const blocks = splitScriptIntoBeats(project.script.narration);
    if (!blocks.length) {
      toast('The narration field is empty. Write paragraphs, then split at blank lines.', 'warning');
      return;
    }
    const scenes: Scene[] = blocks.map((block, index) => {
      const duration = Math.max(2.5, Math.round((estimateNarrationSeconds(block) + 0.6) * 10) / 10);
      const captions = buildCaptionGroups(block, {
        maxWords: 4,
        wordsPerSecond: Math.max(1.9, block.trim().split(/\s+/).length / (duration * 0.85)),
        startOffset: 0.15,
      }).filter((group) => group.start < duration);
      return createScene({
        title: `Beat ${index + 1}`,
        duration,
        voiceOver: block,
        visual: 'Describe the frame: what the audience sees, what carries the meaning.',
        motion:
          'Marlowe pop-in at 0.0s over 0.4s, then idle float (looping) with a blink at 1.5s and a talking mouth from 0.2s. Camera pushes in slowly for the full shot. Cut on the final syllable.',
        camera: 'pushIn',
        cameraIntensity: 0.5,
        layers: [
          createLayer({
            kind: 'shape',
            label: 'Backdrop',
            refId: 'bg',
            z: 0,
            color: '#f2f2f4',
            animations: [createAnimation('fadeIn', 0, 0.5)],
          }),
          createLayer({
            kind: 'character',
            label: 'Marlowe',
            refId: MASCOT_ID,
            x: 0.5,
            y: 0.84,
            z: 3,
            pose: 'talking',
            expression: 'confident',
            animations: [
              createAnimation('popIn', 0, 0.4, { easing: 'spring' }),
              createAnimation('float', 0.4, Math.max(1, duration - 0.4), { loop: true, strength: 0.2 }),
              createAnimation('blink', 1.5, 2.6, { loop: true }),
              createAnimation('talk', 0.2, Math.max(1, duration - 0.4), { loop: true }),
            ],
          }),
        ],
        captions,
      });
    });
    updateProject(project.id, (item) => ({
      ...item,
      scenes: sequenceScenes(scenes),
      status: item.status === 'idea' ? 'storyboard' : item.status,
    }));
    setConfirmAction(null);
    toast(`${scenes.length} scenes created from the narration.`, 'success');
    window.location.hash = '#/storyboard';
  };

  const generateScaffold = () => {
    if (!project.topic.trim()) {
      toast('Add a topic to the project first — the scaffold is built around it.', 'warning');
      return;
    }
    const scenes = generateStoryboard({
      topic: project.topic,
      audience: project.audience,
      durationSec: project.durationSec,
      mode: project.contentMode,
      platform: project.platform,
      settings: state.settings,
    });
    updateProject(project.id, (item) => {
      const next: Project = {
        ...item,
        scenes,
        status: 'storyboard',
        script: {
          ...item.script,
          outline: beatsFor(item.contentMode).map((beat) => ({ id: uid('beat'), label: beat.label, summary: beat.scaffold })),
        },
      };
      return { ...next, package: buildContentPackage(next) };
    });
    setConfirmAction(null);
    toast('Storyboard scaffold generated. Replace every [VERIFY] slot with a real source.', 'success');
    window.location.hash = '#/storyboard';
  };

  const refreshPackage = () => {
    updateProject(project.id, (item) => ({ ...item, package: buildContentPackage(item) }));
    toast('Content package refreshed from the current project.', 'success');
  };

  const addVariation = () => {
    const next = createVariation(`Variation ${project.script.variations.length + 1}`);
    patchScript({ variations: [...project.script.variations, next] });
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Writing"
        title="Script Studio"
        description="Short sentences, real stakes, no filler. Every factual slot is marked so the storyboard cannot quietly turn a guess into a claim."
        actions={
          <div className="row gap-sm wrap">
            <Button variant="ghost" onClick={buildOutline}>
              Build outline
            </Button>
            <Button variant="secondary" icon={<Icon name="film" size={16} />} onClick={() => setConfirmAction('split')}>
              Split into scenes
            </Button>
            <Button variant="primary" onClick={() => setConfirmAction('generate')}>
              Generate storyboard scaffold
            </Button>
          </div>
        }
      />

      <Grid columns={3}>
        <div className="stat">
          <span className="stat-label">Words</span>
          <span className="stat-value">{words}</span>
          <span className="stat-hint">Hook + narration + CTA</span>
        </div>
        <div className="stat">
          <span className="stat-label">Estimated narration</span>
          <span className="stat-value">{estimate ? `${estimate.toFixed(1)}s` : '—'}</span>
          <span className="stat-hint">Estimate from word count at 2.5 words/second</span>
        </div>
        <div className={`stat ${audit.status === 'over' ? 'is-danger' : ''}`}>
          <span className="stat-label">Timeline</span>
          <span className="stat-value">{audit.timelineSeconds.toFixed(1)}s</span>
          <span className="stat-hint">Storyboard total · {audit.status}</span>
        </div>
      </Grid>

      <Notice tone={audit.status === 'over' ? 'danger' : audit.status === 'tight' ? 'warning' : 'success'}>
        {audit.advice}
      </Notice>

      <Grid columns={2}>
        <Card title="Script" subtitle="Four blocks: title, hook, narration, call to action.">
          <div className="stack-sm">
            <Field label="Title (working)">
              <TextInput value={project.script.title} onChange={(event) => patchScript({ title: event.target.value })} placeholder="Working title only — packaging lives below." />
            </Field>
            <Field label="Hook" hint="Three seconds. State the real stakes, not a teaser.">
              <TextArea rows={2} value={project.script.hook} onChange={(event) => patchScript({ hook: event.target.value })} />
            </Field>
            <Field
              label="Narration"
              hint="Separate beats with a blank line to split them into scenes. Use [VERIFY] wherever a number or quote still needs a source."
            >
              <TextArea rows={16} value={project.script.narration} onChange={(event) => patchScript({ narration: event.target.value })} />
            </Field>
            <Field label="Call to action">
              <TextArea rows={2} value={project.script.cta} onChange={(event) => patchScript({ cta: event.target.value })} />
            </Field>
            <Field label="Emphasis notes" hint="Which words should carry the coral highlight in captions.">
              <TextArea rows={2} value={project.script.emphasis} onChange={(event) => patchScript({ emphasis: event.target.value })} />
            </Field>
            <Field label="Fact-check notes">
              <TextArea rows={3} value={project.script.factCheckNotes} onChange={(event) => patchScript({ factCheckNotes: event.target.value })} />
            </Field>
          </div>
        </Card>

        <div className="stack">
          <Card title="Outline" subtitle="The standard narrative structure for this content mode." actions={<Button size="sm" variant="ghost" onClick={buildOutline}>Rebuild</Button>}>
            {project.script.outline.length ? (
              <ol className="outline-list">
                {project.script.outline.map((beat) => (
                  <li key={beat.id}>
                    <strong>{beat.label}</strong>
                    <span>{beat.summary}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">No outline yet. Build one from the narrative template, then delete beats that do not fit the facts.</p>
            )}
          </Card>

          <Card title="Fact-check queue" subtitle="Every [VERIFY] slot in the storyboard">
            {verifyFlags.length ? (
              <ul className="flag-list">
                {verifyFlags.map((flag) => (
                  <li key={`${flag.sceneId}-${flag.flag}-${flag.number}`}>
                    <code>{flag.flag}</code>
                    <a href={`#/storyboard?scene=${flag.sceneId}`}>
                      Scene {flag.number}: {flag.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">
                No [VERIFY] markers. That is not proof of accuracy — check every figure against the Research tab before
                the record button.
              </p>
            )}
          </Card>

          <Card
            title="Script variations"
            subtitle="Alternate hooks and structures for A/B testing."
            actions={<Button size="sm" onClick={addVariation}>Add variation</Button>}
          >
            {project.script.variations.length ? (
              <div className="stack-sm">
                {project.script.variations.map((variation) => (
                  <div key={variation.id} className="variation">
                    <div className="row-between">
                      <TextInput
                        value={variation.label}
                        onChange={(event) =>
                          patchScript({
                            variations: project.script.variations.map((item) =>
                              item.id === variation.id ? { ...item, label: event.target.value } : item,
                            ),
                          })
                        }
                      />
                      <button
                        className="icon-button"
                        aria-label="Remove variation"
                        onClick={() =>
                          patchScript({ variations: project.script.variations.filter((item) => item.id !== variation.id) })
                        }
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                    <TextArea
                      rows={2}
                      placeholder="Alternate hook"
                      value={variation.hook}
                      onChange={(event) =>
                        patchScript({
                          variations: project.script.variations.map((item) =>
                            item.id === variation.id ? { ...item, hook: event.target.value } : item,
                          ),
                        })
                      }
                    />
                    <TextArea
                      rows={3}
                      placeholder="Alternate body"
                      value={variation.body}
                      onChange={(event) =>
                        patchScript({
                          variations: project.script.variations.map((item) =>
                            item.id === variation.id ? { ...item, body: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small">No variations yet. Test one different hook against the control, not five at once.</p>
            )}
          </Card>
        </div>
      </Grid>

      <Card
        title="Content package"
        subtitle="Editable deliverables generated from the project — hooks, titles, hashtags, thumbnail text and CTA."
        actions={
          <div className="row gap-sm wrap">
            <Button size="sm" variant="ghost" onClick={refreshPackage}>
              Refresh package
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<Icon name="download" size={15} />}
              onClick={() =>
                downloadText(`${safeName(project.name)}-package.md`, productionPackageMarkdown(project), 'text/markdown')
              }
            >
              Export package (.md)
            </Button>
          </div>
        }
      >
        <Grid columns={2}>
          <div className="stack-sm">
            <div>
              <span className="field-label">Five hooks</span>
              <ul className="deliverable-list">
                {(project.package.hooks.length ? project.package.hooks : hookOptions(project.topic, project.audience)).map((hook) => (
                  <li key={hook}>
                    <span>{hook}</span>
                    <CopyButton text={hook} />
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="field-label">Three titles</span>
              <ul className="deliverable-list">
                {(project.package.titles.length ? project.package.titles : titleOptions(project.topic)).map((title) => (
                  <li key={title}>
                    <span>{title}</span>
                    <CopyButton text={title} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="stack-sm">
            <Field label="Caption">
              <TextArea
                rows={3}
                value={project.package.caption}
                onChange={(event) =>
                  updateProject(project.id, (item) => ({ ...item, package: { ...item.package, caption: event.target.value } }))
                }
              />
            </Field>
            <Field label="Hashtags" hint="Five relevant tags, no spam walls.">
              <TextInput
                value={project.package.hashtags.join(' ')}
                onChange={(event) =>
                  updateProject(project.id, (item) => ({
                    ...item,
                    package: {
                      ...item.package,
                      hashtags: event.target.value.split(/\s+/).filter(Boolean).slice(0, 8),
                    },
                  }))
                }
              />
            </Field>
            <Field label="Thumbnail text">
              <TextInput
                value={project.package.thumbnailText}
                onChange={(event) =>
                  updateProject(project.id, (item) => ({
                    ...item,
                    package: { ...item.package, thumbnailText: event.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Call to action">
              <TextInput
                value={project.package.callToAction}
                onChange={(event) =>
                  updateProject(project.id, (item) => ({
                    ...item,
                    package: { ...item.package, callToAction: event.target.value },
                  }))
                }
              />
            </Field>
            <div className="meta-grid">
              <Badge tone="neutral">{project.package.hashtags.length} hashtags</Badge>
              <Badge tone={project.package.factCheckNotes.includes('VERIFY') ? 'warning' : 'success'}>
                {project.package.factCheckNotes.includes('VERIFY') ? 'Fact-check pending' : 'No VERIFY markers'}
              </Badge>
            </div>
            <p className="muted small">{project.package.factCheckNotes}</p>
          </div>
        </Grid>
      </Card>

      <ConfirmDialog
        open={confirmAction === 'split'}
        title="Split narration into scenes?"
        body="This replaces the current storyboard with one scene per paragraph. Scene animation direction will be reset to a simple default you can edit."
        confirmLabel="Replace storyboard"
        onCancel={() => setConfirmAction(null)}
        onConfirm={splitIntoScenes}
      />
      <ConfirmDialog
        open={confirmAction === 'generate'}
        title="Generate a storyboard scaffold?"
        body="This replaces the current storyboard with a template built for the project topic and mode. Nothing is researched: every factual slot will contain a [VERIFY] instruction for you to fill in."
        confirmLabel="Generate scaffold"
        onCancel={() => setConfirmAction(null)}
        onConfirm={generateScaffold}
      />
    </div>
  );
}
