import React, { useMemo, useState } from 'react';
import type { Platform, VideoMetric } from '../types';
import { useStore } from '../state/store';
import { uid } from '../lib/id';
import { isoDate } from '../lib/time';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Grid,
  Modal,
  Notice,
  NumberInput,
  PageHeader,
  Select,
  Stat,
  TextInput,
  Toggle,
} from '../components/ui';
import { Icon } from '../components/Icon';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'youtube-shorts', label: 'YouTube Shorts' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram-reels', label: 'Instagram Reels' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
];

function emptyMetric(): VideoMetric {
  return {
    id: uid('metric'),
    title: '',
    platform: 'youtube-shorts',
    publishedAt: isoDate(new Date()),
    views: 0,
    holdRate3s: 0,
    avgWatchSec: 0,
    avgPercentViewed: 0,
    completionRate: 0,
    shares: 0,
    likes: 0,
    comments: 0,
    followersGained: 0,
    topic: '',
    hook: '',
    sample: false,
  };
}

export function Analytics(): React.ReactElement {
  const { state, setMetrics, activeProject, toast } = useStore();
  const [editing, setEditing] = useState<VideoMetric | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const metrics = state.metrics;

  const insights = useMemo(() => {
    if (metrics.length < 2) return null;
    const byHold = [...metrics].sort((a, b) => b.holdRate3s - a.holdRate3s);
    const byCompletion = [...metrics].sort((a, b) => b.completionRate - a.completionRate);
    const byFollows = [...metrics].sort(
      (a, b) => b.followersGained / Math.max(1, b.views) - a.followersGained / Math.max(1, a.views),
    );
    const totals = metrics.reduce(
      (acc, metric) => {
        acc.views += metric.views;
        acc.followers += metric.followersGained;
        acc.shares += metric.shares;
        acc.hold += metric.holdRate3s;
        acc.completion += metric.completionRate;
        return acc;
      },
      { views: 0, followers: 0, shares: 0, hold: 0, completion: 0 },
    );
    return {
      bestHold: byHold[0],
      worstHold: byHold[byHold.length - 1],
      bestCompletion: byCompletion[0],
      bestFollows: byFollows[0],
      totals: {
        ...totals,
        avgHold: totals.hold / metrics.length,
        avgCompletion: totals.completion / metrics.length,
        followsPerView: totals.views ? totals.followers / totals.views : 0,
      },
    };
  }, [metrics]);

  const sampleCount = metrics.filter((metric) => metric.sample).length;

  const save = (metric: VideoMetric) => {
    setMetrics((current) =>
      current.some((item) => item.id === metric.id) ? current.map((item) => (item.id === metric.id ? metric : item)) : [metric, ...current],
    );
    setEditing(null);
    toast(metric.sample ? 'Sample row saved and clearly flagged.' : 'Performance row saved.', 'success');
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Learning loop"
        title="Analytics"
        description="Only numbers you type in or legitimately export from a platform. AscendCC does not invent performance data and cannot fetch it without an authorised integration."
        actions={
          <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={() => setEditing(emptyMetric())}>
            Add video metrics
          </Button>
        }
      />

      <Notice tone="warning" title="No platform connection">
        Nothing is imported automatically. Copy figures from YouTube Studio, TikTok Analytics or Instagram Insights after a
        video has had time to settle. Leave fields at zero rather than guessing.
      </Notice>

      {metrics.length === 0 ? (
        <EmptyState
          icon={<Icon name="chart" size={26} />}
          title="No performance data yet"
          body="Publish a video, wait for the numbers to stabilise, then add one row with views, three-second hold rate, average watch time and follows gained. Two rows are enough to compare hooks."
          action={
            <Button variant="primary" onClick={() => setEditing(emptyMetric())}>
              Add your first row
            </Button>
          }
        />
      ) : (
        <>
          <Grid columns={4}>
            <Stat label="Videos tracked" value={metrics.length} hint={sampleCount ? `${sampleCount} flagged as sample` : 'All real entries'} accent />
            <Stat
              label="Total views"
              value={(insights?.totals.views ?? metrics.reduce((sum, metric) => sum + metric.views, 0)).toLocaleString()}
            />
            <Stat
              label="Avg 3s hold"
              value={insights ? `${(insights.totals.avgHold * 100).toFixed(1)}%` : '—'}
              hint={insights ? 'Across tracked videos' : 'Needs at least 2 videos'}
            />
            <Stat
              label="Follows / view"
              value={insights ? `${(insights.totals.followsPerView * 100).toFixed(2)}%` : '—'}
              hint={insights ? `${insights.totals.followers} follows total` : 'Needs at least 2 videos'}
            />
          </Grid>

          {insights && (
            <Grid columns={3}>
              <Card title="Best three-second hold">
                <p className="big-number">{(insights.bestHold.holdRate3s * 100).toFixed(1)}%</p>
                <p className="muted small">{insights.bestHold.title}</p>
                <p className="small">
                  Hook: <em>{insights.bestHold.hook || 'not recorded'}</em>
                </p>
                <p className="muted small">
                  Compared with {insights.worstHold.title}: {(insights.worstHold.holdRate3s * 100).toFixed(1)}%. Change one
                  variable at a time before concluding anything.
                </p>
              </Card>
              <Card title="Best completion rate">
                <p className="big-number">{(insights.bestCompletion.completionRate * 100).toFixed(1)}%</p>
                <p className="muted small">{insights.bestCompletion.title}</p>
                <p className="small">
                  Topic: <em>{insights.bestCompletion.topic || 'not recorded'}</em>
                </p>
                <p className="muted small">Completion is driven by length as much as quality. Check runtime before copying the format.</p>
              </Card>
              <Card title="Best follows per view">
                <p className="big-number">
                  {((insights.bestFollows.followersGained / Math.max(1, insights.bestFollows.views)) * 100).toFixed(2)}%
                </p>
                <p className="muted small">{insights.bestFollows.title}</p>
                <p className="muted small">
                  {insights.bestFollows.followersGained} follows from {insights.bestFollows.views.toLocaleString()} views.
                </p>
                <p className="muted small">Small samples swing wildly. Treat this as a prompt to test, not a rule.</p>
              </Card>
            </Grid>
          )}

          <Card title="Tracked videos" subtitle="Sorted by publication date, newest first">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Video</th>
                    <th>Platform</th>
                    <th>Views</th>
                    <th>3s hold</th>
                    <th>Avg watch</th>
                    <th>Completion</th>
                    <th>Follows</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...metrics]
                    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
                    .map((metric) => (
                      <tr key={metric.id}>
                        <td>
                          <strong>{metric.title}</strong>
                          <div className="muted small">
                            {metric.publishedAt} · {metric.topic || 'no topic'}
                            {metric.sample && ' · SAMPLE'}
                          </div>
                        </td>
                        <td className="small">{metric.platform}</td>
                        <td>{metric.views.toLocaleString()}</td>
                        <td>{(metric.holdRate3s * 100).toFixed(1)}%</td>
                        <td>{metric.avgWatchSec.toFixed(1)}s</td>
                        <td>{(metric.completionRate * 100).toFixed(1)}%</td>
                        <td>{metric.followersGained}</td>
                        <td>
                          <div className="row gap-xs">
                            <Button size="sm" variant="subtle" onClick={() => setEditing(metric)}>
                              Edit
                            </Button>
                            <button className="icon-button danger" aria-label="Delete metric" onClick={() => setPendingDelete(metric.id)}>
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing && state.metrics.some((item) => item.id === editing.id) ? 'Edit performance row' : 'Add performance row'}
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => editing && save(editing)}>
              Save row
            </Button>
          </>
        }
      >
        {editing && (
          <div className="stack-sm">
            <Grid columns={2}>
              <Field label="Video title">
                <TextInput value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
              </Field>
              <Field label="Publication date">
                <TextInput type="date" value={editing.publishedAt} onChange={(event) => setEditing({ ...editing, publishedAt: event.target.value })} />
              </Field>
              <Field label="Platform">
                <Select
                  value={editing.platform}
                  options={PLATFORMS}
                  onChange={(event) => setEditing({ ...editing, platform: event.target.value as Platform })}
                />
              </Field>
              <Field label="Topic / pillar">
                <TextInput value={editing.topic} onChange={(event) => setEditing({ ...editing, topic: event.target.value })} />
              </Field>
              <Field label="Hook variation used">
                <TextInput
                  value={editing.hook}
                  onChange={(event) => setEditing({ ...editing, hook: event.target.value })}
                  placeholder="e.g. number-first vs question-first"
                />
              </Field>
              <Field label="Link to project">
                <Select
                  value={editing.projectId ?? ''}
                  options={[{ value: '', label: 'Not linked' }, ...state.projects.map((project) => ({ value: project.id, label: project.name }))]}
                  onChange={(event) => setEditing({ ...editing, projectId: event.target.value || undefined })}
                />
              </Field>
            </Grid>

            <Grid columns={3}>
              <Field label="Views">
                <NumberInput value={editing.views} min={0} onChange={(value) => setEditing({ ...editing, views: value })} />
              </Field>
              <Field label="3-second hold rate" hint="Percentage, e.g. 62.5">
                <NumberInput
                  value={Number((editing.holdRate3s * 100).toFixed(2))}
                  min={0}
                  max={100}
                  step={0.1}
                  suffix="%"
                  onChange={(value) => setEditing({ ...editing, holdRate3s: value / 100 })}
                />
              </Field>
              <Field label="Average watch time">
                <NumberInput value={editing.avgWatchSec} min={0} step={0.1} suffix="s" onChange={(value) => setEditing({ ...editing, avgWatchSec: value })} />
              </Field>
              <Field label="Average % viewed">
                <NumberInput
                  value={Number((editing.avgPercentViewed * 100).toFixed(1))}
                  min={0}
                  max={100}
                  step={0.1}
                  suffix="%"
                  onChange={(value) => setEditing({ ...editing, avgPercentViewed: value / 100 })}
                />
              </Field>
              <Field label="Completion rate">
                <NumberInput
                  value={Number((editing.completionRate * 100).toFixed(1))}
                  min={0}
                  max={100}
                  step={0.1}
                  suffix="%"
                  onChange={(value) => setEditing({ ...editing, completionRate: value / 100 })}
                />
              </Field>
              <Field label="Followers gained">
                <NumberInput value={editing.followersGained} min={0} onChange={(value) => setEditing({ ...editing, followersGained: value })} />
              </Field>
              <Field label="Shares">
                <NumberInput value={editing.shares} min={0} onChange={(value) => setEditing({ ...editing, shares: value })} />
              </Field>
              <Field label="Likes">
                <NumberInput value={editing.likes} min={0} onChange={(value) => setEditing({ ...editing, likes: value })} />
              </Field>
              <Field label="Comments">
                <NumberInput value={editing.comments} min={0} onChange={(value) => setEditing({ ...editing, comments: value })} />
              </Field>
            </Grid>

            <Toggle
              checked={editing.sample}
              onChange={(checked) => setEditing({ ...editing, sample: checked })}
              label="This row is sample data"
              hint="Flagged rows are labelled SAMPLE everywhere so they can never be mistaken for real results."
            />
            {activeProject && !editing.projectId && (
              <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, projectId: activeProject.id })}>
                Link to “{activeProject.name}”
              </Button>
            )}
            <Badge tone="neutral">Nothing is uploaded. These numbers stay in this browser.</Badge>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete performance row?"
        body="Only the local record is removed. Your platform analytics are untouched."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) setMetrics((current) => current.filter((item) => item.id !== pendingDelete));
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
