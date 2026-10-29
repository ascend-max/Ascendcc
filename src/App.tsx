import React, { useEffect, useMemo, useState } from 'react';
import type { RouteId } from './types';
import { StoreProvider, useStore } from './state/store';
import { Icon, type IconName } from './components/Icon';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Research } from './pages/Research';
import { Ideas } from './pages/Ideas';
import { ScriptStudio } from './pages/ScriptStudio';
import { StoryboardStudio } from './pages/StoryboardStudio';
import { CharacterStudio } from './pages/CharacterStudio';
import { AssetLibrary } from './pages/AssetLibrary';
import { AnimationStudio } from './pages/AnimationStudio';
import { VoiceStudio } from './pages/VoiceStudio';
import { SalesStudio } from './pages/SalesStudio';
import { ContentCalendar } from './pages/ContentCalendar';
import { Analytics } from './pages/Analytics';
import { SettingsPage } from './pages/SettingsPage';
import { ToastStack } from './components/ToastStack';

interface NavItem {
  id: RouteId;
  label: string;
  icon: IconName;
  group: 'start' | 'produce' | 'grow';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid', group: 'start' },
  { id: 'projects', label: 'Projects', icon: 'folder', group: 'start' },
  { id: 'research', label: 'Research', icon: 'search', group: 'start' },
  { id: 'ideas', label: 'Ideas', icon: 'bulb', group: 'start' },
  { id: 'scripts', label: 'Script Studio', icon: 'script', group: 'produce' },
  { id: 'storyboard', label: 'Storyboard Studio', icon: 'film', group: 'produce' },
  { id: 'characters', label: 'Character Studio', icon: 'mask', group: 'produce' },
  { id: 'assets', label: 'Asset Library', icon: 'image', group: 'produce' },
  { id: 'animation', label: 'Animation Studio', icon: 'play', group: 'produce' },
  { id: 'voice', label: 'Voice Studio', icon: 'mic', group: 'produce' },
  { id: 'sales', label: 'Sales Studio', icon: 'tag', group: 'grow' },
  { id: 'calendar', label: 'Content Calendar', icon: 'calendar', group: 'grow' },
  { id: 'analytics', label: 'Analytics', icon: 'chart', group: 'grow' },
  { id: 'settings', label: 'Settings', icon: 'gear', group: 'start' },
];

const ROUTE_IDS = new Set<string>(NAV_ITEMS.map((item) => item.id));

function currentRoute(): RouteId {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return (ROUTE_IDS.has(hash) ? hash : 'dashboard') as RouteId;
}

function useRoute(): RouteId {
  const [route, setRoute] = useState<RouteId>(() => currentRoute());
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

function renderRoute(route: RouteId): React.ReactElement {
  switch (route) {
    case 'projects':
      return <Projects />;
    case 'research':
      return <Research />;
    case 'ideas':
      return <Ideas />;
    case 'scripts':
      return <ScriptStudio />;
    case 'storyboard':
      return <StoryboardStudio />;
    case 'characters':
      return <CharacterStudio />;
    case 'assets':
      return <AssetLibrary />;
    case 'animation':
      return <AnimationStudio />;
    case 'voice':
      return <VoiceStudio />;
    case 'sales':
      return <SalesStudio />;
    case 'calendar':
      return <ContentCalendar />;
    case 'analytics':
      return <Analytics />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <Dashboard />;
  }
}

function Shell(): React.ReactElement {
  const route = useRoute();
  const { state, activeProjectId, setActiveProjectId, saveStatus } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeItem = NAV_ITEMS.find((item) => item.id === route) ?? NAV_ITEMS[0];
  const projects = useMemo(
    () => state.projects.filter((project) => !project.archived),
    [state.projects],
  );

  useEffect(() => {
    setMobileNavOpen(false);
    window.scrollTo({ top: 0 });
  }, [route]);

  useEffect(() => {
    if (!activeProjectId && projects.length) {
      setActiveProjectId(projects[0].id);
    }
  }, [activeProjectId, projects, setActiveProjectId]);

  const statusLabel =
    saveStatus === 'error'
      ? 'Not saved — storage error'
      : saveStatus === 'saving'
        ? 'Saving…'
        : saveStatus === 'saved'
          ? 'Saved locally'
          : 'Ready';

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">A</div>
          <div>
            <div className="brand-name">AscendCC</div>
            <div className="brand-slogan">Become greater than yesterday.</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {(['start', 'produce', 'grow'] as const).map((group) => (
            <div key={group} className="nav-group">
              <div className="nav-group-label">
                {group === 'start' ? 'Plan' : group === 'produce' ? 'Produce' : 'Grow'}
              </div>
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                <a
                  key={item.id}
                  href={`#/${item.id}`}
                  className={`nav-link ${route === item.id ? 'is-active' : ''}`}
                  aria-current={route === item.id ? 'page' : undefined}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className={`save-dot ${saveStatus === 'error' ? 'is-error' : ''}`} />
          {statusLabel}
        </div>
      </aside>

      {mobileNavOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} />}

      <div className="main-area">
        <header className="topbar">
          <button
            className="icon-button only-mobile"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            <Icon name="menu" />
          </button>
          <div className="topbar-title">
            <span className="topbar-eyebrow">Ascend studio</span>
            <h1>{activeItem.label}</h1>
          </div>

          <div className="topbar-actions">
            <label className="project-picker">
              <span className="only-desktop">Project</span>
              <select
                value={activeProjectId}
                onChange={(event) => setActiveProjectId(event.target.value)}
                aria-label="Active project"
              >
                <option value="">No project selected</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="icon-button only-desktop" onClick={() => setMenuOpen((open) => !open)} aria-label="Help and status">
              <Icon name="info" />
            </button>
          </div>
        </header>

        {menuOpen && (
          <div className="help-popover">
            <strong>Local-first studio</strong>
            <p>
              AscendCC stores projects in this browser and media files in IndexedDB. Nothing is uploaded, and clearing
              browser data will delete your work — export project JSON regularly from Settings.
            </p>
            <p className="muted">
              Slogan: <em>Become greater than yesterday.</em>
            </p>
            <button className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>
              Close
            </button>
          </div>
        )}

        <main className="content">{renderRoute(route)}</main>

        <nav className="mobile-nav" aria-label="Quick navigation">
          {NAV_ITEMS.filter((item) => ['dashboard', 'projects', 'storyboard', 'animation', 'voice'].includes(item.id)).map(
            (item) => (
              <a key={item.id} href={`#/${item.id}`} className={route === item.id ? 'is-active' : ''}>
                <Icon name={item.icon} />
                <span>{item.label.replace(' Studio', '')}</span>
              </a>
            ),
          )}
          <button onClick={() => setMobileNavOpen(true)} aria-label="More sections">
            <Icon name="menu" />
            <span>More</span>
          </button>
        </nav>
      </div>

      <ToastStack />
    </div>
  );
}

export default function App(): React.ReactElement {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
