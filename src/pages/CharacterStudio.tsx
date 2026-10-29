import React, { useEffect, useRef, useState } from 'react';
import type { Character, Expression, MouthPose, Pose } from '../types';
import { useStore } from '../state/store';
import { EXPRESSIONS, MOUTH_POSES, MASCOT_ID, POSES, newCharacterTemplate } from '../lib/characters';
import { drawMascot } from '../render/mascot';
import {
  Badge,
  Button,
  Card,
  DefinitionList,
  Field,
  Grid,
  Notice,
  PageHeader,
  Select,
  TextArea,
  TextInput,
  Toggle,
} from '../components/ui';
import { Icon } from '../components/Icon';

export function CharacterStudio(): React.ReactElement {
  const { state, updateCharacter, addCharacter, updateSettings, toast } = useStore();
  const [selectedId, setSelectedId] = useState(MASCOT_ID);
  const [pose, setPose] = useState<Pose>('neutral');
  const [expression, setExpression] = useState<Expression>('confident');
  const [mouth, setMouth] = useState<MouthPose>('closed');
  const [blink, setBlink] = useState(0);

  const character = state.characters.find((item) => item.id === selectedId) ?? state.characters[0];
  const isMascot = character?.id === MASCOT_ID;

  const patch = (update: Partial<Character>) => {
    if (!character) return;
    updateCharacter(character.id, (item) => ({ ...item, ...update }));
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Character bible"
        title="Character Studio"
        description="Marlowe is the narrator: a black jackal in a suit, drawn in grayscale with a single coral accent. One gesture per beat, calm at all times."
        actions={
          <Button
            variant="secondary"
            icon={<Icon name="plus" size={16} />}
            onClick={() => {
              const created = newCharacterTemplate();
              addCharacter(created);
              setSelectedId(created.id);
              toast('Character record created. Attach reference artwork in the Asset Library.', 'success');
            }}
          >
            New character
          </Button>
        }
      />

      <div className="character-layout">
        <div className="stack">
          <Card title="Preview" subtitle={isMascot ? 'Live procedural drawing — identical to the renderer.' : 'Reference-led character'}>
            <div className="preview-stage">
              <MascotPreview
                pose={pose}
                expression={expression}
                mouth={mouth}
                blink={blink}
                cigarette={state.settings.cigarette}
                accent={character?.accentColor ?? '#ff5470'}
              />
            </div>
            <Grid columns={2}>
              <Field label="Pose">
                <Select value={pose} options={POSES.map((item) => ({ value: item.id, label: item.label }))} onChange={(event) => setPose(event.target.value as Pose)} />
              </Field>
              <Field label="Expression">
                <Select
                  value={expression}
                  options={EXPRESSIONS.map((item) => ({ value: item.id, label: item.label }))}
                  onChange={(event) => setExpression(event.target.value as Expression)}
                />
              </Field>
              <Field label="Mouth shape">
                <Select
                  value={mouth}
                  options={MOUTH_POSES.map((item) => ({ value: item.id, label: item.label }))}
                  onChange={(event) => setMouth(event.target.value as MouthPose)}
                />
              </Field>
              <Field label="Blink test">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setBlink(1);
                    window.setTimeout(() => setBlink(0), 120);
                  }}
                >
                  Blink
                </Button>
              </Field>
            </Grid>
            <p className="muted small">
              {POSES.find((item) => item.id === pose)?.note} · {EXPRESSIONS.find((item) => item.id === expression)?.note}
            </p>
          </Card>

          <Card title="Design toggles" subtitle="Applies to every render and export">
            <Toggle
              checked={state.settings.cigarette}
              onChange={(checked) => {
                updateSettings({ cigarette: checked });
                if (character) patch({ cigarette: checked });
              }}
              label="Cigarette accessory"
              hint="A configurable design element, not an endorsement. Off by default for brand-safe versions."
            />
            <Toggle
              checked={state.settings.smoke}
              onChange={(checked) => {
                updateSettings({ smoke: checked });
                if (character) patch({ smoke: checked });
              }}
              label="Smoke effect layer"
              hint="Smoke always renders as its own effect layer so it can animate independently."
            />
            <p className="muted small">
              Smoke is not drawn automatically next to the cigarette: add a smoke effect layer in Animation Studio and
              position it at the ember.
            </p>
          </Card>
        </div>

        <div className="stack">
          <Card title="Characters" subtitle="Both records stay distinct — Dani is never merged into Marlowe.">
            <div className="character-list">
              {state.characters.map((item) => (
                <button
                  key={item.id}
                  className={`character-chip ${item.id === selectedId ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="character-avatar">{item.name.slice(0, 1)}</span>
                  <span>
                    <strong>{item.name}</strong>
                    <span className="small muted">{item.role}</span>
                  </span>
                  {item.builtin ? <Badge tone="accent">built in</Badge> : <Badge>custom</Badge>}
                </button>
              ))}
            </div>
          </Card>

          {character && (
            <>
              <Card
                title="Bible"
                subtitle={character.referenceStatus}
                actions={<Badge tone={character.builtin ? 'accent' : 'neutral'}>{character.builtin ? 'prototype' : 'reference needed'}</Badge>}
              >
                <div className="stack-sm">
                  <Grid columns={2}>
                    <Field label="Name">
                      <TextInput value={character.name} onChange={(event) => patch({ name: event.target.value })} />
                    </Field>
                    <Field label="Role">
                      <TextInput value={character.role} onChange={(event) => patch({ role: event.target.value })} />
                    </Field>
                  </Grid>
                  <Field label="Concept">
                    <TextArea rows={2} value={character.concept} onChange={(event) => patch({ concept: event.target.value })} />
                  </Field>
                  <Field label="Silhouette">
                    <TextArea rows={2} value={character.silhouette} onChange={(event) => patch({ silhouette: event.target.value })} />
                  </Field>
                  <Field label="Proportions">
                    <TextArea rows={2} value={character.proportions} onChange={(event) => patch({ proportions: event.target.value })} />
                  </Field>
                  <Field label="Face and eye design">
                    <TextArea rows={2} value={character.face} onChange={(event) => patch({ face: event.target.value })} />
                  </Field>
                  <Field label="Outfit">
                    <TextArea rows={2} value={character.outfit} onChange={(event) => patch({ outfit: event.target.value })} />
                  </Field>
                  <Field label="Colour rules (one per line)">
                    <TextArea
                      rows={4}
                      value={character.colorRules.join('\n')}
                      onChange={(event) => patch({ colorRules: event.target.value.split('\n').filter(Boolean) })}
                    />
                  </Field>
                  <Field label="Animation rules (one per line)">
                    <TextArea
                      rows={5}
                      value={character.animationRules.join('\n')}
                      onChange={(event) => patch({ animationRules: event.target.value.split('\n').filter(Boolean) })}
                    />
                  </Field>
                  <Field label="Asset naming convention">
                    <TextInput value={character.namingConvention} onChange={(event) => patch({ namingConvention: event.target.value })} />
                  </Field>
                  <Field label="Notes">
                    <TextArea rows={2} value={character.notes} onChange={(event) => patch({ notes: event.target.value })} />
                  </Field>
                </div>
              </Card>

              <Card title="Supported poses and expressions">
                <DefinitionList
                  items={[
                    { term: 'Poses', detail: POSES.map((item) => item.label).join(' · ') },
                    { term: 'Expressions', detail: EXPRESSIONS.map((item) => item.label).join(' · ') },
                    { term: 'Mouth shapes', detail: MOUTH_POSES.map((item) => item.label).join(' · ') },
                  ]}
                />
              </Card>

              {character.id === 'char_dani' && (
                <Notice tone="warning" title="Dani reference not found">
                  No Dani artwork exists in this repository, so AscendCC has not invented one. Upload the original Dani
                  reference in the Asset Library, attach it here, and keep her design entirely separate from Marlowe.
                </Notice>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MascotPreview({
  pose,
  expression,
  mouth,
  blink,
  cigarette,
  accent,
}: {
  pose: Pose;
  expression: Expression;
  mouth: MouthPose;
  blink: number;
  cigarette: boolean;
  accent: string;
}): React.ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#f7f7f8');
    gradient.addColorStop(1, '#dcdce1');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height * 0.97);
    ctx.scale(canvas.height / 1150, canvas.height / 1150);
    drawMascot(ctx, { pose, expression, mouth, blink, cigarette, accent });
    ctx.restore();
  }, [pose, expression, mouth, blink, cigarette, accent]);

  return <canvas ref={ref} width={420} height={520} className="mascot-canvas" aria-label="Mascot preview" />;
}
