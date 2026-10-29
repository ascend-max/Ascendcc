# AscendCC — Handover Document

**Status:** first working release (local-first web app).
**Product:** AscendCC — Ascend's AI-assisted cartoon content creation studio.
**Slogan:** “Become greater than yesterday.”
**Repository:** `ascend-max/Ascendcc` · branch `freebuff/8af5eab4769afe97d076d011`.
**State at handover:** changes are uncommitted and unpushed. The dev server was left running in the cloud workspace only; it does not survive archiving.
**Date:** 2026-10-28.

---

## 1. Context

AscendCC is a production workspace for short-form animated documentaries about money, business,
economics, psychology, discipline, technology and persuasion. It was built from scratch; the
repository previously contained only a one-line README.

Constraints that shaped it:

- **Budget R0.** No paid APIs, hosting, subscriptions, stock assets or mandatory keys.
- **Local-first.** No accounts, no server, no uploads. Projects in `localStorage`, media in IndexedDB.
- **Beginner creator on an Android phone.** Responsive layout, bottom navigation, no desktop-only
  essential actions.
- **Independent of Napoleon.** No shared runtime, database or auth.
- **Honesty over appearance.** Anything unimplemented says so in the UI and here.

Target user outcome: a creator should be able to research a topic, write and structure a script, build
a timed storyboard with explicit motion direction, stage a character on a real canvas renderer, record
narration, caption it, preview it, and export a file — without paying for anything.

---

## 2. Stack

- React 18 + TypeScript + Vite 5.
- Hand-written responsive CSS design system (dark studio, coral `#ff5470` accent).
- Canvas 2D renderer for both preview and export.
- Web Audio API for decoding, analysis, offline processing and timeline playback.
- MediaRecorder for WebM capture.
- IndexedDB (`ascendcc.blobs.v1`) for images/audio; `localStorage` (`ascendcc.state.v1`) for JSON state.
- Hash routing; bespoke store with debounced persistence; no state or router library.
- Runtime dependencies: `react`, `react-dom` only. Dev: Vite, `@vitejs/plugin-react`, TypeScript, Vitest.

---

## 3. Feature inventory (14 connected screens)

1. **Dashboard** — production pipeline with per-stage completion, next actions, timing audit, local
   storage summary, recent projects, dismissible storage warning.
2. **Projects** — create/edit/duplicate/archive/delete (confirmation required), platform, orientation,
   target duration, content mode, status, narration/visual style.
3. **Research** — claims with verification states (`unverified`, `in-progress`, `verified`,
   `disputed`, `opinion`), sources with primary flag + published/accessed dates, notes, and a
   `[VERIFY]` scanner linking markers to scenes. No web access; the UI states nothing is auto-verified.
4. **Ideas** — six generated angles per topic, five hooks, three titles, hashtags, thumbnail text,
   promote an idea into a project, ten additional series formats.
5. **Script Studio** — hook/narration/CTA/emphasis/fact-check fields, word count, narration-length
   **estimate** (2.5 words/second, labelled as an estimate), pacing audit against the storyboard,
   outline from narrative templates, script variations, split narration into scenes, generate a
   storyboard scaffold, editable content package, Markdown export.
6. **Storyboard Studio** — per-scene title, duration, voice-over, on-screen text, visual description,
   explicit motion direction, camera + intensity, transition + length, SFX, music, asset references,
   cursive black interstitial cards (text/motion/sfx/next-scene connection), caption editor with
   per-word coral emphasis and manual in/out points, fit-timeline-to-target, reorder, delete.
7. **Character Studio** — editable character bible (silhouette, proportions, face, outfit, colour
   rules, animation rules, naming convention), live procedural mascot preview with pose/expression/
   mouth/blink controls, cigarette and smoke design toggles, Dani placeholder note.
8. **Asset Library** — multi-file import into IndexedDB, image/audio previews, 16 categories,
   metadata (colour notes, usage notes, transparency), attach-to-project, delete with confirmation,
   naming convention, honest “flat image has no editable layers” labelling.
9. **Animation Studio** — canvas player with loop/mute/guides, scene strip, timeline with animation
   bars, layer inspector (position/scale/rotation/opacity/z, pose/expression/mouth, text, colours),
   24 motion presets, camera and transition controls, export panel.
