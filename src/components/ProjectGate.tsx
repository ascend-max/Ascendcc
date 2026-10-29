import React from 'react';
import type { Project } from '../types';
import { useStore } from '../state/store';
import { Button, EmptyState } from './ui';
import { Icon } from './Icon';

/**
 * Every production screen needs a project. This gate keeps the app honest: no
 * fake data, just a clear next action.
 */
export function ProjectGate({
  children,
  feature = 'this workspace',
}: {
  children: (project: Project) => React.ReactNode;
  feature?: string;
}): React.ReactElement {
  const { activeProject, state, setActiveProjectId } = useStore();

  if (activeProject) return <>{children(activeProject)}</>;

  const first = state.projects.find((project) => !project.archived);
  return (
    <EmptyState
      icon={<Icon name="folder" size={26} />}
      title="No project selected"
      body={`${feature.charAt(0).toUpperCase() + feature.slice(1)} works on one project at a time. Create a project or select an existing one to continue.`}
      action={
        <div className="row gap-sm wrap">
          <Button variant="primary" onClick={() => (window.location.hash = '#/projects')}>
            Create a project
          </Button>
          {first && (
            <Button variant="ghost" onClick={() => setActiveProjectId(first.id)}>
              Open “{first.name}”
            </Button>
          )}
        </div>
      }
    />
  );
}
