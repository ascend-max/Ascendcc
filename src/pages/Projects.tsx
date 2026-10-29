import React, { useState } from 'react';
import type { ContentMode, Orientation, Platform, ProjectStatus } from '../types';
import { useStore } from '../state/store';
import { CONTENT_MODES } from '../lib/templates';
import { createProject } from '../lib/factory';
import { timelineDuration } from '../lib/sequence';
import { formatDuration } from '../lib/time';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Grid,
  Modal,
  Notice,
  PageHeader,
  Select,
  TextArea,
  TextInput,
  Toggle,
} from '../components/ui';
import { Icon } from '../components/Icon';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'youtube-shorts', label: 'YouTube Shorts' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram-reels', label: 'Instagram Reels' },
  { value: 'youtube', label: 'YouTube (long form)' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const STATUSES: ProjectStatus[] = [
  'idea',
  'research',
  'script',
  'storyboard',
  'assets',
  'voice',
  'animation',
  'review',
  'published',
];

const ORIENTATIONS: { value: Orientation; label: string }[] = [
  { value: '9:16', label: '9:16 vertical' },
  { value: '16:9', label: '16:9 widescreen' },
  { value: '1:1', label: '1:1 square' },
];

export function Projects(): React.ReactElement {
  const {
    state,
    activeProject,
    activeProjectId,
    addProject,
    updateProject,
    removeProject,
    duplicateProject,
    setActiveProjectId,
    updateSettings,
    toast,
  } = useStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    topic: '',
    audience: '',
    objective: '',
    platform: state.settings.defaultPlatform as Platform,
    contentMode: 'documentary' as ContentMode,
    durationSec: state.settings.defaultDuration,
    orientation: state.settings.defaultOrientation as Orientation,
  });

  const visible = state.projects.filter((project) => (showArchived ? true : !project.archived));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      toast('Give the project a name first.', 'warning');
      return;
    }
    const project = createProject(
      {
        name: draft.name,
        topic: draft.topic,
        audience: draft.audience,
        objective: draft.objective,
        platform: draft.platform,
        durationSec: draft.durationSec,
        contentMode: draft.contentMode,
        orientation: draft.orientation,
      },
      state.settings,
    );
    addProject(project);
    setCreateOpen(false);
    setDraft({
      name: '',
      topic: '',
      audience: '',
      objective: '',
      platform: state.settings.defaultPlatform,
      contentMode: 'documentary',
      durationSec: state.settings.defaultDuration,
      orientation: state.settings.defaultOrientation,
    });
    toast('Project created.', 'success');
    window.location.hash = '#/scripts';
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="One project = one video. Everything else in AscendCC hangs off the project you select here."
        actions={
          <div className="row gap-sm wrap">
            <Button variant="ghost" onClick={() => setShowArchived((value) => !value)}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
            <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={() => setCreateOpen(true)}>
              New project
            </Button>
          </div>
        }
      />

      {!state.settings.storageWarningAccepted && (
        <Notice tone="info" title="Local only">
          Projects save automatically to this browser. Export a JSON backup from Settings; there is no cloud sync.
        </Notice>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Icon name="folder" size={26} />}
          title="No projects yet"
          body="Create a project about a company, a person, or an idea. AscendCC will keep the script, storyboard, narration and animation together."
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              Create a project
            </Button>
          }
        />
      ) : (
        <div className="project-grid">
          {visible.map((project) => (
            <article key={project.id} className={`project-card ${project.id === activeProjectId ? 'is-active' : ''}`}>
              <header>
                <div>
                  <h3>{project.name}</h3>
                  <p className="muted small">{project.topic || 'No topic yet'}</p>
                </div>
                <Badge tone={project.status === 'published' ? 'success' : project.archived ? 'warning' : 'neutral'}>
                  {project.archived ? 'archived' : project.status}
                </Badge>
              </header>
              <div className="project-meta">
                <span>{project.scenes.length} scenes</span>
                <span>{formatDuration(timelineDuration(project))}</span>
                <span>{project.orientation}</span>
                <span>{project.platform.replace('-', ' ')}</span>
              </div>
              <p className="muted small">
                {project.script.hook ? `Hook: ${project.script.hook.slice(0, 90)}${project.script.hook.length > 90 ? '…' : ''}` : 'No hook written yet.'}
              </p>
              <footer>
                <Button
                  size="sm"
                  variant={project.id === activeProjectId ? 'primary' : 'secondary'}
                  onClick={() => {
                    setActiveProjectId(project.id);
                    toast(`Selected “${project.name}”.`, 'info');
                  }}
                >
                  {project.id === activeProjectId ? 'Selected' : 'Select'}
                </Button>
                <Button size="sm" variant="subtle" onClick={() => duplicateProject(project.id)}>
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => updateProject(project.id, (item) => ({ ...item, archived: !item.archived }))}
                >
                  {project.archived ? 'Restore' : 'Archive'}
                </Button>
                <button className="icon-button danger" aria-label="Delete project" onClick={() => setPendingDelete(project.id)}>
                  <Icon name="trash" size={15} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {activeProject && (
        <Card
          title={`Project settings — ${activeProject.name}`}
          subtitle="These fields feed the generators, captions and export metadata."
        >
          <Grid columns={2}>
            <Field label="Project name">
              <TextInput
                value={activeProject.name}
                onChange={(event) => updateProject(activeProject.id, (project) => ({ ...project, name: event.target.value }))}
              />
            </Field>
            <Field label="Topic" hint="What the video is actually about. Used by hooks, titles and hashtags.">
              <TextInput
                value={activeProject.topic}
                onChange={(event) => updateProject(activeProject.id, (project) => ({ ...project, topic: event.target.value }))}
              />
            </Field>
            <Field label="Target audience">
              <TextInput
                value={activeProject.audience}
                placeholder="e.g. beginner investors in South Africa"
                onChange={(event) => updateProject(activeProject.id, (project) => ({ ...project, audience: event.target.value }))}
              />
            </Field>
            <Field label="Objective" hint="One sentence. Inform, explain, position, sell.">
              <TextInput
                value={activeProject.objective}
                onChange={(event) => updateProject(activeProject.id, (project) => ({ ...project, objective: event.target.value }))}
              />
            </Field>
            <Field label="Content mode">
              <Select
                value={activeProject.contentMode}
                options={CONTENT_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
                onChange={(event) =>
                  updateProject(activeProject.id, (project) => ({
                    ...project,
                    contentMode: event.target.value as ContentMode,
                  }))
                }
              />
            </Field>
            <Field label="Platform">
              <Select
                value={activeProject.platform}
                options={PLATFORMS}
                onChange={(event) =>
                  updateProject(activeProject.id, (project) => ({ ...project, platform: event.target.value as Platform }))
                }
              />
            </Field>
            <Field label="Orientation">
              <Select
                value={activeProject.orientation}
                options={ORIENTATIONS}
                onChange={(event) =>
                  updateProject(activeProject.id, (project) => ({
                    ...project,
                    orientation: event.target.value as Orientation,
                  }))
                }
              />
            </Field>
            <Field label="Target duration (seconds)" hint="Scene durations are fitted to this in Storyboard Studio.">
              <TextInput
                type="number"
                min={5}
                max={600}
                value={activeProject.durationSec}
                onChange={(event) =>
                  updateProject(activeProject.id, (project) => ({
                    ...project,
                    durationSec: Math.max(5, Number(event.target.value) || 45),
                  }))
                }
              />
            </Field>
            <Field label="Status">
              <Select
                value={activeProject.status}
                options={STATUSES.map((status) => ({ value: status, label: status }))}
                onChange={(event) =>
                  updateProject(activeProject.id, (project) => ({
                    ...project,
                    status: event.target.value as ProjectStatus,
                  }))
                }
              />
            </Field>
            <Field label="Narration style">
              <TextInput
                value={activeProject.narrationStyle}
                onChange={(event) =>
                  updateProject(activeProject.id, (project) => ({ ...project, narrationStyle: event.target.value }))
                }
              />
            </Field>
            <Field label="Visual style">
              <TextInput
                value={activeProject.visualStyle}
                onChange={(event) =>
                  updateProject(activeProject.id, (project) => ({ ...project, visualStyle: event.target.value }))
                }
              />
            </Field>
            <Field label="Format">
              <TextInput
                value={activeProject.format}
                onChange={(event) => updateProject(activeProject.id, (project) => ({ ...project, format: event.target.value }))}
              />
            </Field>
          </Grid>

          <Toggle
            checked={activeProject.settings.colourAccents}
            onChange={(checked) =>
              updateProject(activeProject.id, (project) => ({
                ...project,
                settings: { ...project.settings, colourAccents: checked },
              }))
            }
            label="Allow meaning-carrying colour accents"
            hint="Gold for money, red for risk, green for growth. Characters stay grayscale."
          />

          <div className="danger-zone">
            <div>
              <strong>Delete this project</strong>
              <p className="muted small">Removes the project and its storyboard. Media files in the Asset Library stay until deleted there.</p>
            </div>
            <Button variant="danger" onClick={() => setPendingDelete(activeProject.id)}>
              Delete project
            </Button>
          </div>
        </Card>
      )}

      <Modal
        open={createOpen}
        title="New project"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit}>
              Create project
            </Button>
          </>
        }
      >
        <form className="stack-sm" onSubmit={submit}>
          <Field label="Project name" hint="Usually the subject: “Nvidia: the near-collapse”.">
            <TextInput
              autoFocus
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="e.g. The company that almost died"
            />
          </Field>
          <Field label="Topic">
            <TextInput
              value={draft.topic}
              onChange={(event) => setDraft({ ...draft, topic: event.target.value })}
              placeholder="e.g. Nvidia's near-bankruptcy in 1996"
            />
          </Field>
          <Field label="Target audience">
            <TextInput
              value={draft.audience}
              onChange={(event) => setDraft({ ...draft, audience: event.target.value })}
              placeholder="e.g. beginners curious about business"
            />
          </Field>
          <Field label="Objective">
            <TextArea
              rows={2}
              value={draft.objective}
              onChange={(event) => setDraft({ ...draft, objective: event.target.value })}
              placeholder="One sentence describing what the viewer should understand afterwards."
            />
          </Field>
          <Grid columns={2}>
            <Field label="Content mode">
              <Select
                value={draft.contentMode}
                options={CONTENT_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
                onChange={(event) => setDraft({ ...draft, contentMode: event.target.value as ContentMode })}
              />
            </Field>
            <Field label="Platform">
              <Select
                value={draft.platform}
                options={PLATFORMS}
                onChange={(event) => setDraft({ ...draft, platform: event.target.value as Platform })}
              />
            </Field>
            <Field label="Duration (seconds)">
              <TextInput
                type="number"
                min={5}
                max={600}
                value={draft.durationSec}
                onChange={(event) => setDraft({ ...draft, durationSec: Number(event.target.value) || 45 })}
              />
            </Field>
            <Field label="Orientation">
              <Select
                value={draft.orientation}
                options={ORIENTATIONS}
                onChange={(event) => setDraft({ ...draft, orientation: event.target.value as Orientation })}
              />
            </Field>
          </Grid>
          <p className="muted small">
            A 45-second vertical animated documentary is the default. You can change all of this later.
          </p>
          <button type="submit" hidden />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete project?"
        body="This permanently removes the project, its script, storyboard, captions and audio track links from this browser. This cannot be undone."
        confirmLabel="Delete project"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            removeProject(pendingDelete);
            toast('Project deleted.', 'info');
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
