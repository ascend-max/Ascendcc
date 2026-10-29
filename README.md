# AscendCC

**Ascend's AI-assisted cartoon content creation studio.**
Official slogan: **“Become greater than yesterday.”**

AscendCC is a local-first production workspace for short-form animated documentaries about money,
business, economics, psychology, discipline, technology and persuasion. You research a topic, write a
script, build a timed storyboard with explicit animation direction, stage Marlowe (the black jackal
narrator) on a real canvas renderer, record your own narration, sync captions and mouth timing, and
export a real file.

Everything runs in the browser: no paid APIs, no accounts, no API keys, no server, no uploads.
Budget: **R0**.

> **Honesty first.** This is a working foundation, not the finished vision. AscendCC does not
> research the web, does not generate images, does not clone voices, does not lip-sync phonetically
> and does not encode MP4. Everything below is labelled as working, template-based, or not built.

---

## 1. Quick start

Requirements: Node.js 18+ (tested on Node 24) and a modern browser (Chrome/Edge/Firefox on desktop or
Android). A microphone is optional.

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build
npm run test         # Vitest unit tests
npm run typecheck    # TypeScript, no emit
```

Open the app, choose **Projects → New project**, and follow the pipeline. On a phone, add the site to
your home screen for a full-screen studio; the layout is built for narrow screens with a bottom nav.

### First ten minutes (recommended path)

1. **Projects** — create a project with a topic, audience and objective. Default: 45s, vertical 9:16.
2. **Research** — add the claims you intend to make and the sources behind them. Mark unresolved items
   `[VERIFY]`.
3. **Script Studio** — write the hook and narration, then press **Generate storyboard scaffold** (or
   **Split into scenes** if you wrote paragraph-separated narration).
4. **Storyboard Studio** — every scene has a duration, voice-over, visual, **motion direction**, camera,
   transition, sound and word-group captions. Fix anything that does not fit.
5. **Animation Studio** — add layers and motion presets, scrub the timeline, and watch the canvas.
6. **Voice Studio** — record or import narration, attach it to a scene, generate approximate mouth
   timing, and optionally clean up the take with real offline processing.
7. **Animation Studio → Export** — WebM video, PNG still, SRT captions, CSV storyboard, Markdown
   production package, or project JSON.
8. **Settings** — export a JSON backup. Browser storage is not a cloud backup.

---

## 2. What actually works

| Area | Status | Notes |
| --- | --- | --- |
| Application shell, responsive navigation, 14 connected screens | **Working** | Mobile drawer + bottom nav; desktop sidebar |
| Project CRUD, archive, duplicate, delete confirmation | **Working** | Persisted in `localStorage` |
| Research claims, sources, notes, `[VERIFY]` scanner | **Working** | Manual entry only; no web access |
| Script editor, word count, narration estimate, pacing audit | **Working** | Estimates are explicitly labelled |
| Storyboard editor with per-scene timing, motion, camera, transitions, sound | **Working** | Durations are the source of truth; start/end derived |
| Word-group captions with coral emphasis, manual timing editor | **Working** | Timing is marked **estimated** or **measured** |
| Caption export (SRT) | **Working** | Emphasis exported as uppercase (SRT has no styling contract) |
| Procedural mascot renderer (13 poses, 7 expressions, 6 mouth shapes, blink) | **Working** | Canvas 2D, layered drawing, **not** an image sprite |
| Layer system: character, image, shape, text, effect | **Working** | 24 motion presets, camera moves, 6 transitions |
| Live canvas playback with Web Audio narration sync | **Working** | Play/pause/seek/loop/mute/guides |
| Lip-sync from narration loudness + manual mouth-event editor | **Working, approximate** | Amplitude driven, **not phonetic**; labelled as such |
| Audio import, in-browser recording, waveform, duration | **Working** | Browser decoder limits apply (MP3/WAV/M4A/OGG) |
| Audio processing: trim silence, high-pass, compression, peak normalise | **Working (real)** | Offline Web Audio chain; writes a new WAV asset |
| Video export | **Working — WebM only** | Real-time `MediaRecorder` capture of canvas + audio; no MP4 |
| PNG frame export, CSV storyboard, Markdown package, project JSON | **Working** | Downloads are generated client-side |
| Content Calendar with 30-day plan generator | **Working** | Planning only; nothing is auto-published |
| Analytics with manual metrics and comparisons | **Working** | Empty by default; sample rows must be flagged |
| Sales Studio structures, deliverables, A/B ideas | **Working (template-based)** | Uses your inputs; invents nothing |
| Ideas generator, hooks, titles, hashtags, thumbnail text | **Template-based** | Structural scaffolds with `[VERIFY]` slots |
| AI providers | **Not implemented** | Typed seam only; disabled; no key handling in the client |
| Phonetic lip-sync, voice cloning, image generation | **Not implemented** | Not claimed anywhere in the UI |
| Accounts, cloud sync, social publishing | **Not implemented** | Local-only studio |

---

## 3. Design systems (two, deliberately separate)

**A. The application interface** — black and white surfaces with grayscale borders, white text, and
coral `#ff5470` as the only accent. Restrained radii, subtle transitions, production-software density,
mobile-first responsive layout.

