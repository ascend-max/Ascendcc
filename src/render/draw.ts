import type { Character, Project, Scene, SceneLayer, Settings } from '../types';
import { activeCaption, captionProgress } from '../lib/captions';
import { MASCOT_ID } from '../lib/characters';
import { sampleCamera, sampleLayer } from '../lib/motion';
import { sceneAtTime, timelineDuration } from '../lib/sequence';
import { mouthAtEvents } from '../lib/voice';
import { clamp } from '../lib/time';
import { CORAL, drawMascot, GRAY, INK, WHITE } from './mascot';

export interface FrameInput {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  project: Project;
  /** Asset images already decoded, keyed by layer refId (asset id). */
  images: Map<string, HTMLImageElement>;
  characters: Character[];
  settings: Settings;
  /** Absolute timeline time in seconds. */
  time: number;
  showGuides?: boolean;
}

const FONT_STACK = `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
const CURSIVE_STACK = `'Snell Roundhand', 'Brush Script MT', 'Segoe Script', Georgia, serif`;

export function frameSize(project: Project): { width: number; height: number } {
  switch (project.orientation) {
    case '16:9':
      return { width: 1920, height: 1080 };
    case '1:1':
      return { width: 1080, height: 1080 };
    default:
      return { width: 1080, height: 1920 };
  }
}

function hash(seed: number): number {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/* ------------------------------------------------------------------ */
/* Layers                                                              */
/* ------------------------------------------------------------------ */

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, layer: SceneLayer): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, layer.color);
  gradient.addColorStop(1, '#dcdce1');
  ctx.fillStyle = layer.color === '#f2f2f4' || layer.color === '#f4f4f5' ? gradient : layer.color;
  ctx.fillRect(0, 0, width, height);

  // A quiet floor line keeps the figure grounded without extra artwork.
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(0, height * 0.855, width, height * 0.145);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  layer: SceneLayer,
  width: number,
  height: number,
  reveal: number,
  glow: number,
): void {
  const px = layer.x * width;
  const py = layer.y * height;
  const scale = layer.scale;
  const color = layer.color || '#16161a';

  ctx.save();
  ctx.translate(px, py);

  switch (layer.refId) {
    case 'bg': {
      ctx.restore();
      drawBackground(ctx, width, height, layer);
      return;
    }
    case 'panel': {
      const w = width * 0.66 * scale;
      const h = height * 0.15 * scale;
      const grow = clamp(reveal, 0.001, 1);
      ctx.globalAlpha *= 1;
      ctx.fillStyle = color;
      roundedRect(ctx, (-w / 2) * grow, -h / 2, w * grow, h, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      for (let line = 0; line < 2; line += 1) {
        const lineWidth = w * (line === 0 ? 0.5 : 0.34) * grow;
        ctx.fillRect(-w / 2 + 28, -h / 2 + 34 + line * 26, lineWidth, 8);
      }
      break;
    }
    case 'block': {
      const w = width * 0.44 * scale;
      const h = height * 0.3 * scale;
      const grow = clamp(reveal, 0.001, 1);
      ctx.fillStyle = color;
      rectanglePath(ctx, -w / 2, -h, w, h * grow);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 4;
      ctx.stroke();
      // Windows
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      const cols = 4;
      const rows = 5;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (r / rows > grow) continue;
          ctx.fillRect(-w / 2 + 20 + c * (w - 40) / cols, -h + 22 + r * (h - 44) / rows, 16, 12);
        }
      }
      break;
    }
    case 'bar': {
      const barW = width * 0.1 * scale;
      const maxH = height * 0.32 * scale;
      const grow = clamp(reveal, 0.02, 1);
      const baseY = height * 0.1;
      ctx.fillStyle = color;
      ctx.fillRect(-barW / 2, baseY - maxH * grow, barW, maxH * grow);
      if (glow > 0) {
        ctx.strokeStyle = `rgba(255,84,112,${0.2 + glow * 0.6})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(-barW / 2 - 4, baseY - maxH * grow - 4, barW + 8, maxH * grow + 8);
      }
      break;
    }
    case 'circle': {
      const r = width * 0.13 * scale;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, r * clamp(reveal, 0.05, 1), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'line': {
      const w = width * 0.6 * scale * clamp(reveal, 0.02, 1);
      ctx.strokeStyle = color;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(w / 2, 0);
      ctx.stroke();
      break;
    }
    default: {
      const w = width * 0.4 * scale;
      const h = height * 0.1 * scale;
      ctx.fillStyle = color;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
  }
  ctx.restore();
}