10. **Voice Studio** — record or import, waveform, duration/peak analysis, offline processing chain
    (trim, high-pass 85 Hz, −24 dB/3:1 compression, peak normalisation) writing a new WAV, attach to
    scene, fit warnings, amplitude-derived mouth events plus manual editor.
11. **Sales Studio** — audience, problem, outcome, awareness level, objections, buying context, offer,
    price, evidence, desired action; nine-step persuasion structure with include toggles; generated
    value proposition, positioning, hooks, script variations and A/B ideas. No invented proof,
    scarcity or guaranteed results.
12. **Content Calendar** — month grid, editable entries (date, pillar, platform, status, linked
    project, notes), 30-day plan generator from pillars, ten extra series. Planning only; nothing is
    published automatically.
13. **Analytics** — manual metric entry only (views, 3s hold, average watch, % viewed, completion,
    shares, likes, comments, follows, platform, topic, hook, publication date); comparisons across
    tracked videos; empty state; sample rows must be explicitly flagged and are labelled SAMPLE.
14. **Settings** — brand/creator/slogan, new-project defaults, mascot toggles, JSON export/import,
    reset with confirmation, disabled AI-provider placeholder, release-status and limitations list.

---

## 4. Architecture

```
src/
  main.tsx                 React entry
  App.tsx                  Shell, hash router, navigation, active project picker
  styles.css               Design system (dark studio, coral accent, responsive)
  types/index.ts           Every persisted shape
  lib/
    factory.ts             Defaults: projects, scenes, layers, animations, sales plan
    sequence.ts            Scene sequencing, duration fitting, scene-at-time, resolved audio tracks
    motion.ts              Motion presets, easing, layer/camera sampling (pure)
    captions.ts            Word grouping, emphasis heuristics, timing, flattening, SRT
    script.ts              Word count, narration estimate, pacing audit
    characters.ts          Character bible, poses, expressions, mouth poses, asset naming
    templates.ts           Beat structures, scaffolds, packages, hooks/titles, calendar plans
    storage.ts             localStorage state, IndexedDB blobs, JSON import/export, downloads
    voice.ts               Decode, peaks/RMS, silence bounds, offline processing, WAV, lip-sync
    playback.ts            Web Audio timeline scheduler with decoded-buffer cache
    exporter.ts            WebM capture, PNG frames, SRT/CSV/Markdown, package builder
    logic.test.ts          20 unit tests
  render/
    mascot.ts              Procedural layered drawing of Marlowe (narrator)
    draw.ts                Scene/layer rendering, captions, effects, camera, transitions
  state/store.tsx          Single store, debounced persistence, toasts, CRUD actions
  components/              UI primitives, icons, player, project gate, asset-image hook
  pages/                   Fourteen screens
```

**Data flow.** UI → store action → immutable update → debounced `localStorage` save (400 ms).
Binary media goes to IndexedDB and is referenced by `blobId`. The state is plain JSON so a hosted
database can replace `storage.ts` without touching UI or renderer.

**Animation model.** A scene owns layers; a layer owns animations (`preset`, `start`, `duration`,
`loop`, `strength`, `easing`, `direction`). `sampleLayer(layer, t)` composes all animations: offsets
add, scale/opacity multiply, entrance presets hide the layer before their start, gestures override the
pose only inside their window. Camera sampling is separate. This is renderer-agnostic, so a future
WebCodecs/MP4 pipeline can reuse it unchanged.

**Rendering.** `drawProjectFrame()` draws the absolute timeline time: camera transform, z-sorted
layers, procedural mascot or image assets, progressive effects, captions and transition compositing.
Incoming shots during a transition are rendered to a reused offscreen canvas so their background fill
cannot erase the outgoing shot. The same function drives preview and export.

**Caption timing.** With an attached recording, groups are scaled to the measured duration and the
`estimated` flag is false. Otherwise timing is estimated from word count and marked “estimated”
everywhere (editor, player, SRT output, production package).

**Audio.** Narration follows its scene: `resolvedAudioTracks(project)` re-derives each track's start
from the scene start at playback/export time, so reordering scenes cannot desync narration.

---

