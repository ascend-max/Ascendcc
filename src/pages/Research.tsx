import React, { useState } from 'react';
import type { Claim, ClaimStatus, ResearchStatus, Source } from '../types';
import { ProjectGate } from '../components/ProjectGate';
import { useStore } from '../state/store';
import { uid } from '../lib/id';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Grid,
  Modal,
  Notice,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from '../components/ui';
import { Icon } from '../components/Icon';

const CLAIM_STATUSES: { value: ClaimStatus; label: string }[] = [
  { value: 'unverified', label: 'Unverified' },
  { value: 'in-progress', label: 'Checking' },
  { value: 'verified', label: 'Verified' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'opinion', label: 'Opinion / analysis' },
];

const RESEARCH_STATUSES: { value: ResearchStatus; label: string }[] = [
  { value: 'none', label: 'Not started' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'verified', label: 'Verified against sources' },
];

function emptyClaim(): Claim {
  return { id: uid('claim'), text: '', status: 'unverified', sourceIds: [], notes: '', createdAt: Date.now() };
}

function emptySource(): Source {
  return {
    id: uid('source'),
    title: '',
    url: '',
    publisher: '',
    publishedAt: '',
    accessedAt: new Date().toISOString().slice(0, 10),
    primary: false,
    notes: '',
  };
}

export function Research(): React.ReactElement {
  return (
    <ProjectGate feature="research">
      {(project) => <ResearchWorkspace />}
    </ProjectGate>
  );
}

