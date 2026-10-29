import React, { useRef, useState } from 'react';
import type { Orientation, Platform } from '../types';
import { useStore } from '../state/store';
import { exportStateJson, parseStateJson } from '../lib/storage';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DefinitionList,
  Field,
  Grid,
  Notice,
  NumberInput,
  PageHeader,
  Select,
  TextInput,
  Toggle,
} from '../components/ui';
import { Icon } from '../components/Icon';

export function SettingsPage(): React.ReactElement {
  const { state, updateSettings, replaceState, resetAll, toast } = useStore();
  const settings = state.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ json: string; projects: number } | null>(null);

  const downloadAll = () => {
    const blob = new Blob([exportStateJson(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ascendcc-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Backup exported. Media files are not included — keep original recordings and artwork too.', 'success');
  };

  const readImport = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseStateJson(text);
      setPendingImport({ json: text, projects: parsed.projects.length });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That file could not be read.', 'error');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Studio"
        title="Settings"
        description="Brand defaults, narration design toggles, local data, and the honest state of future integrations."
      />

      <Grid columns={2}>
        <Card title="Brand" subtitle="Used on cards, package exports and the studio shell">
          <div className="stack-sm">
            <Field label="Creator name">
              <TextInput value={settings.creatorName} onChange={(event) => updateSettings({ creatorName: event.target.value })} />
            </Field>
            <Field label="Brand name">
              <TextInput value={settings.brandName} onChange={(event) => updateSettings({ brandName: event.target.value })} />
            </Field>
            <Field label="Slogan">
              <TextInput value={settings.slogan} onChange={(event) => updateSettings({ slogan: event.target.value })} />
            </Field>
            <Field label="Coral accent" hint="Fixed by the Ascend design system. Characters stay monochrome.">
              <div className="row gap-sm">
                <span className="swatch is-active" style={{ background: '#ff5470' }} />
                <code>#ff5470</code>
                <Badge tone="accent">locked</Badge>
              </div>
            </Field>
          </div>
        </Card>

        <Card title="New project defaults">
          <div className="stack-sm">
            <Grid columns={2}>
              <Field label="Platform">
                <Select
                  value={settings.defaultPlatform}
                  options={[
                    { value: 'youtube-shorts', label: 'YouTube Shorts' },
                    { value: 'tiktok', label: 'TikTok' },
                    { value: 'instagram-reels', label: 'Instagram Reels' },
                    { value: 'youtube', label: 'YouTube' },
                    { value: 'linkedin', label: 'LinkedIn' },
                  ]}
                  onChange={(event) => updateSettings({ defaultPlatform: event.target.value as Platform })}
                />
              </Field>
              <Field label="Orientation">
                <Select
                  value={settings.defaultOrientation}
                  options={[
                    { value: '9:16', label: '9:16 vertical' },
                    { value: '16:9', label: '16:9 widescreen' },
                    { value: '1:1', label: '1:1 square' },
                  ]}
                  onChange={(event) => updateSettings({ defaultOrientation: event.target.value as Orientation })}
                />
              </Field>
            </Grid>
            <Field label="Default duration">
              <NumberInput
                value={settings.defaultDuration}
                min={5}
                max={600}
                step={5}
                suffix="s"
                onChange={(value) => updateSettings({ defaultDuration: value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Mascot design" subtitle="Marlowe — black jackal, grayscale, one coral accent">
          <Toggle
            checked={settings.cigarette}
            onChange={(checked) => updateSettings({ cigarette: checked })}
            label="Draw the cigarette accessory"
            hint="A configurable design element, not an endorsement. Turn it off for a cleaner, brand-safe narrator."
          />
          <Toggle
            checked={settings.smoke}
            onChange={(checked) => updateSettings({ smoke: checked })}
            label="Include smoke in generated storyboards"
            hint="Smoke is always a separate effect layer so it animates independently."
          />
          <Toggle
            checked={settings.storageWarningAccepted}
            onChange={(checked) => updateSettings({ storageWarningAccepted: checked })}
            label="Hide the local-storage warning"
            hint="Keep it visible if you are working without regular exports."
          />
        </Card>

        <Card title="Data and backups" subtitle="Local only — no account, no server, no sync">
          <div className="stack-sm">
            <Button variant="secondary" icon={<Icon name="download" size={16} />} onClick={downloadAll}>
              Export all project data (JSON)
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="visually-hidden"
              id="state-import"
              onChange={(event) => void readImport(event.target.files)}
            />
            <Button variant="ghost" icon={<Icon name="upload" size={16} />} onClick={() => fileRef.current?.click()}>
              Import project data (JSON)
            </Button>
            <p className="muted small">
              JSON contains projects, characters, calendar and analytics — not the binary images or audio (those live in
              IndexedDB). Keep the original files.
            </p>
            <div className="danger-zone">
              <div>
                <strong>Reset this studio</strong>
                <p className="muted small">Deletes every project, asset record, calendar entry and metric from this browser.</p>
              </div>
              <Button variant="danger" onClick={() => setPendingReset(true)}>
                Reset all data
              </Button>
            </div>
          </div>
        </Card>

        <Card title="AI providers" subtitle="Interface designed, integration not built">
          <Notice tone="info" title="Nothing is configured or connected">
            AscendCC works entirely without paid APIs. The provider seam exists in the typed settings model, but there is
            no working request path in this build, no key stored in the frontend, and the toggle is intentionally
            disabled. Any future integration must be optional and server-mediated.
          </Notice>
          <div className="stack-sm">
            <Toggle
              checked={settings.ai.enabled}
              onChange={() => toast('AI providers are not implemented in this release.', 'info')}
              label="Enable AI assistance (unavailable)"
            />
            <Field label="Provider">
              <TextInput value="None — structured templates only" disabled readOnly />
            </Field>
            <Field label="Server endpoint" hint="Never place a provider key in client code.">
              <TextInput value="" placeholder="Not implemented" disabled readOnly />
            </Field>
            <Field label="Model">
              <TextInput value="" placeholder="Not implemented" disabled readOnly />
            </Field>
          </div>
        </Card>

        <Card title="Release status" subtitle="What is real in this build">
          <DefinitionList
            items={[
              {
                term: 'Working',
                detail:
                  'Projects, research log, script, storyboard, captions, procedural mascot animation, timeline, WebM capture, PNG frames, SRT, audio import/recording and offline processing, lip-sync from loudness, calendar, analytics, JSON export.',
              },
              {
                term: 'Template-based',
                detail: 'Hooks, titles, storyboard scaffolds and sales deliverables come from structured templates. Nothing is researched automatically.',
              },
              {
                term: 'Not implemented',
                detail: 'MP4 encoding, cloud sync, accounts, social publishing, AI providers, phonetic lip-sync, voice cloning, image generation.',
              },
              {
                term: 'Known limits',
                detail:
                  'WebM export records in real time, so a 45s video takes about 45s. localStorage holds text state; large media relies on IndexedDB and is not included in JSON backups.',
              },
            ]}
          />
          <p className="muted small">AscendCC is independent of Napoleon. No shared runtime, database or authentication.</p>
        </Card>
      </Grid>

      <ConfirmDialog
        open={pendingReset}
        title="Reset all AscendCC data?"
        body="Every project, storyboard, asset record, calendar entry and metric is deleted from this browser. Files already exported to your device are not affected. This cannot be undone."
        confirmLabel="Reset everything"
        onCancel={() => setPendingReset(false)}
        onConfirm={() => {
          resetAll();
          setPendingReset(false);
          toast('Studio reset. All local project data was removed.', 'info');
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="Replace all data with this backup?"
        body={`The file contains ${pendingImport?.projects ?? 0} project(s). Importing replaces the current studio state in this browser.`}
        confirmLabel="Import and replace"
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          if (pendingImport) {
            try {
              replaceState(parseStateJson(pendingImport.json));
              toast('Backup imported.', 'success');
            } catch (error) {
              toast(error instanceof Error ? error.message : 'Import failed.', 'error');
            }
          }
          setPendingImport(null);
        }}
      />
    </div>
  );
}
