import React from 'react';
import { useStore } from '../state/store';
import { Badge, Button, Card, EmptyState, Grid, Notice, PageHeader, ProgressBar, Stat } from '../components/ui';
import { Icon } from '../components/Icon';
import { pacingAudit } from '../lib/script';
import { timelineDuration } from '../lib/sequence';
import { formatDuration } from '../lib/time';

export function Dashboard(): React.ReactElement {
  const { state, activeProject, setActiveProjectId, updateSettings } = useStore();
  const projects = state.projects.filter((project) => !project.archived);
  const recordings = state.assets.filter((asset) => asset.kind === 'audio');
  const exportedScenes = activeProject
    ? activeProject.scenes.filter((scene) => scene.captions.length > 0).length
    : 0;

  const steps = activeProject
    ? [
        {
          label: 'Research',
          done: activeProject.claims.length > 0 && activeProject.claims.every((claim) => claim.status === 'verified'),
          detail: `${activeProject.claims.length} claim${activeProject.claims.length === 1 ? '' : 's'} · ${activeProject.researchStatus}`,
          href: '#/research',
        },
        {
          label: 'Script',
          done: activeProject.script.hook.trim().length > 10 && activeProject.script.narration.trim().length > 80,
          detail: `${activeProject.script.narration.trim() ? activeProject.script.narration.trim().split(/\s+/).length : 0} words`,
          href: '#/scripts',
        },
        {
          label: 'Storyboard',
          done: activeProject.scenes.length > 0 && activeProject.scenes.every((scene) => scene.motion.trim().length > 20),
          detail: `${activeProject.scenes.length} scene${activeProject.scenes.length === 1 ? '' : 's'}`,
          href: '#/storyboard',
        },
        {
          label: 'Assets',
          done: state.assets.some((asset) => asset.projectId === activeProject.id),
          detail: `${state.assets.filter((asset) => asset.projectId === activeProject.id).length} attached`,
          href: '#/assets',
        },
        {
          label: 'Voice',
          done: activeProject.audioTracks.length > 0,
          detail: `${activeProject.audioTracks.length} track${activeProject.audioTracks.length === 1 ? '' : 's'}`,
          href: '#/voice',
        },
        {
          label: 'Animation',
          done: activeProject.scenes.some((scene) => scene.layers.some((layer) => layer.animations.length > 0)),
          detail: `${activeProject.scenes.filter((scene) => scene.layers.length > 0).length} staged`,
          href: '#/animation',
        },
        {
          label: 'Captions',
          done: activeProject.scenes.length > 0 && exportedScenes === activeProject.scenes.length,
          detail: `${exportedScenes}/${activeProject.scenes.length} scenes`,
          href: '#/storyboard',
        },
      ]
    : [];

  const completed = steps.filter((step) => step.done).length;
  const audit = activeProject ? pacingAudit(activeProject) : null;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Ascend studio"
        title="Become greater than yesterday."
        description="A production workspace for monochrome cartoon documentaries: research, script, storyboard, animate, narrate, caption, export. Everything runs locally in this browser."
        actions={
          <div className="row gap-sm wrap">
            <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={() => (window.location.hash = '#/projects')}>
              New project
            </Button>
            <Button variant="ghost" onClick={() => (window.location.hash = '#/animation')}>
              Open Animation Studio
            </Button>
          </div>
        }
      />

      <Grid columns={4}>
        <Stat label="Projects" value={projects.length} hint={`${state.projects.length - projects.length} archived`} accent />
        <Stat label="Scenes" value={state.projects.reduce((sum, project) => sum + project.scenes.length, 0)} hint="Across all projects" />
        <Stat label="Recordings" value={recordings.length} hint="Stored in this browser" />
        <Stat
          label="Active timeline"
          value={activeProject ? formatDuration(timelineDuration(activeProject)) : '—'}
          hint={activeProject ? `${activeProject.scenes.length} scenes` : 'No project selected'}
        />
      </Grid>

      {!state.settings.storageWarningAccepted && (
        <Notice tone="warning" title="Your work lives in this browser only">
          <p>
            AscendCC saves projects to localStorage and media to IndexedDB on this device. There is no cloud backup:
            clearing browser data deletes everything. Export project JSON from Settings after each session.
          </p>
          <div className="row gap-sm">
            <Button size="sm" variant="ghost" onClick={() => updateSettings({ storageWarningAccepted: true })}>
              Understood
            </Button>
            <Button size="sm" variant="subtle" onClick={() => (window.location.hash = '#/settings')}>
              Open Settings
            </Button>
          </div>
        </Notice>
      )}

      {activeProject ? (
        <>
          <Card
            title={`Production: ${activeProject.name}`}
            subtitle={`${activeProject.platform} · ${activeProject.orientation} · ${activeProject.durationSec}s target · ${activeProject.contentMode}`}
            actions={
              <Badge tone={completed === steps.length ? 'success' : 'accent'}>
                {completed}/{steps.length} stages
              </Badge>
            }
          >
            <ProgressBar value={completed / steps.length} label="Production progress" />
            <div className="pipeline">
              {steps.map((step) => (
                <a key={step.label} href={step.href} className={`pipeline-step ${step.done ? 'is-done' : ''}`}>
                  <span className="pipeline-dot">{step.done ? <Icon name="check" size={12} /> : null}</span>
                  <span className="pipeline-label">{step.label}</span>
                  <span className="pipeline-detail">{step.detail}</span>
                </a>
              ))}
            </div>
          </Card>

          <Grid columns={3}>
            <Card title="Next actions" subtitle="Ordered by what unblocks the most work">
              <ul className="action-list">
                {!activeProject.script.hook.trim() && (
                  <li>
                    <Icon name="script" size={16} />
                    <span>Write a three-second hook that states the real stakes.</span>
                    <a href="#/scripts">Script</a>
                  </li>
                )}
                {activeProject.scenes.length < 3 && (
                  <li>
                    <Icon name="film" size={16} />
                    <span>Generate a storyboard scaffold, then replace every [VERIFY] slot with a sourced fact.</span>
                    <a href="#/storyboard">Storyboard</a>
                  </li>
                )}
                {!activeProject.audioTracks.length && (
                  <li>
                    <Icon name="mic" size={16} />
                    <span>Record narration in your own voice, then derive approximate lip-sync.</span>
                    <a href="#/voice">Voice</a>
                  </li>
                )}
                {!activeProject.scenes.some((scene) => scene.layers.length) && (
                  <li>
                    <Icon name="play" size={16} />
                    <span>Stage Marlowe and at least one prop layer on the timeline.</span>
                    <a href="#/animation">Animation</a>
                  </li>
                )}
                <li>
                  <Icon name="download" size={16} />
                  <span>Export captions as SRT and the animation as WebM when the cut is ready.</span>
                  <a href="#/animation">Export</a>
                </li>
              </ul>
            </Card>

            <Card title="Timing audit" subtitle="Estimates are from word count, never recordings">
              {audit ? (
                <>
                  <div className="audit-row">
                    <span>Spoken estimate</span>
                    <strong>{audit.spokenSeconds.toFixed(1)}s</strong>
                  </div>
                  <div className="audit-row">
                    <span>Storyboard length</span>
                    <strong>{audit.timelineSeconds.toFixed(1)}s</strong>
                  </div>
                  <Notice tone={audit.status === 'over' ? 'danger' : audit.status === 'tight' ? 'warning' : 'success'}>
                    {audit.advice}
                  </Notice>
                </>
              ) : (
                <p className="muted">Select a project to audit pacing.</p>
              )}
            </Card>

            <Card title="Local storage" subtitle="What the browser is holding">
              <div className="audit-row">
                <span>Projects</span>
                <strong>{state.projects.length}</strong>
              </div>
              <div className="audit-row">
                <span>Media assets</span>
                <strong>{state.assets.length}</strong>
              </div>
              <div className="audit-row">
                <span>Calendar entries</span>
                <strong>{state.calendar.length}</strong>
              </div>
              <div className="audit-row">
                <span>Performance rows</span>
                <strong>{state.metrics.length}</strong>
              </div>
              <p className="muted small">
                No servers, no accounts, no API keys. Export JSON before clearing browser data.
              </p>
            </Card>
          </Grid>
        </>
      ) : (
        <EmptyState
          icon={<Icon name="folder" size={26} />}
          title="Start with one project"
          body="A project holds the script, storyboard, audio, animation layers and export settings for one video. Create one and the full pipeline lights up."
          action={
            <Button variant="primary" onClick={() => (window.location.hash = '#/projects')}>
              Create your first project
            </Button>
          }
        />
      )}

      <Card
        title="Recent projects"
        subtitle="Most recently edited first"
        actions={<Button size="sm" variant="ghost" onClick={() => (window.location.hash = '#/projects')}>All projects</Button>}
      >
        {projects.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Scenes</th>
                  <th>Runtime</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...projects]
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .slice(0, 6)
                  .map((project) => (
                    <tr key={project.id}>
                      <td>
                        <strong>{project.name}</strong>
                        <div className="muted small">{project.topic || 'No topic yet'}</div>
                      </td>
                      <td>
                        <Badge tone={project.status === 'published' ? 'success' : 'neutral'}>{project.status}</Badge>
                      </td>
                      <td>{project.scenes.length}</td>
                      <td>{formatDuration(timelineDuration(project))}</td>
                      <td className="muted small">{new Date(project.updatedAt).toLocaleDateString()}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="subtle"
                          onClick={() => {
                            setActiveProjectId(project.id);
                            window.location.hash = '#/storyboard';
                          }}
                        >
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No projects yet. Create one to begin.</p>
        )}
      </Card>
    </div>
  );
}