**B. The cartoon content it produces** — characters strictly black/white/grayscale; backgrounds
predominantly monochrome; props may carry meaning-carrying colour: coral `#ff5470` (brand/emphasis),
gold (money), red (risk), green (growth). No multicoloured characters, no rainbow gradients.

The renderer enforces the character rule: Marlowe's body and suit are ink and white; the tie is the
single coral accent. Additional colours are chosen per layer by the creator.

---

## 4. Marlowe — the character bible

The primary narrator is a black jackal/dog in a tailored suit: dry, calm, observant, confident,
slightly ironic, never loud. The full specification lives in `src/lib/characters.ts` and is editable in
**Character Studio**; the drawing lives in `src/render/mascot.ts`.

- **Proportions:** ~7 heads tall, narrow silhouette, long muzzle, upright triangular ears.
- **Face:** almond eyes with heavy upper lids (the defining feature), straight brows, thin mouth.
- **Outfit:** ink suit, charcoal lapels, white shirt, narrow coral tie, black shoes.
- **Poses:** neutral, talking, thinking, looking sideways, smirking, surprised, disappointed,
  pointing, open-hand explanation, adjusting suit, walking, sitting, direct gaze.
- **Expressions:** neutral, confident, smirk, surprised, disappointed, thinking, alert.
- **Mouth shapes:** closed, resting, open, wide, rounded, teeth/lip-contact.
- **Animation rules:** one purposeful gesture per beat; blink at most every ~2.5s; talking mouths only
  while narration plays; hold a strong pose for at least 1.2s.

**Cigarette and smoke.** The cigarette is an optional accessory drawn with the head layer and controlled
by `Settings → Mascot design`. It is not an endorsement. Smoke is a **separate effect layer**
(`effect: smoke`) so it animates independently and can be omitted entirely.

**Dani.** No Dani reference art existed in this repository, so AscendCC did **not** invent a design.
A placeholder character record is included so Dani is never merged into Marlowe; upload the original
reference in the Asset Library and attach it there.

---

## 5. Architecture

```
src/
  main.tsx                 React entry
  App.tsx                  Shell, hash router, navigation, project picker
  styles.css               Design system (dark studio, coral accent, responsive)
  types/index.ts           Every persisted shape (projects, scenes, layers, assets, metrics…)
  lib/
    factory.ts             Defaults: projects, scenes, layers, animations, sales plan
    sequence.ts            Scene sequencing, duration fitting, scene-at-time
    motion.ts              Motion presets, easing, layer/camera sampling (pure)
    captions.ts            Word grouping, emphasis, timing, flattening, SRT
    script.ts              Word count, narration estimate, pacing audit
    characters.ts          Character bible, poses, expressions, mouth poses
    templates.ts           Content intelligence: beats, scaffolds, packages, calendar plans
    storage.ts             localStorage state + IndexedDB blob store + JSON import/export
    voice.ts               Decode, analyse, waveform peaks, offline processing, WAV, lip-sync
    playback.ts            Web Audio timeline scheduler
    exporter.ts            WebM capture, PNG frames, SRT/CSV/Markdown output
    logic.test.ts          Unit tests for the pure logic
  render/
    mascot.ts              Procedural layered drawing of the narrator
    draw.ts                Scene/layer rendering, captions, effects, transitions, camera
  state/store.tsx          Single store, debounced persistence, toasts
  components/              UI primitives, icons, player, project gate, asset-image hook
  pages/                   Fourteen connected screens
```

**Data flow:** UI → store action → immutable state update → debounced `localStorage` save. Media blobs
(images, audio) go to IndexedDB and are referenced by `blobId`. The store shape is plain JSON, so a
hosted database can replace `storage.ts` without touching the UI or the renderer.

**Animation model:** a scene owns layers; each layer owns animations (`preset`, `start`, `duration`,
`loop`, `strength`, `easing`, `direction`). `sampleLayer()` evaluates every animation at a local time:
offsets add, scale and opacity multiply, entrance presets hide the layer before their start. The camera
is sampled separately. This model is renderer-agnostic — a future WebCodecs/MP4 pipeline can reuse it.

**Rendering:** `drawProjectFrame()` draws the scene at an absolute timeline time, including transition
compositing (fade, slide, wipe, zoom), camera transform, captions and optional safe-area guides. The
same function drives the preview and the export, so what you see is what is recorded.

---

## 6. Motion vocabulary