function rectanglePath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: SceneLayer,
  width: number,
  height: number,
  reveal: number,
): void {
  const size = Math.max(18, height * 0.045 * layer.scale);
  ctx.save();
  ctx.font = `700 ${size}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = layer.color || WHITE;
  const full = layer.text || '';
  const visible = reveal >= 1 ? full : full.slice(0, Math.max(0, Math.floor(full.length * reveal)));
  const lines = wrapText(ctx, visible, width * 0.82);
  const lineHeight = size * 1.25;
  const startY = layer.y * height - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, layer.x * width, startY + index * lineHeight);
  });
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Effects                                                             */
/* ------------------------------------------------------------------ */

function drawEffect(
  ctx: CanvasRenderingContext2D,
  layer: SceneLayer,
  width: number,
  height: number,
  time: number,
  reveal: number,
): void {
  const px = layer.x * width;
  const py = layer.y * height;
  const color = layer.color || CORAL;

  if (layer.refId === 'cracks') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, width * 0.006);
    ctx.lineCap = 'round';
    const cracks = [
      { threshold: 0.05, points: [[0, -height * 0.16], [24, -height * 0.09], [-10, -height * 0.02], [18, height * 0.06]] },
      { threshold: 0.4, points: [[24, -height * 0.09], [70, -height * 0.12], [96, -height * 0.04], [78, height * 0.02]] },
      { threshold: 0.72, points: [[-10, -height * 0.02], [-64, height * 0.01], [-92, height * 0.07], [-72, height * 0.13]] },
    ];
    cracks.forEach((crack) => {
      if (reveal < crack.threshold) return;
      const localProgress = clamp((reveal - crack.threshold) / (1 - crack.threshold), 0, 1);
      const totalSegments = crack.points.length - 1;
      const completed = localProgress * totalSegments;
      ctx.beginPath();
      ctx.moveTo(px + crack.points[0][0], py + crack.points[0][1]);
      crack.points.slice(1).forEach((point, index) => {
        const local = clamp(completed - index, 0, 1);
        if (local <= 0) return;
        const prev = crack.points[index];
        ctx.lineTo(px + prev[0] + (point[0] - prev[0]) * local, py + prev[1] + (point[1] - prev[1]) * local);
      });
      ctx.stroke();
    });
    ctx.restore();
    return;
  }

  if (layer.refId === 'smoke') {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i += 1) {
      const phase = ((time * 0.22 + i / 9) % 1);
      const drift = hash(i * 3.3 + Math.floor(time * 0.6)) * 30 - 15;
      const radius = width * (0.012 + phase * 0.05);
      const alpha = (1 - phase) * 0.28 * clamp(reveal, 0, 1);
      ctx.fillStyle = `rgba(240,240,244,${alpha})`;
      ctx.beginPath();
      ctx.arc(px + drift + Math.sin(phase * 6) * 18, py - phase * height * 0.18, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (layer.refId === 'speedlines') {
    ctx.save();
    ctx.globalAlpha *= 0.5 * clamp(reveal, 0, 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 14; i += 1) {
      const y = py - height * 0.2 + i * height * 0.03;
      const offset = (time * 340 + i * 60) % width;
      ctx.lineWidth = 3 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(offset - width * 0.12, y);
      ctx.lineTo(offset + width * 0.06, y);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (layer.refId === 'dust') {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 26; i += 1) {
      const x = hash(i) * width;
      const y = (hash(i + 40) * height + time * 18) % height;
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (layer.refId === 'grain') {
    ctx.save();
    ctx.globalAlpha *= 0.12 * clamp(reveal, 0, 1);
    const frame = Math.floor(time * 12);
    for (let i = 0; i < 160; i += 1) {
      const x = hash(i + frame * 31) * width;
      const y = hash(i * 7 + frame * 17) * height;
      ctx.fillStyle = i % 2 ? '#000' : '#fff';
      ctx.fillRect(x, y, 3, 3);
    }
    ctx.restore();
    return;
  }

  if (layer.refId === 'vignette') {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, height * 0.72);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: SceneLayer,
  scene: Scene,
  localTime: number,
  width: number,
  height: number,
  images: Map<string, HTMLImageElement>,
  characters: Character[],
  settings: Settings,
): void {
  const sample = sampleLayer(layer, localTime);
  if (!sample.visible) return;
  const opacity = clamp(sample.opacity * layer.opacity, 0, 1);
  if (opacity <= 0.004) return;

  ctx.save();
  ctx.globalAlpha = opacity;

  if (layer.kind === 'character') {
    const character = characters.find((item) => item.id === layer.refId) ?? characters.find((item) => item.id === MASCOT_ID);
    const isMascot = !character || character.id === MASCOT_ID || character.builtin;
    const pose = sample.pose ?? layer.pose;
    let mouth = sample.mouth ?? layer.mouth;
    if (scene.lipSync.enabled && scene.lipSync.events.length) {
      mouth = mouthAtEvents(scene.lipSync.events, localTime, layer.mouth);
    }
    if (isMascot) {
      const baseScale = (height * 0.82) / 1040;
      ctx.translate((layer.x + sample.dx) * width, (layer.y + sample.dy) * height);
      ctx.rotate(((layer.rotation + sample.rotation) * Math.PI) / 180);
      ctx.scale(baseScale * layer.scale * sample.scale, baseScale * layer.scale * sample.scale);
      drawMascot(ctx, {
        pose,
        expression: layer.expression,
        mouth,
        blink: sample.blink,
        cigarette: settings.cigarette,
        accent: character?.accentColor ?? CORAL,
      });
    } else {
      // Non-mascot characters are image assets; if none exists, draw a labelled placeholder.
      const image = images.get(layer.refId);
      if (image) {
        ctx.translate((layer.x + sample.dx) * width, (layer.y + sample.dy) * height);
        const w = width * 0.5 * layer.scale * sample.scale;
        const h = (image.height / image.width) * w;
        ctx.drawImage(image, -w / 2, -h, w, h);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 4;
        const w = width * 0.34;
        const h = height * 0.44;
        ctx.strokeRect(layer.x * width - w / 2, layer.y * height - h / 2, w, h);
        ctx.font = `500 ${Math.round(width * 0.03)}px ${FONT_STACK}`;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(character ? character.name : 'Character', layer.x * width, layer.y * height);
      }
    }
    ctx.restore();
    return;
  }

  if (layer.kind === 'image') {
    const image = images.get(layer.refId);
    ctx.translate((layer.x + sample.dx) * width, (layer.y + sample.dy) * height);
    ctx.rotate(((layer.rotation + sample.rotation) * Math.PI) / 180);
    if (image) {
      const w = width * 0.62 * layer.scale * sample.scale;
      const h = (image.height / image.width) * w;
      ctx.drawImage(image, -w / 2, -h / 2, w, h);
    } else {
      const w = width * 0.4;
      const h = height * 0.24;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.setLineDash([12, 10]);
      ctx.lineWidth = 4;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = `500 ${Math.round(width * 0.026)}px ${FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.fillText(`Missing asset: ${layer.label}`, 0, 8);
    }
    ctx.restore();
    return;
  }

  if (layer.kind === 'text') {
    ctx.save();
    ctx.translate(sample.dx * width, sample.dy * height);
    drawTextLayer(ctx, layer, width, height, sample.reveal);
    ctx.restore();
    ctx.restore();
    return;
  }

  if (layer.kind === 'effect') {
    drawEffect(ctx, layer, width, height, localTime, sample.reveal);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(sample.dx * width, sample.dy * height);
  drawShape(ctx, layer, width, height, sample.reveal, sample.glow);
  ctx.restore();
  ctx.restore();
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  localTime: number,
  width: number,
  height: number,
  images: Map<string, HTMLImageElement>,
  characters: Character[],
  settings: Settings,
  options: { drawCaptions?: boolean; offscreenOffsetX?: number } = {},
): void {
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  if (scene.interstitial.enabled && scene.interstitial.text) {
    drawInterstitial(ctx, scene, localTime, width, height);
    ctx.restore();
    return;
  }

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, width, height);

  const camera = sampleCamera(scene, localTime);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-width / 2 + camera.dx * width, -height / 2 + camera.dy * height);

  const ordered = scene.layers
    .map((layer, index) => ({ layer, index }))
    .sort((a, b) => a.layer.z - b.layer.z || a.index - b.index);

  for (const { layer } of ordered) {
    drawLayer(ctx, layer, scene, localTime, width, height, images, characters, settings);
  }
  ctx.restore();

  if (scene.interstitial.enabled) {
    // Interstitial scenes have no layers; the card is the shot.
  }

  if (options.drawCaptions !== false) {
    drawCaptions(ctx, scene, localTime, width, height);
  }

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Interstitial cards                                                  */
/* ------------------------------------------------------------------ */

