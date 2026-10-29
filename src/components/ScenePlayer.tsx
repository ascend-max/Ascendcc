import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../types';
import { drawProjectFrame, frameSize } from '../render/draw';
import { timelineAudio } from '../lib/playback';
import { getBlobUrl } from '../lib/storage';
import { useStore } from '../state/store';
import { formatTimecode } from '../lib/time';
import { resolvedAudioTracks, timelineDuration } from '../lib/sequence';
import { MASCOT_ID } from '../lib/characters';
import { Icon } from './Icon';

export interface ScenePlayerProps {
  project: Project;
  /** When set, previews a single scene and loops inside it. */
  sceneId?: string;
  showGuidesDefault?: boolean;
  onSelectScene?: (sceneId: string) => void;
  className?: string;
  compact?: boolean;
}

export function ScenePlayer({
  project,
  sceneId,
  showGuidesDefault = false,
  onSelectScene,
  className = '',
  compact = false,
}: ScenePlayerProps): React.ReactElement {
  const { state } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(true);
  const [guides, setGuides] = useState(showGuidesDefault);
  const [imagesVersion, setImagesVersion] = useState(0);

  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const loopRef = useRef(loop);
  const mutedRef = useRef(muted);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const sceneIndex = sceneId ? project.scenes.findIndex((scene) => scene.id === sceneId) : -1;
  const scene = sceneIndex >= 0 ? project.scenes[sceneIndex] : undefined;
  const total = timelineDuration(project);
  const range = useMemo(
    () => (scene ? { start: scene.start, end: Math.max(scene.start + 0.1, scene.end) } : { start: 0, end: Math.max(0.1, total) }),
    [scene, total],
  );

  loopRef.current = loop;
  mutedRef.current = muted;

  /* Jump to the start of the focused scene when it changes. */
  useEffect(() => {
    timeRef.current = range.start;
    setDisplayTime(range.start);
    playingRef.current = false;
    setPlaying(false);
    timelineAudio.stop();
  }, [sceneId, range.start]);

  const startAudio = useCallback(
    async (from: number) => {
      await timelineAudio.preload(project, state.assets);
      timelineAudio.setMuted(mutedRef.current);
      timelineAudio.play(resolvedAudioTracks(project), from);
    },
    [project, state.assets],
  );

  useEffect(() => {
    timelineAudio.setMuted(muted);
  }, [muted]);

  /* Load images for image layers from IndexedDB-backed assets. */
  useEffect(() => {
    let cancelled = false;
    const needed = new Set<string>();
    project.scenes.forEach((item) => {
      item.layers.forEach((layer) => {
        if (layer.kind === 'image') needed.add(layer.refId);
        if (layer.kind === 'character' && layer.refId !== MASCOT_ID) needed.add(layer.refId);
      });
    });
    const load = async () => {
      for (const refId of needed) {
        if (!refId || imagesRef.current.has(refId)) continue;
        const asset = state.assets.find((item) => item.id === refId);
        if (!asset?.blobId) continue;
        const url = await getBlobUrl(asset.blobId);
        if (!url || cancelled) continue;
        const image = new Image();
        image.onload = () => {
          if (!cancelled) setImagesVersion((version) => version + 1);
        };
        image.src = url;
        imagesRef.current.set(refId, image);
      }
      if (!cancelled) setImagesVersion((version) => version + 1);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [project.scenes, state.assets]);

  /* The render loop: time advances only while playing; the canvas always redraws. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = frameSize(project);
    canvas.width = width;
    canvas.height = height;

    let raf = 0;
    let last = performance.now();
    let lastUi = 0;

    const render = (now: number) => {
      const delta = Math.min(0.12, (now - last) / 1000);
      last = now;

      if (playingRef.current) {
        let next = timeRef.current + delta;
        if (next >= range.end) {
          if (loopRef.current) {
            next = range.start;
            void startAudio(next);
          } else {
            next = Math.max(range.start, range.end - 0.001);
            playingRef.current = false;
            setPlaying(false);
            timelineAudio.stop();
          }
        }
        timeRef.current = next;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawProjectFrame({
          ctx,
          width,
          height,
          project,
          images: imagesRef.current,
          characters: state.characters,
          settings: state.settings,
          time: timeRef.current,
          showGuides: guides,
        });
      }

      if (now - lastUi > 90) {
        lastUi = now;
        setDisplayTime(timeRef.current);
      }
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [project, range.start, range.end, guides, state.characters, state.settings, imagesVersion, startAudio]);

  useEffect(() => () => timelineAudio.stop(), []);

  const toggle = () => {
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      timelineAudio.stop();
      return;
    }
    if (timeRef.current >= range.end - 0.02) {
      timeRef.current = range.start;
      setDisplayTime(range.start);
    }
    playingRef.current = true;
    setPlaying(true);
    void startAudio(timeRef.current);
  };

  const seek = (next: number) => {
    timeRef.current = Math.max(range.start, Math.min(range.end - 0.01, next));
    setDisplayTime(timeRef.current);
    if (playingRef.current) {
      void startAudio(timeRef.current);
    }
  };

  const currentScene = scene ?? project.scenes.find((item) => item.start <= displayTime && item.end > displayTime);
  const local = currentScene ? Math.max(0, displayTime - currentScene.start) : 0;

  return (
    <div className={`player ${className}`}>
      <div className={`player-stage ${compact ? 'is-compact' : ''}`}>
        <canvas ref={canvasRef} className="player-canvas" aria-label="Animated scene preview" />
        {!project.scenes.length && <div className="player-overlay">Add a scene to preview animation.</div>}
      </div>

      <div className="player-controls">
        <button className="player-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={20} />
        </button>
        <span className="player-time">
          {formatTimecode(Math.max(0, displayTime - range.start))} / {formatTimecode(range.end - range.start)}
        </span>
        <input
          className="player-scrub"
          type="range"
          min={range.start}
          max={range.end}
          step={0.02}
          value={displayTime}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Seek timeline"
        />
        <div className="player-tools">
          <button
            className={`chip ${loop ? 'is-active' : ''}`}
            onClick={() => setLoop((value) => !value)}
            title="Loop playback"
          >
            Loop
          </button>
          <button
            className={`chip ${muted ? '' : 'is-active'}`}
            onClick={() => setMuted((value) => !value)}
            title="Toggle audio"
          >
            {muted ? 'Muted' : 'Audio'}
          </button>
          <button
            className={`chip ${guides ? 'is-active' : ''}`}
            onClick={() => setGuides((value) => !value)}
            title="Show safe-area guides"
          >
            Guides
          </button>
        </div>
      </div>

      <div className="player-meta">
        <div>
          <strong>{scene ? scene.title : currentScene?.title ?? 'No scene'}</strong>
          <span className="muted">
            {' '}
            · local {local.toFixed(1)}s · {scene ? scene.duration.toFixed(1) : total.toFixed(1)}s
          </span>
        </div>
        {scene && onSelectScene && (
          <div className="player-scene-nav">
            <button
              className="icon-button"
              disabled={sceneIndex <= 0}
              onClick={() => onSelectScene(project.scenes[sceneIndex - 1].id)}
              aria-label="Previous scene"
            >
              <Icon name="arrowLeft" size={16} />
            </button>
            <span className="muted">
              Scene {sceneIndex + 1} / {project.scenes.length}
            </span>
            <button
              className="icon-button"
              disabled={sceneIndex >= project.scenes.length - 1}
              onClick={() => onSelectScene(project.scenes[sceneIndex + 1].id)}
              aria-label="Next scene"
            >
              <Icon name="arrowRight" size={16} />
            </button>
          </div>
        )}
      </div>

      {currentScene && (
        <p className="player-note">
          {currentScene.captions.some((group) => group.estimated)
            ? 'Caption timing is estimated from word count until you attach a measured recording.'
            : 'Caption timing uses measured recording length.'}{' '}
          Lip-sync:{' '}
          {currentScene.lipSync.enabled
            ? currentScene.lipSync.source === 'amplitude'
              ? 'amplitude driven (approximate).'
              : 'manual events.'
            : 'off.'}
        </p>
      )}
    </div>
  );
}