## 5. Verification performed

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0, no errors |
| `npx vitest run` | 20/20 tests pass (`src/lib/logic.test.ts`) |
| `npm run build` | exit 0 — 372.84 kB JS (116.5 kB gzip), 34.65 kB CSS (6.94 kB gzip) |
| Vite dev server | ready in 210 ms on `0.0.0.0:3000` |
| HTTP probes | 200 for `/`, `/src/main.tsx`, `/src/styles.css` with the preview Host header |

Tests cover: scene sequencing and duration fitting, scene-at-time resolution, caption grouping and
emphasis discipline, measured-vs-estimated flags, SRT formats, narration estimation and pacing,
motion sampling (pop-in visibility before start, blink window, gesture window, camera push-in),
generated storyboard structure and exact target-duration sum, `[VERIFY]` presence, deliverable
generation and Markdown package, and calendar planning (30 entries, existing dates skipped).

**Known unverified areas.** The cloud environment has no browser or Chromium, so the following need a
manual pass in the preview panel: canvas mascot visuals, layout at phone widths, microphone
recording, audio decoding, MediaRecorder WebM export, and IndexedDB round-trips. No automated claim is
made about them.

Two real defects were found and fixed during verification:

1. Entrance animations rendered their layer from frame one instead of at their start time.
2. Transitions erased the outgoing shot because the incoming scene cleared the shared canvas — fixed
   with offscreen compositing.

---

## 6. How to run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # type-check + production build
npm run preview    # serve dist/
npm run test       # Vitest
npm run typecheck  # tsc --noEmit
```

First-run walkthrough: Projects → create project → Research → Script Studio (generate scaffold) →
Storyboard Studio (fix durations/motion) → Animation Studio (layers, preview) → Voice Studio (record,
attach, mouth timing) → Animation Studio → Export → Settings (JSON backup).

---

## 7. Limitations (as shipped)

- **No MP4/H.264.** WebM only, recorded in real time (a 45 s video takes ~45 s).
- **Lip-sync is amplitude-driven**, not phonetic; labelled approximate everywhere.
- **No AI integration.** A typed settings seam exists; the toggle is disabled and there is no request
  path or key handling in the client.
- **No web research.** Claims and sources are manual; the UI says so.
- **No voice cloning, image generation, cloud sync, accounts, social publishing or analytics import.**
- Caption timing is an estimate until a measured recording is attached.
- `localStorage` is not a backup; media is not included in JSON exports.
- Character artwork is procedural for Marlowe. A flat imported image stays one layer.
- Dani has no supplied reference: a placeholder character record exists so the design is never
  invented or merged into Marlowe.

---

## 8. Recommended next steps

1. **Frame-accurate export with WebCodecs** + muxer, adding MP4 behind the existing scene model. This
   removes real-time capture and makes longer timelines practical.
2. **Word-level caption alignment** from the attached recording so timing stops being an estimate.
3. **Portable backups**: bundle IndexedDB media with project JSON into one archive.
4. **Visual QA and polish** of the mascot and mobile layout in a real browser.
5. Optional, server-mediated AI assistance behind the existing seam — disabled until configured, keys
   never in the frontend.

---

## 9. Design constraints to preserve

- **Interface:** black/white/grayscale surfaces, strong contrast, coral `#ff5470` as the single accent,
  restrained spacing, serious production-software feel, responsive and phone-usable.
- **Generated content:** characters strictly monochrome; backgrounds predominantly monochrome; props
  may use coral (brand), gold (money), red (risk), green (growth) only when meaning requires it. No
  multicoloured characters or rainbow gradients.
- **Narrative defaults:** 45 s, vertical 9:16, animated documentary, calm dry narration, a meaningful
  visual change every ~2–4 seconds, one purposeful mascot gesture per beat.
- **Editorial rules:** no invented statistics, quotes, testimonials or motives; unverified claims are
  marked `[VERIFY]`; no fake scarcity; no promised conversions or virality.

---

## 10. Independence

AscendCC is a separate application from Napoleon. There is no shared runtime, database,
authentication or deployment dependency. A future integration interface could exchange exported
projects or rendered video, but nothing is connected today.

**AscendCC — become greater than yesterday.**