function drawInterstitial(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  localTime: number,
  width: number,
  height: number,
): void {
  const card = scene.interstitial;
  const inDuration = 0.4;
  const outDuration = 0.35;
  const holdEnd = Math.max(inDuration + 0.4, card.hold);
  const total = holdEnd + outDuration;
  const fadeIn = clamp(localTime / inDuration, 0, 1);
  const fadeOut = localTime > holdEnd ? clamp(1 - (localTime - holdEnd) / outDuration, 0, 1) : 1;
  const alpha = Math.min(fadeIn, fadeOut);

  ctx.fillStyle = '#07070a';
  ctx.fillRect(0, 0, width, height);

  if (localTime > total) {
    return;
  }

  const entrance = clamp((localTime - 0.15) / 0.7, 0, 1);
  const translateY = (1 - entrance) * height * 0.02;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(0, translateY);

  const size = width * 0.085;
  ctx.font = `italic 600 ${size}px ${CURSIVE_STACK}`;
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = wrapText(ctx, card.text, width * 0.8);
  const lineHeight = size * 1.35;
  const startY = height * 0.5 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * lineHeight);
  });

  // Coral underline draws in with the card.
  const underlineWidth = width * 0.18 * clamp(entrance * 1.4, 0, 1);
  ctx.strokeStyle = CORAL;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(width / 2 - underlineWidth / 2, startY + (lines.length - 1) * lineHeight + size * 0.9);
  ctx.lineTo(width / 2 + underlineWidth / 2, startY + (lines.length - 1) * lineHeight + size * 0.9);
  ctx.stroke();

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Captions                                                            */
/* ------------------------------------------------------------------ */

