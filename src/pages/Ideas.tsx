import React, { useState } from 'react';
import { useStore } from '../state/store';
import { ideaAngles, SERIES_IDEAS, hookOptions, titleOptions, thumbnailTextFor, hashtagsFor } from '../lib/templates';
import { createProject } from '../lib/factory';
import { Badge, Button, Card, CopyButton, EmptyState, Field, Grid, Notice, PageHeader, TextInput } from '../components/ui';
import { Icon } from '../components/Icon';

export function Ideas(): React.ReactElement {
  const { state, activeProject, setIdeas, addProject, toast } = useStore();
  const [topic, setTopic] = useState(activeProject?.topic ?? '');
  const [filter, setFilter] = useState('');

  const generate = () => {
    if (!topic.trim()) {
      toast('Enter a topic first.', 'warning');
      return;
    }
    const generated = ideaAngles(topic);
    setIdeas((ideas) => [...generated, ...ideas]);
    toast(`${generated.length} angles added.`, 'success');
  };

  const visibleIdeas = state.ideas.filter(
    (idea) =>
      !idea.archived &&
      (!filter || `${idea.title} ${idea.angle} ${idea.category}`.toLowerCase().includes(filter.toLowerCase())),
  );

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Strategy"
        title="Ideas"
        description="Turn a raw topic into defensible angles. Every angle here is a question to research, not a fact to repeat."
        actions={
          <div className="row gap-sm">
            <Field label="Topic">
              <TextInput
                value={topic}
                placeholder="e.g. Nintendo in 1889"
                onChange={(event) => setTopic(event.target.value)}
              />
            </Field>
            <Button variant="primary" onClick={generate}>
              Generate angles
            </Button>
          </div>
        }
      />

      <Grid columns={2}>
        <Card title="Hook options" subtitle={`Five structures for “${topic || activeProject?.topic || 'your topic'}”`}>
          <ul className="deliverable-list">
            {hookOptions(topic || activeProject?.topic || '', activeProject?.audience ?? '').map((hook) => (
              <li key={hook}>
                <span>{hook}</span>
                <CopyButton text={hook} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Titles and packaging" subtitle="Editorial options — confirm the facts before publishing">
          <div className="stack-sm">
            <div>
              <span className="field-label">Title options</span>
              <ul className="deliverable-list">
                {titleOptions(topic || activeProject?.topic || '').map((title) => (
                  <li key={title}>
                    <span>{title}</span>
                    <CopyButton text={title} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="row gap-sm wrap">
              <Badge tone="accent">Thumbnail: {thumbnailTextFor(topic || activeProject?.topic || '')}</Badge>
              <Badge>{hashtagsFor(topic || activeProject?.topic || '', activeProject?.contentMode ?? 'documentary').join(' ')}</Badge>
            </div>
          </div>
        </Card>
      </Grid>

      <Card
        title={`Idea bank (${state.ideas.filter((idea) => !idea.archived).length})`}
        subtitle="Promote an idea straight into a project, then research it."
        actions={
          <TextInput
            placeholder="Filter ideas"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        }
      >
        {visibleIdeas.length ? (
          <div className="idea-grid">
            {visibleIdeas.map((idea) => (
              <article key={idea.id} className="idea-card">
                <header>
                  <Badge tone="neutral">{idea.category}</Badge>
                  <button
                    className="icon-button danger"
                    aria-label="Delete idea"
                    onClick={() => setIdeas((ideas) => ideas.filter((item) => item.id !== idea.id))}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </header>
                <h4>{idea.title}</h4>
                <p>{idea.angle}</p>
                <blockquote>{idea.hook}</blockquote>
                <footer>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      const project = createProject(
                        {
                          name: idea.title,
                          topic: idea.title,
                          audience: activeProject?.audience ?? '',
                          objective: idea.angle,
                          durationSec: state.settings.defaultDuration,
                          contentMode: 'documentary',
                        },
                        state.settings,
                      );
                      addProject(project);
                      toast('Project created from idea.', 'success');
                      window.location.hash = '#/research';
                    }}
                  >
                    Create project
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIdeas((ideas) => ideas.map((item) => (item.id === idea.id ? { ...item, archived: true } : item)))}
                  >
                    Archive
                  </Button>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Icon name="bulb" size={26} />}
            title="No ideas yet"
            body="Enter a topic above and generate six angles: origin, near-collapse, hidden strategy, one number, honest comparison and myth test."
            action={
              <Button variant="primary" onClick={generate}>
                Generate angles
              </Button>
            }
          />
        )}
      </Card>

      <Card title="Ten series ideas" subtitle="Reusable formats that do not require a new concept every day">
        <ol className="numbered-list">
          {SERIES_IDEAS.map((series) => (
            <li key={series}>{series}</li>
          ))}
        </ol>
      </Card>

      <Notice tone="info" title="What the generator does not do">
        Angles and hooks are structural templates, not research. AscendCC has no browsing ability and does not invent
        numbers. Replace every bracket with a sourced fact before recording.
      </Notice>
    </div>
  );
}
