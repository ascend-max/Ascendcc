import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Asset, AssetCategory, AssetKind } from '../types';
import { useStore } from '../state/store';
import { createAsset } from '../lib/factory';
import { getBlobUrl, deleteBlob, putBlob } from '../lib/storage';
import { analyzeBuffer, decodeAudioBlob } from '../lib/voice';
import { assetName } from '../lib/characters';
import { formatBytes, formatDuration } from '../lib/time';
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
  Toggle,
} from '../components/ui';
import { Icon } from '../components/Icon';

const CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: 'character', label: 'Characters' },
  { value: 'pose', label: 'Character poses' },
  { value: 'expression', label: 'Facial expressions' },
  { value: 'mouth', label: 'Mouth shapes' },
  { value: 'prop', label: 'Props' },
  { value: 'background', label: 'Backgrounds' },
  { value: 'building', label: 'Buildings' },
  { value: 'money', label: 'Money and finance' },
  { value: 'vehicle', label: 'Vehicles' },
  { value: 'machine', label: 'Machines' },
  { value: 'chart', label: 'Charts and diagrams' },
  { value: 'effect', label: 'Effects' },
  { value: 'sfx', label: 'Sound effects' },
  { value: 'music', label: 'Music' },
  { value: 'voice', label: 'Voice recordings' },
  { value: 'scene-art', label: 'Generated scene artwork' },
];

