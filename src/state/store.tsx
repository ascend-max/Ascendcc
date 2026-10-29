import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AppState,
  Asset,
  CalendarEntry,
  Character,
  Idea,
  Project,
  Settings,
  VideoMetric,
} from '../types';
import { defaultCharacters } from '../lib/characters';
import { duplicateProject as cloneProject } from '../lib/factory';
import {
  loadActiveProjectId,
  loadState,
  saveActiveProjectId,
  saveState,
} from '../lib/storage';

export type ToastTone = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface StoreValue {
  state: AppState;
  activeProjectId: string;
  activeProject: Project | undefined;
  setActiveProjectId: (id: string) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string | null;
  toasts: Toast[];
  toast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updater: (project: Project) => Project) => void;
  removeProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;
  addCharacter: (character: Character) => void;
  updateCharacter: (id: string, updater: (character: Character) => Character) => void;
  removeCharacter: (id: string) => void;
  setIdeas: (updater: (ideas: Idea[]) => Idea[]) => void;
  setCalendar: (updater: (entries: CalendarEntry[]) => CalendarEntry[]) => void;
  setMetrics: (updater: (metrics: VideoMetric[]) => VideoMetric[]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceState: (state: AppState) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function withCharacters(state: AppState): AppState {
  const builtin = defaultCharacters();
  const existing = new Map(state.characters.map((character) => [character.id, character]));
  const merged = builtin.map((character) => {
    const found = existing.get(character.id);
    if (!found) return character;
    // Keep the built-in spec current while preserving the creator's toggles.
    return {
      ...character,
      cigarette: found.cigarette,
      smoke: found.smoke,
      notes: found.notes || character.notes,
    };
  });
  for (const character of state.characters) {
    if (!merged.some((item) => item.id === character.id)) merged.push(character);
  }
  return { ...state, characters: merged };
}

export function StoreProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, setState] = useState<AppState>(() => withCharacters(loadState()));
  const [activeProjectId, setActiveProjectIdState] = useState<string>(() => loadActiveProjectId());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const firstSave = useRef(true);

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  /* Persist with a short debounce so typing in a script is not a write per key. */
  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false;
    }
    setSaveStatus('saving');
    const handle = window.setTimeout(() => {
      const result = saveState(state);
      if (result.ok) {
        setSaveStatus('saved');
        setSaveError(null);
      } else {
        setSaveStatus('error');
        setSaveError(result.error ?? 'Could not save.');
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [state]);

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    saveActiveProjectId(id);
  }, []);

  const activeProject = useMemo(
    () => state.projects.find((project) => project.id === activeProjectId),
    [state.projects, activeProjectId],
  );

  const addProject = useCallback((project: Project) => {
    setState((current) => ({ ...current, projects: [project, ...current.projects] }));
    setActiveProjectId(project.id);
  }, [setActiveProjectId]);

  const updateProject = useCallback((id: string, updater: (project: Project) => Project) => {
    setState((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === id ? { ...updater(project), updatedAt: Date.now() } : project,
      ),
    }));
  }, []);

  const removeProject = useCallback(
    (id: string) => {
      setState((current) => ({ ...current, projects: current.projects.filter((project) => project.id !== id) }));
      if (activeProjectId === id) {
        const next = state.projects.find((project) => project.id !== id);
        setActiveProjectId(next?.id ?? '');
      }
    },
    [activeProjectId, setActiveProjectId, state.projects],
  );

  const duplicateProject = useCallback(
    (id: string) => {
      const source = state.projects.find((project) => project.id === id);
      if (!source) return;
      const copy = cloneProject(source);
      setState((current) => ({ ...current, projects: [copy, ...current.projects] }));
      setActiveProjectId(copy.id);
      toast('Project duplicated.', 'success');
    },
    [setActiveProjectId, state.projects, toast],
  );

  const addAsset = useCallback((asset: Asset) => {
    setState((current) => ({ ...current, assets: [asset, ...current.assets] }));
  }, []);

  const removeAsset = useCallback((id: string) => {
    setState((current) => ({ ...current, assets: current.assets.filter((asset) => asset.id !== id) }));
  }, []);

  const addCharacter = useCallback((character: Character) => {
    setState((current) => ({ ...current, characters: [...current.characters, character] }));
  }, []);

  const updateCharacter = useCallback((id: string, updater: (character: Character) => Character) => {
    setState((current) => ({
      ...current,
      characters: current.characters.map((character) => (character.id === id ? updater(character) : character)),
    }));
  }, []);

  const removeCharacter = useCallback((id: string) => {
    setState((current) => ({ ...current, characters: current.characters.filter((character) => character.id !== id) }));
  }, []);

  const setIdeas = useCallback((updater: (ideas: Idea[]) => Idea[]) => {
    setState((current) => ({ ...current, ideas: updater(current.ideas) }));
  }, []);

  const setCalendar = useCallback((updater: (entries: CalendarEntry[]) => CalendarEntry[]) => {
    setState((current) => ({ ...current, calendar: updater(current.calendar) }));
  }, []);

  const setMetrics = useCallback((updater: (metrics: VideoMetric[]) => VideoMetric[]) => {
    setState((current) => ({ ...current, metrics: updater(current.metrics) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }, []);

  const replaceState = useCallback((next: AppState) => {
    const prepared = withCharacters(next);
    setState(prepared);
    saveState(prepared);
  }, []);

  const resetAll = useCallback(() => {
    const fresh = withCharacters({
      version: 1,
      projects: [],
      characters: [],
      assets: [],
      ideas: [],
      calendar: [],
      metrics: [],
      settings: loadState().settings,
    } as AppState);
    setState(fresh);
    setActiveProjectId('');
    saveState(fresh);
  }, [setActiveProjectId]);

  const value: StoreValue = {
    state,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    saveStatus,
    saveError,
    toasts,
    toast,
    dismissToast,
    addProject,
    updateProject,
    removeProject,
    duplicateProject,
    addAsset,
    removeAsset,
    addCharacter,
    updateCharacter,
    removeCharacter,
    setIdeas,
    setCalendar,
    setMetrics,
    updateSettings,
    replaceState,
    resetAll,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}

export function useActiveProject(): Project | undefined {
  return useStore().activeProject;
}