function drawCaptions(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  localTime: number,
  width: number,
  height: number,
): void {
  if (scene.interstitial.enabled) return;
  const group = activeCaption(scene.captions, localTime);
  if (!group) return;

  const progress = captionProgress(group, localTime);
  const pop = clamp(progress * 8, 0, 1);
  const baseSize = width * 0.075;
  const emphasisScale = 1.16;
  const maxWidth = width * 0.86;

  const lines: { words: typeof group.words; width: number }[] = [];
  let current: typeof group.words = [];
  let currentWidth = 0;

  ctx.font = `800 ${baseSize}px ${FONT_STACK}`;
  const spaceWidth = ctx.measureText(' ').width;

  for (const word of group.words) {
    const size = word.emphasis ? baseSize * emphasisScale : baseSize;
    ctx.font = `800 ${size}px ${FONT_STACK}`;
    const wordWidth = ctx.measureText(word.text).width;
    const extra = current.length ? spaceWidth * 1.1 : 0;
    if (currentWidth + wordWidth + extra > maxWidth && current.length) {
      lines.push({ words: current, width: currentWidth });
      current = [word];
      currentWidth = wordWidth;
    } else {
      current.push(word);
      currentWidth += wordWidth + extra;
    }
  }
  if (current.length) lines.push({ words: current, width: currentWidth });

  const lineHeight = baseSize * 1.22;
  const totalHeight = lines.length * lineHeight;
  const baseY = height * 0.735 - totalHeight / 2;

  // Subtle backdrop for contrast over light scenes.
  const paddingX = width * 0.04;
  const boxWidth = Math.min(width * 0.94, Math.max(...lines.map((line) => line.width)) + paddingX * 2);
  const boxHeight = totalHeight + baseSize * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.42 * pop;
  ctx.fillStyle = '#08080a';
  roundedRect(ctx, width / 2 - boxWidth / 2, baseY - baseSize * 0.42, boxWidth, boxHeight, width * 0.03);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = pop;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  lines.forEach((line, lineIndex) => {
    let cursor = width / 2 - line.width / 2;
    const y = baseY + lineIndex * lineHeight + lineHeight / 2;
    line.words.forEach((word, wordIndex) => {
      const size = word.emphasis ? baseSize * emphasisScale : baseSize;
      ctx.font = `800 ${size}px ${FONT_STACK}`;
      const text = word.emphasis ? word.text.toUpperCase() : word.text;
      ctx.lineWidth = width * 0.011;
      ctx.strokeStyle = '#08080a';
      ctx.strokeText(text, cursor, y);
      ctx.fillStyle = word.emphasis ? CORAL : WHITE;
      ctx.fillText(text, cursor, y);
      cursor += ctx.measureText(text).width;
      if (wordIndex < line.words.length - 1) cursor += spaceWidth * 1.1;
    });
  });

  if (group.estimated) {
    ctx.font = `600 ${Math.round(width * 0.018)}px ${FONT_STACK}`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'right';
    ctx.fillText('timing estimated', width - width * 0.04, baseY + boxHeight + width * 0.02);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Project frame (with transitions)                                    */
/* ------------------------------------------------------------------ */

let scratchCanvas: HTMLCanvasElement | null = null;

/** Reused offscreen buffer so a transition can composite two full frames. */
function getScratchCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document === 'undefined') throw new Error('Canvas rendering requires a browser document.');
  if (!scratchCanvas) scratchCanvas = document.createElement('canvas');
  if (scratchCanvas.width !== width || scratchCanvas.height !== height) {
    scratchCanvas.width = width;
    scratchCanvas.height = height;
  }
  return scratchCanvas;
}