function ResearchWorkspace(): React.ReactElement {
  const { activeProject, updateProject, toast } = useStore();
  const project = activeProject!;
  const [claimDraft, setClaimDraft] = useState<Claim | null>(null);
  const [sourceDraft, setSourceDraft] = useState<Source | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'claim' | 'source'; id: string } | null>(null);

  const verifyFlags = project.scenes.flatMap((scene, index) => {
    const matches = scene.voiceOver.match(/\[VERIFY[^\]]*\]/gi) ?? [];
    return matches.map((flag, flagIndex) => ({
      id: `${scene.id}-${flagIndex}`,
      sceneId: scene.id,
      sceneNumber: index + 1,
      sceneTitle: scene.title,
      flag,
    }));
  });

  const saveClaim = () => {
    if (!claimDraft || !claimDraft.text.trim()) {
      toast('Describe the claim before saving.', 'warning');
      return;
    }
    updateProject(project.id, (item) => ({
      ...item,
      claims: item.claims.some((claim) => claim.id === claimDraft.id)
        ? item.claims.map((claim) => (claim.id === claimDraft.id ? claimDraft : claim))
        : [...item.claims, claimDraft],
    }));
    setClaimDraft(null);
    toast('Claim saved.', 'success');
  };

  const saveSource = () => {
    if (!sourceDraft || (!sourceDraft.title.trim() && !sourceDraft.url.trim())) {
      toast('A source needs at least a title or a URL.', 'warning');
      return;
    }
    updateProject(project.id, (item) => ({
      ...item,
      sources: item.sources.some((source) => source.id === sourceDraft.id)
        ? item.sources.map((source) => (source.id === sourceDraft.id ? sourceDraft : source))
        : [...item.sources, sourceDraft],
    }));
    setSourceDraft(null);
    toast('Source saved.', 'success');
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Accuracy"
        title="Research"
        description="Track every factual claim, attach the source that supports it, and keep speculation clearly labelled. AscendCC does not browse the web for you."
        actions={
          <div className="row gap-sm wrap">
            <Button icon={<Icon name="plus" size={16} />} variant="secondary" onClick={() => setClaimDraft(emptyClaim())}>
              Add claim
            </Button>
            <Button icon={<Icon name="plus" size={16} />} variant="primary" onClick={() => setSourceDraft(emptySource())}>
              Add source
            </Button>
          </div>
        }
      />

      <Notice tone="warning" title="Nothing here is auto-verified">
        Research notes are entered by you. AscendCC cannot confirm a figure, quote or date. Prefer primary documents —
        filings, official announcements, interviews, original reporting — and mark anything unresolved as [VERIFY].
      </Notice>

      <Grid columns={3}>
        <Card title="Research status">
          <Field label="Project research state">
            <Select
              value={project.researchStatus}
              options={RESEARCH_STATUSES}
              onChange={(event) =>
                updateProject(project.id, (item) => ({ ...item, researchStatus: event.target.value as ResearchStatus }))
              }
            />
          </Field>
          <div className="audit-row">
            <span>Claims</span>
            <strong>{project.claims.length}</strong>
          </div>
          <div className="audit-row">
            <span>Verified</span>
            <strong>{project.claims.filter((claim) => claim.status === 'verified').length}</strong>
          </div>
          <div className="audit-row">
            <span>Sources</span>
            <strong>{project.sources.length}</strong>
          </div>
        </Card>

        <Card title="[VERIFY] markers in the storyboard">
          {verifyFlags.length ? (
            <ul className="flag-list">
              {verifyFlags.slice(0, 8).map((flag) => (
                <li key={flag.id}>
                  <code>{flag.flag}</code>
                  <a href={`#/storyboard?scene=${flag.sceneId}`}>
                    Scene {flag.sceneNumber}: {flag.sceneTitle}
                  </a>
                </li>
              ))}
              {verifyFlags.length > 8 && <li className="muted small">+{verifyFlags.length - 8} more…</li>}
            </ul>
          ) : (
            <p className="muted">No [VERIFY] markers found. That does not mean the script is correct — confirm each figure against a source above.</p>
          )}
        </Card>

        <Card title="Research notes">
          <TextArea
            rows={3}
            value={noteDraft}
            placeholder="What did you read? What contradicts it? Add a note, then attach a claim later."
            onChange={(event) => setNoteDraft(event.target.value)}
          />
          <Button
            size="sm"
            onClick={() => {
              if (!noteDraft.trim()) return;
              updateProject(project.id, (item) => ({
                ...item,
                researchNotes: [{ id: uid('note'), text: noteDraft.trim(), createdAt: Date.now() }, ...item.researchNotes],
              }));
              setNoteDraft('');
            }}
          >
            Save note
          </Button>
          <ul className="note-list">
            {project.researchNotes.slice(0, 5).map((note) => (
              <li key={note.id}>{note.text}</li>
            ))}
          </ul>
        </Card>
      </Grid>

      <Card
        title="Claims"
        subtitle="A claim without a source stays unverified, and unverified claims should not be narrated as fact."
      >
        {project.claims.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Status</th>
                  <th>Sources</th>
                  <th>Scene</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {project.claims.map((claim) => (
                  <tr key={claim.id}>
                    <td>
                      <strong>{claim.text}</strong>
                      {claim.notes && <div className="muted small">{claim.notes}</div>}
                    </td>
                    <td>
                      <Badge
                        tone={
                          claim.status === 'verified'
                            ? 'success'
                            : claim.status === 'disputed'
                              ? 'danger'
                              : claim.status === 'opinion'
                                ? 'neutral'
                                : 'warning'
                        }
                      >
                        {claim.status}
                      </Badge>
                    </td>
                    <td className="small">
                      {claim.sourceIds.length
                        ? claim.sourceIds
                            .map((id) => project.sources.find((source) => source.id === id)?.title ?? 'Missing source')
                            .join(', ')
                        : '—'}
                    </td>
                    <td className="small">
                      {claim.sceneId ? project.scenes.find((scene) => scene.id === claim.sceneId)?.title ?? '—' : '—'}
                    </td>
                    <td>
                      <div className="row gap-xs">
                        <Button size="sm" variant="subtle" onClick={() => setClaimDraft(claim)}>
                          Edit
                        </Button>
                        <button
                          className="icon-button danger"
                          aria-label="Delete claim"
                          onClick={() => setPendingDelete({ kind: 'claim', id: claim.id })}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No claims recorded yet. Add the first fact you intend to state on camera.</p>
        )}
      </Card>

      <Card title="Sources" subtitle="Primary sources first. Record the publication date and the date you accessed it.">
        {project.sources.length ? (
          <ul className="source-list">
            {project.sources.map((source) => (
              <li key={source.id}>
                <div>
                  <strong>{source.title}</strong>
                  {source.primary && <Badge tone="accent">primary</Badge>}
                  <div className="muted small">
                    {source.publisher}
                    {source.publishedAt ? ` · published ${source.publishedAt}` : ''}
                    {source.accessedAt ? ` · accessed ${source.accessedAt}` : ''}
                  </div>
                  {source.url && (
                    <a className="small link" href={source.url} target="_blank" rel="noreferrer noopener">
                      {source.url}
                    </a>
                  )}
                </div>
                <div className="row gap-xs">
                  <Button size="sm" variant="subtle" onClick={() => setSourceDraft(source)}>
                    Edit
                  </Button>
                  <button
                    className="icon-button danger"
                    aria-label="Delete source"
                    onClick={() => setPendingDelete({ kind: 'source', id: source.id })}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No sources yet. Add the document you would cite if someone challenged the video.</p>
        )}
      </Card>

      <Modal
        open={Boolean(claimDraft)}
        title={claimDraft && project.claims.some((claim) => claim.id === claimDraft.id) ? 'Edit claim' : 'Add claim'}
        onClose={() => setClaimDraft(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setClaimDraft(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveClaim}>
              Save claim
            </Button>
          </>
        }
      >
        {claimDraft && (
          <div className="stack-sm">
            <Field label="Claim" hint="State it exactly as the narration would.">
              <TextArea rows={3} value={claimDraft.text} onChange={(event) => setClaimDraft({ ...claimDraft, text: event.target.value })} />
            </Field>
            <Grid columns={2}>
              <Field label="Status">
                <Select
                  value={claimDraft.status}
                  options={CLAIM_STATUSES}
                  onChange={(event) => setClaimDraft({ ...claimDraft, status: event.target.value as ClaimStatus })}
                />
              </Field>
              <Field label="Attach to scene">
                <Select
                  value={claimDraft.sceneId ?? ''}
                  options={[{ value: '', label: 'Not attached' }, ...project.scenes.map((scene, index) => ({ value: scene.id, label: `${index + 1}. ${scene.title}` }))]}
                  onChange={(event) => setClaimDraft({ ...claimDraft, sceneId: event.target.value || undefined })}
                />
              </Field>
            </Grid>
            <Field label="Supporting sources">
              {project.sources.length ? (
                <div className="checkbox-list">
                  {project.sources.map((source) => (
                    <label key={source.id} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={claimDraft.sourceIds.includes(source.id)}
                        onChange={(event) =>
                          setClaimDraft({
                            ...claimDraft,
                            sourceIds: event.target.checked
                              ? [...claimDraft.sourceIds, source.id]
                              : claimDraft.sourceIds.filter((id) => id !== source.id),
                          })
                        }
                      />
                      <span>{source.title || source.url}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="muted small">Add a source first, then attach it here.</p>
              )}
            </Field>
            <Field label="Notes" hint="Contradictions, date caveats, what still needs checking.">
              <TextArea rows={3} value={claimDraft.notes} onChange={(event) => setClaimDraft({ ...claimDraft, notes: event.target.value })} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(sourceDraft)}
        title={sourceDraft && project.sources.some((source) => source.id === sourceDraft.id) ? 'Edit source' : 'Add source'}
        onClose={() => setSourceDraft(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSourceDraft(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveSource}>
              Save source
            </Button>
          </>
        }
      >
        {sourceDraft && (
          <div className="stack-sm">
            <Field label="Title">
              <TextInput value={sourceDraft.title} onChange={(event) => setSourceDraft({ ...sourceDraft, title: event.target.value })} />
            </Field>
            <Field label="URL">
              <TextInput
                value={sourceDraft.url}
                placeholder="https://"
                onChange={(event) => setSourceDraft({ ...sourceDraft, url: event.target.value })}
              />
            </Field>
            <Grid columns={2}>
              <Field label="Publisher / author">
                <TextInput value={sourceDraft.publisher} onChange={(event) => setSourceDraft({ ...sourceDraft, publisher: event.target.value })} />
              </Field>
              <Field label="Published date">
                <TextInput
                  type="date"
                  value={sourceDraft.publishedAt}
                  onChange={(event) => setSourceDraft({ ...sourceDraft, publishedAt: event.target.value })}
                />
              </Field>
              <Field label="Accessed date">
                <TextInput
                  type="date"
                  value={sourceDraft.accessedAt}
                  onChange={(event) => setSourceDraft({ ...sourceDraft, accessedAt: event.target.value })}
                />
              </Field>
              <Field label="Primary document?">
                <Select
                  value={sourceDraft.primary ? 'yes' : 'no'}
                  options={[
                    { value: 'yes', label: 'Yes — filing, announcement, interview, original data' },
                    { value: 'no', label: 'No — secondary reporting' },
                  ]}
                  onChange={(event) => setSourceDraft({ ...sourceDraft, primary: event.target.value === 'yes' })}
                />
              </Field>
            </Grid>
            <Field label="Notes">
              <TextArea rows={2} value={sourceDraft.notes} onChange={(event) => setSourceDraft({ ...sourceDraft, notes: event.target.value })} />
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === 'claim' ? 'Delete claim?' : 'Delete source?'}
        body="This removes the record from this project. It cannot be undone."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            updateProject(project.id, (item) => ({
              ...item,
              claims:
                pendingDelete.kind === 'claim'
                  ? item.claims.filter((claim) => claim.id !== pendingDelete.id)
                  : item.claims,
              sources:
                pendingDelete.kind === 'source'
                  ? item.sources.filter((source) => source.id !== pendingDelete.id)
                  : item.sources,
            }));
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
