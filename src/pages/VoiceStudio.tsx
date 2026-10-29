import React, { useEffect, useRef, useState } from 'react';
import type { Asset, LipSyncEvent, MouthPose, Project } from '../types';
import { ProjectGate } from '../components/ProjectGate';
import { useStore } from '../state/store';
import { createAsset, createAudioTrack } from '../lib/factory';
import { assetName, MOUTH_POSES } from '../lib/characters';
import { deleteBlob, getBlob, getBlobUrl, putBlob } from '../lib/storage';
import {
  analyzeBuffer,
  decodeAudioBlob,
  encodeWav,
  lipSyncFromBuffer,
  processVoice,
  recordingFit,
  type ProcessOptions,
  type VoiceAnalysis,
} from '../lib/voice';
import { formatDuration, formatTimecode } from '../lib/time';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Grid,
  Notice,
  NumberInput,
  PageHeader,
  Select,
  Slider,
  TextInput,
  Toggle,
} from '../components/ui';
import { Icon } from '../components/Icon';

export function VoiceStudio(): React.ReactElement {
  return (
    <ProjectGate feature="the voice studio">
      {(project) => <VoiceWorkspace project={project} />}
    </ProjectGate>
  );
}

function VoiceWorkspace({ project }: { project: Project }): React.ReactElement {
  const { state, addAsset, removeAsset, updateProject, toast } = useStore();
  const [selectedId, setSelectedId] = useState('');
  const [analysis, setAnalysis] = useState<VoiceAnalysis | undefined>();
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [processOptions, setProcessOptions] = useState<ProcessOptions>({
    trimSilence: true,
    highpass: true,
    compressor: false,
    normalize: true,
  });
  const [sceneId, setSceneId] = useState(project.scenes[0]?.id ?? '');
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const [manualTime, setManualTime] = useState(0);
  const [manualPose, setManualPose] = useState<MouthPose>('open');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const bufferCache = useRef<Map<string, AudioBuffer>>(new Map());
  const fileRef = useRef<HTMLInputElement>(null);

  const audioAssets = state.assets.filter((asset) => asset.kind === 'audio');
  const selected = audioAssets.find((asset) => asset.id === selectedId) ?? audioAssets[0];
  const scene = project.scenes.find((item) => item.id === sceneId) ?? project.scenes[0];
  const track = project.audioTracks.find((item) => item.sceneId === scene?.id && item.kind === 'voice');

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selected?.blobId) {
        setAnalysis(undefined);
        return;
      }
      const cached = bufferCache.current.get(selected.id);
      if (cached) {
        setAnalysis(analyzeBuffer(cached));
        return;
      }
      const blob = await getBlob(selected.blobId);
      if (!blob || cancelled) return;
      try {
        const buffer = await decodeAudioBlob(blob);
        bufferCache.current.set(selected.id, buffer);
        if (!cancelled) setAnalysis(analyzeBuffer(buffer));
      } catch {
        if (!cancelled) {
          setAnalysis(undefined);
          toast('This browser could not decode that audio file. Try WAV or MP3.', 'error');
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.blobId, toast]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((streamTrack) => streamTrack.stop());
    },
    [],
  );

  const saveAudio = async (blob: Blob, label: string) => {
    try {
      const blobId = await putBlob(blob);
      let duration: number | undefined;
      try {
        const buffer = await decodeAudioBlob(blob);
        duration = buffer.duration;
        bufferCache.current.set(blobId, buffer);
      } catch {
        toast('Stored the file, but could not decode its duration.', 'warning');
      }
      const asset = createAsset({
        name: assetName('voice', label),
        category: 'voice',
        kind: 'audio',
        blobId,
        projectId: project.id,
        mime: blob.type || 'audio/webm',
        size: blob.size,
        duration,
      });
      addAsset(asset);
      setSelectedId(asset.id);
      toast('Recording saved to this browser.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not store the recording.', 'error');
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast('This browser cannot record audio. Use the import option instead.', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((streamTrack) => streamTrack.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        void saveAudio(blob, `take ${new Date().toLocaleTimeString()}`);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      const started = Date.now();
      timerRef.current = window.setInterval(() => setRecordSeconds((Date.now() - started) / 1000), 200);
    } catch {
      toast('Microphone permission was denied. Allow access in the browser, or import a file.', 'error');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const importFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast('Choose an audio file (MP3, WAV, M4A or OGG).', 'warning');
      return;
    }
    await saveAudio(file, file.name.replace(/\.[a-z0-9]+$/i, ''));
    if (fileRef.current) fileRef.current.value = '';
  };

  const getBuffer = async (asset: Asset): Promise<AudioBuffer | undefined> => {
    if (!asset.blobId) return undefined;
    const cached = bufferCache.current.get(asset.id);
    if (cached) return cached;
    const blob = await getBlob(asset.blobId);
    if (!blob) return undefined;
    const buffer = await decodeAudioBlob(blob);
    bufferCache.current.set(asset.id, buffer);
    return buffer;
  };

  const cleanUp = async () => {
    if (!selected) return;
    const buffer = await getBuffer(selected);
    if (!buffer) {
      toast('The stored file could not be decoded.', 'error');
      return;
    }
    try {
      const result = await processVoice(buffer, processOptions);
      const wav = encodeWav(result.buffer);
      const blobId = await putBlob(wav);
      const asset = createAsset({
        name: `${selected.name}.clean`,
        category: 'voice',
        kind: 'audio',
        blobId,
        projectId: project.id,
        mime: 'audio/wav',
        size: wav.size,
        duration: result.buffer.duration,
        usageNotes: `Processed from ${selected.name}: ${result.applied.join(', ')}`,
      });
      addAsset(asset);
      setSelectedId(asset.id);
      toast(`Processed: ${result.applied.join(' · ') || 'trimmed only'}.`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Audio processing failed.', 'error');
    }
  };

  const attachToScene = () => {
    if (!selected || !scene) {
      toast('Choose a recording and a scene first.', 'warning');
      return;
    }
    updateProject(project.id, (item) => {
      const existing = item.audioTracks.find((entry) => entry.sceneId === scene.id && entry.kind === 'voice');
      const nextTrack = existing
        ? { ...existing, assetId: selected.id, label: `${scene.title} narration` }
        : createAudioTrack({
            kind: 'voice',
            label: `${scene.title} narration`,
            assetId: selected.id,
            startTime: scene.start,
            sceneId: scene.id,
            gain: 1,
          });
      return {
        ...item,
        audioTracks: existing
          ? item.audioTracks.map((entry) => (entry.id === existing.id ? nextTrack : entry))
          : [...item.audioTracks, nextTrack],
        scenes: item.scenes.map((entry) => (entry.id === scene.id ? { ...entry, audioAssetId: selected.id } : entry)),
      };
    });
    toast('Voice-over attached to the scene.', 'success');
  };

  const removeTrack = () => {
    if (!track) return;
    updateProject(project.id, (item) => ({
      ...item,
      audioTracks: item.audioTracks.filter((entry) => entry.id !== track.id),
      scenes: item.scenes.map((entry) => (entry.id === track.sceneId ? { ...entry, audioAssetId: '' } : entry)),
    }));
    toast('Track removed from the scene.', 'info');
  };

  const generateLipSync = async () => {
    if (!selected || !scene) {
      toast('Attach a recording to a scene first.', 'warning');
      return;
    }
    const buffer = await getBuffer(selected);
    if (!buffer) {
      toast('Could not decode the recording.', 'error');
      return;
    }
    const offset = track ? Math.max(0, track.startTime - scene.start) : 0;
    const events = lipSyncFromBuffer(buffer, { offsetSec: offset });
    updateProject(project.id, (item) => ({
      ...item,
      scenes: item.scenes.map((entry) =>
        entry.id === scene.id ? { ...entry, lipSync: { enabled: true, source: 'amplitude', events } } : entry,
      ),
    }));
    toast(`Generated ${events.length} amplitude-based mouth events. This is approximate, not phonetic lip-sync.`, 'info');
  };

  const updateLipSync = (sceneTargetId: string, events: LipSyncEvent[], enabled = true) => {
    updateProject(project.id, (item) => ({
      ...item,
      scenes: item.scenes.map((entry) =>
        entry.id === sceneTargetId ? { ...entry, lipSync: { ...entry.lipSync, enabled, source: 'manual', events } } : entry,
      ),
    }));
  };

  const fit = selected?.duration && scene ? recordingFit(selected.duration, scene.duration) : null;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Narration"
        title="Voice Studio"
        description="Your own recorded voice, processed locally. No voice cloning, no uploads, no paid speech services."
        actions={
          <div className="row gap-sm wrap">
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="visually-hidden"
              id="voice-import"
              onChange={(event) => void importFile(event.target.files)}
            />
            <Button variant="secondary" icon={<Icon name="upload" size={16} />} onClick={() => fileRef.current?.click()}>
              Import audio
            </Button>
            <Button
              variant={recording ? 'danger' : 'primary'}
              icon={<Icon name="mic" size={16} />}
              onClick={recording ? stopRecording : () => void startRecording()}
            >
              {recording ? `Stop recording (${recordSeconds.toFixed(1)}s)` : 'Record narration'}
            </Button>
          </div>
        }
      />

      <Notice tone="info" title="What is implemented, honestly">
        Import, recording, waveform, playback and a real offline processing chain (trim, high-pass, compression, peak
        normalisation) work here. Automatic phonetic lip-sync does not: mouth movement is derived from loudness and is
        labelled approximate. Nothing is sent anywhere.
      </Notice>

      {audioAssets.length === 0 ? (
        <EmptyState
          icon={<Icon name="mic" size={26} />}
          title="No recordings yet"
          body="Record a take in your own voice or import an existing audio file. Common browser-supported formats are MP3, WAV, M4A/AAC and OGG — support depends on the browser's decoder."
          action={
            <div className="row gap-sm">
              <Button variant="primary" onClick={() => void startRecording()}>
                Record a take
              </Button>
              <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                Import a file
              </Button>
            </div>
          }
        />
      ) : (
        <div className="voice-layout">
          <Card title="Recordings" subtitle="Stored locally in IndexedDB">
            <div className="recording-list">
              {audioAssets.map((asset) => (
                <button
                  key={asset.id}
                  className={`recording-item ${asset.id === selected?.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(asset.id)}
                >
                  <span>
                    <strong>{asset.name}</strong>
                    <span className="muted small">
                      {asset.duration ? formatDuration(asset.duration) : 'duration unknown'} · {asset.mime || 'audio'}
                    </span>
                  </span>
                  <Badge tone={project.audioTracks.some((entry) => entry.assetId === asset.id) ? 'success' : 'neutral'}>
                    {project.audioTracks.some((entry) => entry.assetId === asset.id) ? 'in use' : 'unused'}
                  </Badge>
                </button>
              ))}
            </div>
          </Card>

          <div className="stack">
            <Card
              title={selected?.name ?? 'Recording'}
              subtitle={selected ? `${formatDuration(selected.duration ?? 0)} · ${selected.size ? `${(selected.size / 1024).toFixed(0)} KB` : ''}` : ''}
              actions={
                selected && (
                  <button className="icon-button danger" aria-label="Delete recording" onClick={() => setPendingDelete(selected)}>
                    <Icon name="trash" size={15} />
                  </button>
                )
              }
            >
              {selected && <RecordingPreview asset={selected} peaks={analysis?.peaks ?? []} />}
              {analysis && (
                <div className="audit-row">
                  <span>Peak level</span>
                  <strong>{analysis.peakLevel.toFixed(2)}</strong>
                  <Badge tone={analysis.peakLevel > 0.99 ? 'danger' : 'success'}>
                    {analysis.peakLevel > 0.99 ? 'clipping risk' : 'headroom ok'}
                  </Badge>
                </div>
              )}
            </Card>

            <Card title="Attach to a scene" subtitle="One narration track per scene keeps caption timing honest.">
              <Grid columns={2}>
                <Field label="Scene">
                  <Select
                    value={scene?.id ?? ''}
                    options={project.scenes.map((item, index) => ({ value: item.id, label: `${index + 1}. ${item.title} (${item.duration.toFixed(1)}s)` }))}
                    onChange={(event) => setSceneId(event.target.value)}
                  />
                </Field>
                <Field label="Gain">
                  <Slider
                    label="gain"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={track?.gain ?? 1}
                    display={(track?.gain ?? 1).toFixed(2)}
                    onChange={(value) =>
                      updateProject(project.id, (item) => ({
                        ...item,
                        audioTracks: item.audioTracks.map((entry) =>
                          entry.id === track?.id ? { ...entry, gain: value } : entry,
                        ),
                      }))
                    }
                  />
                </Field>
              </Grid>
              {fit && (
                <Notice tone={fit.status === 'over' ? 'danger' : fit.status === 'tight' ? 'warning' : 'success'}>{fit.message}</Notice>
              )}
              <div className="row gap-sm wrap">
                <Button variant="primary" onClick={attachToScene} disabled={!selected || !scene}>
                  {track ? 'Replace scene narration' : 'Attach to scene'}
                </Button>
                {track && (
                  <Button variant="ghost" onClick={removeTrack}>
                    Remove track
                  </Button>
                )}
                {track && (
                  <Button variant="secondary" onClick={() => void generateLipSync()}>
                    Generate mouth timing
                  </Button>
                )}
              </div>
            </Card>

            <Card title="Clean up the take" subtitle="Real offline processing — the exported audio changes.">
              <div className="stack-sm">
                <Toggle
                  checked={processOptions.trimSilence}
                  onChange={(checked) => setProcessOptions({ ...processOptions, trimSilence: checked })}
                  label="Trim leading and trailing silence"
                  hint="Detects audible bounds at −42 dBFS with 80ms padding."
                />
                <Toggle
                  checked={processOptions.highpass}
                  onChange={(checked) => setProcessOptions({ ...processOptions, highpass: checked })}
                  label="High-pass at 85 Hz"
                  hint="Removes rumble and handling noise below the voice."
                />
                <Toggle
                  checked={processOptions.compressor}
                  onChange={(checked) => setProcessOptions({ ...processOptions, compressor: checked })}
                  label="Gentle compression"
                  hint="Threshold −24 dB, ratio 3:1, soft knee."
                />
                <Toggle
                  checked={processOptions.normalize}
                  onChange={(checked) => setProcessOptions({ ...processOptions, normalize: checked })}
                  label="Peak normalise to −1 dBFS"
                  hint="Raises or lowers the whole take to a consistent level."
                />
                <Button variant="secondary" onClick={() => void cleanUp()} disabled={!selected}>
                  Process into a new take
                </Button>
                <p className="muted small">
                  The original file is never overwritten: processing writes a new WAV asset, so you can compare takes.
                </p>
              </div>
            </Card>

            {scene && (
              <Card
                title="Mouth timing"
                subtitle="Approximate: amplitude drives mouth opening. Not phonetic lip-sync."
                actions={
                  <Button size="sm" variant="ghost" onClick={() => updateLipSync(scene.id, [], !scene.lipSync.enabled)}>
                    {scene.lipSync.enabled ? 'Disable' : 'Enable'}
                  </Button>
                }
              >
                <div className="row gap-sm wrap">
                  <Badge tone={scene.lipSync.enabled ? 'success' : 'neutral'}>
                    {scene.lipSync.enabled ? `on · ${scene.lipSync.source}` : 'off'}
                  </Badge>
                  <span className="muted small">{scene.lipSync.events.length} events</span>
                </div>
                <div className="row gap-sm wrap align-end">
                  <Field label="Time (scene seconds)">
                    <NumberInput value={manualTime} min={0} max={scene.duration} step={0.05} suffix="s" onChange={setManualTime} />
                  </Field>
                  <Field label="Mouth shape">
                    <Select
                      value={manualPose}
                      options={MOUTH_POSES.map((item) => ({ value: item.id, label: item.label }))}
                      onChange={(event) => setManualPose(event.target.value as MouthPose)}
                    />
                  </Field>
                  <Button
                    size="sm"
                    onClick={() =>
                      updateLipSync(
                        scene.id,
                        [...scene.lipSync.events.filter((event) => Math.abs(event.t - manualTime) > 0.03), { t: manualTime, pose: manualPose }].sort(
                          (a, b) => a.t - b.t,
                        ),
                      )
                    }
                  >
                    Add event
                  </Button>
                </div>
                <div className="event-list">
                  {scene.lipSync.events.slice(0, 80).map((event, index) => (
                    <div key={`${event.t}-${index}`} className="event-row">
                      <span>{formatTimecode(event.t)}</span>
                      <Select
                        value={event.pose}
                        options={MOUTH_POSES.map((item) => ({ value: item.id, label: item.label }))}
                        onChange={(changed) =>
                          updateLipSync(
                            scene.id,
                            scene.lipSync.events.map((candidate) =>
                              candidate === event ? { ...candidate, pose: changed.target.value as MouthPose } : candidate,
                            ),
                          )
                        }
                      />
                      <button
                        className="icon-button danger"
                        aria-label="Delete mouth event"
                        onClick={() => updateLipSync(scene.id, scene.lipSync.events.filter((candidate) => candidate !== event))}
                      >
                        <Icon name="close" size={13} />
                      </button>
                    </div>
                  ))}
                  {!scene.lipSync.events.length && <p className="muted small">No mouth events yet.</p>}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete recording?"
        body="The audio file is removed from this browser. Any scene using it will lose the track and caption timing falls back to estimates."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            if (pendingDelete.blobId) void deleteBlob(pendingDelete.blobId);
            removeAsset(pendingDelete.id);
            bufferCache.current.delete(pendingDelete.id);
            updateProject(project.id, (item) => ({
              ...item,
              audioTracks: item.audioTracks.filter((entry) => entry.assetId !== pendingDelete.id),
              scenes: item.scenes.map((entry) =>
                entry.audioAssetId === pendingDelete.id ? { ...entry, audioAssetId: '', lipSync: { ...entry.lipSync, enabled: false, events: [] } } : entry,
              ),
            }));
            toast('Recording deleted.', 'info');
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

function RecordingPreview({ asset, peaks }: { asset: Asset; peaks: number[] }): React.ReactElement {
  const [url, setUrl] = useState<string | undefined>();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (asset.blobId) {
      void getBlobUrl(asset.blobId).then((next) => {
        if (!cancelled) setUrl(next);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [asset.blobId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f0f12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!peaks.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '12px system-ui';
      ctx.fillText('Waveform appears after decoding', 14, canvas.height / 2);
      return;
    }
    const mid = canvas.height / 2;
    peaks.forEach((peak, index) => {
      const x = (index / peaks.length) * canvas.width;
      const height = Math.max(1, peak * (canvas.height * 0.86));
      const gradient = ctx.createLinearGradient(0, mid - height / 2, 0, mid + height / 2);
      gradient.addColorStop(0, '#ff5470');
      gradient.addColorStop(1, '#8a8a92');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, mid - height / 2, Math.max(1, canvas.width / peaks.length - 1), height);
    });
  }, [peaks]);

  return (
    <div className="stack-sm">
      <canvas ref={canvasRef} width={720} height={140} className="waveform" aria-label="Waveform" />
      {url ? <audio controls src={url} preload="metadata" className="audio-player" /> : <p className="muted small">No stored file.</p>}
    </div>
  );
}