Presets: pop-in, fade-in, fade-out, slide-in, slide-out, scale-bounce, slow push-in, pull-out,
parallax drift, drift left/right, idle float, looping rotation, looping machinery, head bob, blink,
talking mouth, point, open-hand, adjust suit, progressive change, impact shake, pulse highlight,
and “no motion”.

Each animation stores when it starts and how long it lasts, and the storyboard's motion text is
generated from the same data (or written by hand). The aim is a meaningful visual change every ~2–4
seconds — not constant fidgeting.

---

## 7. Captions, voice and lip-sync: the real limits

- Captions are **2–5 words** per group, with a small number of words emphasised: uppercase, slightly
  larger, coral `#ff5470`, everything else white with a dark stroke. Emphasis is a heuristic (numbers,
  acronyms, then the longest meaningful word) and every word can be toggled by hand.
- Caption timing is **estimated from word count** until you attach a measured recording. Estimated
  groups are labelled in the editor, in the player, in the SRT comment-free output and in the
  production package.
- Lip-sync is **amplitude driven**: `lipSyncFromBuffer()` windows the waveform, maps loudness to mouth
  shapes and produces timed events you can edit. This is believable movement for a stylised character,
  **not phoneme accuracy**, and the UI says so.
- Audio “clean-up” is real DSP through `OfflineAudioContext` (silence trim, 85 Hz high-pass,
  −24 dB / 3:1 compression, peak normalisation) and produces a new WAV asset. The original is kept.
- Voice recordings never leave the device. There is no voice cloning and no synthetic narrator.

---

## 8. Export

| Format | Status | Notes |
| --- | --- | --- |
| WebM video (VP8/VP9 + Opus) | **Supported where the browser supports `MediaRecorder` + `captureStream`** | Real-time capture: a 45s video takes ~45s. Includes narration/music tracks scheduled into the recording. |
| PNG still | Supported | Exports the exact rendered frame at a chosen offset |
| SRT captions | Supported | Word-grouped, emphasis uppercased |
| Storyboard CSV | Supported | Time, voice-over, text, visual + motion, sound, transition |
| Markdown production package | Supported | Storyboard table, deliverables, claims/sources, verification list |
| Project JSON | Supported | Project state only; media blobs stay in IndexedDB |
| MP4 / H.264 | **Not implemented** | The app says so instead of faking it; convert the WebM with a free local tool if a platform demands MP4 |

Transitions, captions and guides are all rendered through the same path as preview. Safe-area guides
are never baked into exports.

---

## 9. Privacy, storage and safety

- **Local only.** No network requests, no analytics, no accounts. Clearing site data deletes projects
  and media.
- `localStorage` holds JSON state (small quota); IndexedDB (`ascendcc.blobs.v1`) holds images and audio.
- Export a JSON backup from **Settings** after each session; media must be backed up separately.
- Destructive actions (delete project/scene/layer/asset/recording, reset studio, import replace)
  require confirmation.
- Invalid files are rejected with a message; missing media renders a labelled placeholder, never a
  crash.
- No secrets are used, and there is no code path that could store an API key in the frontend.

---

## 10. Testing and verification

```bash
npm run test       # 20 unit tests across sequencing, captions, motion, templates, calendar
npm run typecheck  # strict TypeScript
npm run build      # production bundle
```

Unit tests cover: scene sequencing and duration fitting, scene-at-time resolution, caption grouping
and SRT, narration estimation and pacing, motion sampling (pop-in, blink, gestures, camera), generated
storyboard structure and timing sums, `[VERIFY]` discipline, deliverable generation, and calendar
planning.

**Not covered by automated tests:** canvas drawing, Web Audio decoding/recording, `MediaRecorder`
export, IndexedDB, and touch interactions. These require a real browser and a microphone; verify them
manually before relying on them for a published video.

---

## 11. What remains incomplete

1. MP4/H.264 export and a frame-accurate (non-real-time) encoder (WebCodecs + muxer).
2. Phonetic lip-sync (currently loudness-based) and forced alignment.
3. Character rig import (SVG/PSD/After Effects style layers) — the built-in mascot is procedural.
4. A hosted database and multi-device sync behind the existing JSON store.
5. Any AI provider integration — optional, server-mediated, disabled until configured.
6. Platform analytics import and publishing integrations (both require authorisation and are out of
   scope for an R0 local build).
7. Richer effects and a compositing graph beyond the current preset list.

### Next recommended implementation step

Implement **frame-accurate video export via WebCodecs** (`VideoEncoder` + an audio `AudioEncoder` and a
WebM muxer), so export no longer takes real time, works for longer timelines, and can add an MP4
muxer behind the same scene/layer model. Everything upstream — scenes, layers, captions, audio
buffers — is already deterministic, so only the encoder changes.

---

## 12. Independence

AscendCC is a separate application from Napoleon. There is no shared runtime, database,
authentication, or deployment dependency. A future integration interface could exchange exported
projects or rendered video, but nothing is connected today.

**AscendCC — become greater than yesterday.**
