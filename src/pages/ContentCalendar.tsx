import React, { useState } from 'react';
import type { CalendarEntry, CalendarStatus, Platform } from '../types';
import { useStore } from '../state/store';
import { createCalendarEntry } from '../lib/factory';
import { DEFAULT_PILLARS, SERIES_IDEAS, thirtyDayPlan } from '../lib/templates';
import { isoDate } from '../lib/time';
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
} from '../components/ui';
import { Icon } from '../components/Icon';

const STATUSES: { value: CalendarStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'research', label: 'Research' },
  { value: 'script', label: 'Scripting' },
  { value: 'production', label: 'Production' },
  { value: 'published', label: 'Published' },
  { value: 'skipped', label: 'Skipped' },
];

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'youtube-shorts', label: 'YouTube Shorts' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram-reels', label: 'Instagram Reels' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ContentCalendar(): React.ReactElement {
  const { state, setCalendar, activeProject, toast } = useStore();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [editing, setEditing] = useState<CalendarEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pillars, setPillars] = useState(DEFAULT_PILLARS.join(', '));
  const [planStart, setPlanStart] = useState(isoDate(today));
  const [planPlatform, setPlanPlatform] = useState<Platform>(state.settings.defaultPlatform);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthName = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: (string | null)[] = [];
  for (let index = 0; index < leading; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(isoDate(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);

  const byDate = new Map<string, CalendarEntry[]>();
  state.calendar.forEach((entry) => {
    byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
  });

  const upcoming = [...state.calendar]
    .filter((entry) => entry.date >= isoDate(today))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const generatePlan = () => {
    const pillarList = pillars.split(',').map((value) => value.trim()).filter(Boolean);
    const created = thirtyDayPlan(pillarList, planStart, planPlatform, state.calendar);
    setCalendar((entries) => [...entries, ...created]);
    toast(`${created.length} calendar entries added. Replace placeholders with specific topics.`, 'success');
  };

  const saveEntry = (entry: CalendarEntry) => {
    setCalendar((entries) =>
      entries.some((item) => item.id === entry.id) ? entries.map((item) => (item.id === entry.id ? entry : item)) : [...entries, entry],
    );
    setEditing(null);
    toast('Calendar entry saved.', 'success');
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Publishing plan"
        title="Content Calendar"
        description="One video per day, linked to real projects. AscendCC never publishes to a platform — you post, then record what actually happened in Analytics."
        actions={
          <Button
            variant="primary"
            icon={<Icon name="plus" size={16} />}
            onClick={() => setEditing(createCalendarEntry({ date: isoDate(today), platform: state.settings.defaultPlatform }))}
          >
            Add entry
          </Button>
        }
      />

      <Notice tone="info" title="No auto-publishing">
        There is no social API integration in this build. Dates here are planning only; publishing stays manual, and any
        future platform integration would require explicit authorisation.
      </Notice>

      <div className="calendar-layout">
        <Card
          title={monthName}
          subtitle={`${state.calendar.filter((entry) => entry.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length} entries this month`}
          actions={
            <div className="row gap-xs">
              <button className="icon-button" aria-label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))}>
                <Icon name="arrowLeft" size={16} />
              </button>
              <Button size="sm" variant="ghost" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
                Today
              </Button>
              <button className="icon-button" aria-label="Next month" onClick={() => setCursor(new Date(year, month + 1, 1))}>
                <Icon name="arrowRight" size={16} />
              </button>
            </div>
          }
        >
          <div className="calendar">
            {WEEKDAYS.map((day) => (
              <div key={day} className="calendar-head">
                {day}
              </div>
            ))}
            {cells.map((date, index) => {
              const entries = date ? byDate.get(date) ?? [] : [];
              const isToday = date === isoDate(today);
              return (
                <div key={`${date ?? 'blank'}-${index}`} className={`calendar-cell ${date ? '' : 'is-blank'} ${isToday ? 'is-today' : ''}`}>
                  {date && (
                    <>
                      <div className="calendar-date">
                        <span>{Number(date.slice(-2))}</span>
                        <button
                          className="calendar-add"
                          aria-label={`Add entry on ${date}`}
                          onClick={() => setEditing(createCalendarEntry({ date, platform: state.settings.defaultPlatform }))}
                        >
                          <Icon name="plus" size={12} />
                        </button>
                      </div>
                      {entries.map((entry) => (
                        <button key={entry.id} className={`calendar-entry status-${entry.status}`} onClick={() => setEditing(entry)}>
                          <span>{entry.title}</span>
                          <em>{entry.pillar}</em>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="stack">
          <Card title="Next up" subtitle="Closest scheduled dates first">
            {upcoming.length ? (
              <ul className="upcoming-list">
                {upcoming.map((entry) => (
                  <li key={entry.id}>
                    <span className="upcoming-date">{entry.date.slice(5)}</span>
                    <span>
                      <strong>{entry.title}</strong>
                      <span className="muted small"> · {entry.pillar} · {entry.platform}</span>
                    </span>
                    <Badge tone={entry.status === 'published' ? 'success' : entry.status === 'skipped' ? 'warning' : 'neutral'}>
                      {entry.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nothing scheduled. Generate a 30-day plan below or add a single entry.</p>
            )}
          </Card>

          <Card title="30-day plan" subtitle="Generated from your content pillars, editable afterwards">
            <Field label="Content pillars" hint="Comma separated. The plan rotates through them.">
              <TextInput value={pillars} onChange={(event) => setPillars(event.target.value)} />
            </Field>
            <Grid columns={2}>
              <Field label="Start date">
                <TextInput type="date" value={planStart} onChange={(event) => setPlanStart(event.target.value)} />
              </Field>
              <Field label="Platform">
                <Select value={planPlatform} options={PLATFORMS} onChange={(event) => setPlanPlatform(event.target.value as Platform)} />
              </Field>
            </Grid>
            <Button variant="secondary" onClick={generatePlan}>
              Generate 30 days
            </Button>
            <p className="muted small">A daily schedule is a planning choice, not a growth promise. Days that already have entries are skipped.</p>
          </Card>

          <Card title="Ten additional series" subtitle="Reusable formats when the calendar feels thin">
            <ol className="numbered-list">
              {SERIES_IDEAS.map((series) => (
                <li key={series}>{series}</li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(editing)}
        title={editing && state.calendar.some((entry) => entry.id === editing.id) ? 'Edit calendar entry' : 'New calendar entry'}
        onClose={() => setEditing(null)}
        footer={
          <>
            {editing && state.calendar.some((entry) => entry.id === editing.id) && (
              <Button variant="danger" onClick={() => setPendingDelete(editing.id)}>
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => editing && saveEntry(editing)}>
              Save entry
            </Button>
          </>
        }
      >
        {editing && (
          <div className="stack-sm">
            <Grid columns={2}>
              <Field label="Date">
                <TextInput type="date" value={editing.date} onChange={(event) => setEditing({ ...editing, date: event.target.value })} />
              </Field>
              <Field label="Status">
                <Select
                  value={editing.status}
                  options={STATUSES}
                  onChange={(event) => setEditing({ ...editing, status: event.target.value as CalendarStatus })}
                />
              </Field>
            </Grid>
            <Field label="Title / topic">
              <TextInput value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
            </Field>
            <Grid columns={2}>
              <Field label="Pillar">
                <TextInput value={editing.pillar} onChange={(event) => setEditing({ ...editing, pillar: event.target.value })} />
              </Field>
              <Field label="Platform">
                <Select
                  value={editing.platform}
                  options={PLATFORMS}
                  onChange={(event) => setEditing({ ...editing, platform: event.target.value as Platform })}
                />
              </Field>
            </Grid>
            <Field label="Linked project">
              <Select
                value={editing.projectId ?? ''}
                options={[{ value: '', label: 'Not linked' }, ...state.projects.map((project) => ({ value: project.id, label: project.name }))]}
                onChange={(event) => setEditing({ ...editing, projectId: event.target.value || undefined })}
              />
            </Field>
            <Field label="Notes">
              <TextArea rows={2} value={editing.notes} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} />
            </Field>
            {activeProject && !editing.projectId && (
              <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, projectId: activeProject.id })}>
                Link to “{activeProject.name}”
              </Button>
            )}
            <p className="muted small">Planning date only. Nothing is posted automatically.</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete calendar entry?"
        body="The planned slot is removed. No published content is affected."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) setCalendar((entries) => entries.filter((entry) => entry.id !== pendingDelete));
          setPendingDelete(null);
          setEditing(null);
        }}
      />
    </div>
  );
}