export function AssetLibrary(): React.ReactElement {
  const { state, addAsset, removeAsset, updateProject, activeProject, toast } = useStore();
  const [category, setCategory] = useState<'all' | AssetCategory>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Asset | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(
    () =>
      state.assets.filter(
        (asset) =>
          (category === 'all' || asset.category === category) &&
          (!search || asset.name.toLowerCase().includes(search.toLowerCase())),
      ),
    [state.assets, category, search],
  );

  const importFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setImporting(true);
    let imported = 0;
    for (const file of Array.from(files)) {
      try {
        const blobId = await putBlob(file);
        const kind: AssetKind = file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'other';
        let duration: number | undefined;
        let width: number | undefined;
        let height: number | undefined;
        if (kind === 'audio') {
          try {
            const buffer = await decodeAudioBlob(file);
            duration = buffer.duration;
            const analysis = analyzeBuffer(buffer);
            if (analysis.peakLevel > 1) {
              toast(`${file.name} may clip. Peak level ${analysis.peakLevel.toFixed(2)}.`, 'warning');
            }
          } catch {
            toast(`${file.name}: the browser could not decode this audio format.`, 'error');
          }
        }
        if (kind === 'image') {
          const url = URL.createObjectURL(file);
          await new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => {
              width = image.width;
              height = image.height;
              resolve();
            };
            image.onerror = () => resolve();
            image.src = url;
          });
          URL.revokeObjectURL(url);
        }
        const guessedCategory: AssetCategory =
          kind === 'audio' ? 'voice' : kind === 'image' ? 'prop' : 'effect';
        addAsset(
          createAsset({
            name: assetName(guessedCategory, file.name.replace(/\.[a-z0-9]+$/i, '')),
            category: guessedCategory,
            kind,
            blobId,
            projectId: activeProject?.id,
            mime: file.type || 'application/octet-stream',
            size: file.size,
            width,
            height,
            duration,
          }),
        );
        imported += 1;
      } catch (error) {
        console.error(error);
        toast(`Could not store ${file.name}.`, 'error');
      }
    }
    setImporting(false);
    if (imported) toast(`${imported} file${imported === 1 ? '' : 's'} added to the library.`, 'success');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Library"
        title="Asset Library"
        description="Reusable cartoon assets stored in this browser. Flat images stay flat — the app never pretends a single image has editable layers."
        actions={
          <div className="row gap-sm wrap">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,audio/*"
              multiple
              className="visually-hidden"
              id="asset-import"
              onChange={(event) => void importFiles(event.target.files)}
            />
            <Button variant="primary" icon={<Icon name="upload" size={16} />} onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? 'Importing…' : 'Import files'}
            </Button>
          </div>
        }
      />

      <Notice tone="info" title="What is stored, and where">
        Images and audio are kept as binary blobs in IndexedDB; metadata lives with the project state. Nothing is
        uploaded. Clearing browser data removes both — export project JSON from Settings and keep original files
        elsewhere.
      </Notice>

      <div className="toolbar">
        <Select
          value={category}
          options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES]}
          onChange={(event) => setCategory(event.target.value as 'all' | AssetCategory)}
        />
        <TextInput placeholder="Search assets" value={search} onChange={(event) => setSearch(event.target.value)} />
        <span className="muted small">{visible.length} assets</span>
      </div>

      {visible.length ? (
        <div className="asset-grid">
          {visible.map((asset) => (
            <article key={asset.id} className="asset-card">
              <AssetPreview asset={asset} />
              <div className="asset-body">
                <strong>{asset.name}</strong>
                <span className="muted small">
                  {asset.category} · {asset.kind} · {formatBytes(asset.size)}
                  {asset.duration ? ` · ${formatDuration(asset.duration)}` : ''}
                </span>
                <span className="muted small">
                  {asset.kind === 'image'
                    ? asset.transparent
                      ? 'Transparent PNG'
                      : 'Flat image (no editable layers)'
                    : asset.mime || 'Unknown format'}
                </span>
                {asset.usageNotes && <span className="muted small">{asset.usageNotes}</span>}
              </div>
              <footer>
                <Button size="sm" variant="subtle" onClick={() => setEditing(asset)}>
                  Details
                </Button>
                {activeProject && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      removeAsset(asset.id);
                      addAsset({ ...asset, projectId: activeProject.id });
                      toast('Asset attached to the active project.', 'success');
                    }}
                  >
                    Attach
                  </Button>
                )}
                <button className="icon-button danger" aria-label="Delete asset" onClick={() => setPendingDelete(asset)}>
                  <Icon name="trash" size={14} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <Card>
          <p className="muted">
            No assets match. Import character artwork, backgrounds, props or voice recordings — PNG, JPEG, WebP, MP3, WAV,
            M4A or OGG if your browser can decode it.
          </p>
        </Card>
      )}

      <Modal
        open={Boolean(editing)}
        title="Asset details"
        onClose={() => setEditing(null)}
        footer={<Button variant="primary" onClick={() => setEditing(null)}>Done</Button>}
      >
        {editing && (
          <div className="stack-sm">
            <Grid columns={2}>
              <Field label="Name">
                <TextInput
                  value={editing.name}
                  onChange={(event) => {
                    const next = { ...editing, name: event.target.value };
                    setEditing(next);
                    removeAsset(editing.id);
                    addAsset(next);
                  }}
                />
              </Field>
              <Field label="Category">
                <Select
                  value={editing.category}
                  options={CATEGORIES}
                  onChange={(event) => {
                    const next = { ...editing, category: event.target.value as AssetCategory };
                    setEditing(next);
                    removeAsset(editing.id);
                    addAsset(next);
                  }}
                />
              </Field>
            </Grid>
            <Field label="Colour and style notes" hint="e.g. grayscale only, coral accent on the tie, 2px ink outline.">
              <TextArea
                rows={2}
                value={editing.colorNotes}
                onChange={(event) => {
                  const next = { ...editing, colorNotes: event.target.value };
                  setEditing(next);
                  removeAsset(editing.id);
                  addAsset(next);
                }}
              />
            </Field>
            <Field label="Usage notes">
              <TextArea
                rows={2}
                value={editing.usageNotes}
                onChange={(event) => {
                  const next = { ...editing, usageNotes: event.target.value };
                  setEditing(next);
                  removeAsset(editing.id);
                  addAsset(next);
                }}
              />
            </Field>
            <Toggle
              checked={editing.transparent}
              onChange={(checked) => {
                const next = { ...editing, transparent: checked };
                setEditing(next);
                removeAsset(editing.id);
                addAsset(next);
              }}
              label="Has transparency"
              hint="Mark PNG/WebP cut-outs so they composite cleanly as layers."
            />
            <Badge tone="neutral">Naming convention: ascend.&lt;category&gt;.&lt;label&gt;</Badge>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete asset?"
        body="This removes the file from this browser and any scene reference becomes a missing asset placeholder."
        confirmLabel="Delete asset"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            if (pendingDelete.blobId) void deleteBlob(pendingDelete.blobId);
            removeAsset(pendingDelete.id);
            toast('Asset deleted.', 'info');
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

function AssetPreview({ asset }: { asset: Asset }): React.ReactElement {
  const [url, setUrl] = useState<string | undefined>();

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

  if (!asset.blobId || !url) {
    return <div className="asset-preview asset-preview-empty">{asset.kind === 'audio' ? '♪' : 'No file'}</div>;
  }
  if (asset.kind === 'image') {
    return (
      <div className="asset-preview">
        <img src={url} alt={asset.name} />
      </div>
    );
  }
  return (
    <div className="asset-preview asset-preview-audio">
      <audio controls src={url} preload="metadata" />
      {asset.duration && <span className="small muted">{formatDuration(asset.duration)}</span>}
    </div>
  );
}