export function drawProjectFrame(input: FrameInput): void {
  const { ctx, width, height, project, images, characters, settings, time } = input;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const total = timelineDuration(project);
  if (!total) {
    drawEmptyState(ctx, width, height);
    ctx.restore();
    return;
  }

  const at = sceneAtTime(project, clamp(time, 0, Math.max(0, total - 0.001)));
  if (!at) {
    drawEmptyState(ctx, width, height);
    ctx.restore();
    return;
  }

  const { scene, localTime, index } = at;
  const captionsEnabled = project.settings.captionMode !== 'off';
  const prev = index > 0 ? project.scenes[index - 1] : undefined;
  const transitionDuration = Math.max(0, scene.transitionDuration);
  const inTransition = Boolean(prev && scene.transition !== 'cut' && transitionDuration > 0 && localTime < transitionDuration);
  const progress = inTransition ? clamp(localTime / transitionDuration, 0, 1) : 1;

  const inCaptions = captionsEnabled && progress > 0.85;

  if (inTransition && prev) {
    // Outgoing shot first, moving out for the slide transitions.
    ctx.save();
    if (scene.transition === 'slideLeft') ctx.translate(-width * progress, 0);
    if (scene.transition === 'slideUp') ctx.translate(0, -height * progress);
    drawScene(ctx, prev, prev.duration, width, height, images, characters, settings, { drawCaptions: false });
    ctx.restore();

    // The incoming shot is rendered offscreen: drawScene clears and fills its
    // own frame, so drawing it straight onto the shared context would erase the
    // outgoing shot and every transition would fade in from black.
    const scratch = getScratchCanvas(width, height);
    const scratchCtx = scratch.getContext('2d');
    if (scratchCtx) {
      drawScene(scratchCtx, scene, localTime, width, height, images, characters, settings, { drawCaptions: inCaptions });
      ctx.save();
      if (scene.transition === 'fade') ctx.globalAlpha = progress;
      if (scene.transition === 'slideLeft') ctx.translate(width * (1 - progress), 0);
      if (scene.transition === 'slideUp') ctx.translate(0, height * (1 - progress));
      if (scene.transition === 'wipe') {
        ctx.beginPath();
        ctx.rect(0, 0, width * progress, height);
        ctx.clip();
      }
      if (scene.transition === 'zoom') {
        ctx.globalAlpha = progress;
        const scale = 1 + (1 - progress) * 0.14;
        ctx.translate(width / 2, height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-width / 2, -height / 2);
      }
      ctx.drawImage(scratch, 0, 0);
      ctx.restore();
    }
  } else {
    drawScene(ctx, scene, localTime, width, height, images, characters, settings, {
      drawCaptions: captionsEnabled,
    });
  }

  if (input.showGuides) {
    drawGuides(ctx, width, height);
  }

  ctx.restore();
}

function drawGuides(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,84,112,0.45)';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 10]);
  const insetX = width * 0.06;
  const insetY = height * 0.08;
  ctx.strokeRect(insetX, insetY, width - insetX * 2, height - insetY * 2);
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(width * 0.5, 0);
  ctx.lineTo(width * 0.5, height);
  ctx.moveTo(0, height * 0.735);
  ctx.lineTo(width, height * 0.735);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `600 ${Math.round(width * 0.02)}px ${FONT_STACK}`;
  ctx.fillText('safe area · caption baseline', width * 0.07, height * 0.08 - 12);
  ctx.restore();
}

function drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = '#0b0b0d';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `600 ${Math.round(width * 0.032)}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.fillText('No scenes yet', width / 2, height / 2 - 12);
  ctx.fillStyle = GRAY;
  ctx.font = `500 ${Math.round(width * 0.024)}px ${FONT_STACK}`;
  ctx.fillText('Add a scene in Storyboard Studio to see it here.', width / 2, height / 2 + 34);
}
