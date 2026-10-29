import type { Expression, MouthPose, Pose } from '../types';

/**
 * Marlowe, drawn procedurally on a 2D canvas.
 *
 * Local coordinate space: feet at (0, 0), y grows downward, character height
 * ~1000 units. The caller positions and scales; this module only knows anatomy.
 *
 * Everything is black, white and grayscale except the tie, which carries the
 * single coral accent allowed per shot.
 */

export const INK = '#0e0e10';
export const INK_SOFT = '#26262c';
export const INK_MID = '#3a3a42';
export const WHITE = '#fbfbfc';
export const GRAY = '#8a8a92';
export const GRAY_LIGHT = '#d9d9de';
export const CORAL = '#ff5470';

export interface MascotDrawOptions {
  pose: Pose;
  expression: Expression;
  mouth: MouthPose;
  blink: number;
  cigarette: boolean;
  accent?: string;
}

type HandShape = 'relaxed' | 'open' | 'point' | 'fist';

interface ArmPose {
  elbow: [number, number];
  hand: [number, number];
  handShape: HandShape;
}

interface PoseParams {
  lean: number;
  headTilt: number;
  headShift: number;
  eyeShift: number;
  sit: boolean;
  stride: number;
  armL: ArmPose;
  armR: ArmPose;
  browLift: number;
  browAngle: number;
  mouthCurve: number;
}

const NEUTRAL_ARM_L: ArmPose = { elbow: [-196, -560], hand: [-206, -432], handShape: 'relaxed' };
const NEUTRAL_ARM_R: ArmPose = { elbow: [196, -560], hand: [206, -432], handShape: 'relaxed' };

function poseParams(pose: Pose): PoseParams {
  const base: PoseParams = {
    lean: 0,
    headTilt: 0,
    headShift: 0,
    eyeShift: 0,
    sit: false,
    stride: 0,
    armL: NEUTRAL_ARM_L,
    armR: NEUTRAL_ARM_R,
    browLift: 0,
    browAngle: 0,
    mouthCurve: 0,
  };

  switch (pose) {
    case 'talking':
      return {
        ...base,
        armR: { elbow: [210, -574], hand: [258, -628], handShape: 'open' },
        browLift: 2,
      };
    case 'thinking':
      return {
        ...base,
        headTilt: -7,
        headShift: 6,
        eyeShift: 6,
        armR: { elbow: [168, -556], hand: [58, -812], handShape: 'relaxed' },
        armL: { elbow: [-176, -548], hand: [-150, -462], handShape: 'relaxed' },
        browLift: 4,
        browAngle: -6,
      };
    case 'sideways':
      return {
        ...base,
        headTilt: -3,
        headShift: 10,
        eyeShift: 14,
        armL: { elbow: [-198, -556], hand: [-214, -430], handShape: 'relaxed' },
        browLift: 2,
      };
    case 'smirk':
      return {
        ...base,
        headTilt: 5,
        headShift: 3,
        eyeShift: 4,
        browLift: 6,
        browAngle: 5,
        mouthCurve: 6,
        armR: { elbow: [198, -566], hand: [214, -444], handShape: 'relaxed' },
      };
    case 'surprised':
      return {
        ...base,
        headTilt: 0,
        lean: -3,
        armL: { elbow: [-236, -600], hand: [-300, -520], handShape: 'open' },
        armR: { elbow: [236, -600], hand: [300, -520], handShape: 'open' },
        browLift: 16,
        browAngle: -4,
      };
    case 'disappointed':
      return {
        ...base,
        lean: 2,
        headTilt: 8,
        headShift: 0,
        eyeShift: -4,
        armL: { elbow: [-186, -548], hand: [-190, -408], handShape: 'relaxed' },
        armR: { elbow: [186, -548], hand: [190, -408], handShape: 'relaxed' },
        browLift: -5,
        browAngle: -10,
        mouthCurve: -5,
      };
    case 'pointing':
      return {
        ...base,
        lean: -2,
        headTilt: -2,
        armR: { elbow: [238, -596], hand: [412, -648], handShape: 'point' },
        armL: { elbow: [-190, -556], hand: [-196, -436], handShape: 'relaxed' },
        browLift: 3,
      };
    case 'openhand':
      return {
        ...base,
        armR: { elbow: [232, -572], hand: [322, -508], handShape: 'open' },
        armL: { elbow: [-188, -552], hand: [-198, -432], handShape: 'relaxed' },
        browLift: 2,
      };
    case 'adjustSuit':
      return {
        ...base,
        headTilt: 4,
        armR: { elbow: [176, -560], hand: [56, -678], handShape: 'fist' },
        armL: { elbow: [-188, -552], hand: [-196, -434], handShape: 'relaxed' },
        browLift: 4,
        browAngle: 3,
        mouthCurve: 4,
      };
    case 'walking':
      return {
        ...base,
        lean: 4,
        stride: 1,
        armL: { elbow: [-206, -556], hand: [-262, -470], handShape: 'relaxed' },
        armR: { elbow: [204, -566], hand: [148, -476], handShape: 'relaxed' },
      };
    case 'sitting':
      return {
        ...base,
        sit: true,
        lean: 2,
        armL: { elbow: [-196, -392], hand: [-206, -296], handShape: 'relaxed' },
        armR: { elbow: [196, -392], hand: [206, -296], handShape: 'relaxed' },
      };
    case 'directGaze':
      return {
        ...base,
        headTilt: 0,
        headShift: 0,
        eyeShift: 0,
        browLift: 2,
        armL: { elbow: [-198, -558], hand: [-208, -436], handShape: 'relaxed' },
        armR: { elbow: [198, -558], hand: [208, -436], handShape: 'relaxed' },
      };
    default:
      return base;
  }
}

function expressionParams(expression: Expression): { browLift: number; browAngle: number; lid: number; mouthCurve: number } {
  switch (expression) {
    case 'confident':
      return { browLift: 2, browAngle: 0, lid: 0.18, mouthCurve: 1 };
    case 'smirk':
      return { browLift: 7, browAngle: 6, lid: 0.22, mouthCurve: 7 };
    case 'surprised':
      return { browLift: 18, browAngle: -3, lid: 0, mouthCurve: 0 };
    case 'disappointed':
      return { browLift: -6, browAngle: -12, lid: 0.4, mouthCurve: -6 };
    case 'thinking':
      return { browLift: 4, browAngle: -8, lid: 0.3, mouthCurve: -1 };
    case 'alert':
      return { browLift: 10, browAngle: -2, lid: 0, mouthCurve: 0 };
    default:
      return { browLift: 0, browAngle: 0, lid: 0.12, mouthCurve: 0 };
  }
}

function strokeCapsule(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  width: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
  ctx.stroke();
}

function drawShadow(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(6, 0, 168, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLegs(ctx: CanvasRenderingContext2D, params: PoseParams): void {
  const trouser = INK;
  if (params.sit) {
    // Seated: hips low, thighs foreshortened, shins near vertical.
    strokeCapsule(ctx, [-58, -300], [-96, -238], 80, trouser);
    strokeCapsule(ctx, [-96, -238], [-104, -36], 74, trouser);
    strokeCapsule(ctx, [58, -300], [96, -238], 80, trouser);
    strokeCapsule(ctx, [96, -238], [104, -36], 74, trouser);
    ctx.fillStyle = INK;
    for (const x of [-104, 104]) {
      ctx.beginPath();
      ctx.ellipse(x + 14, -20, 54, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  const stride = params.stride;
  const leftAnkleX = -58 - stride * 46;
  const rightAnkleX = 60 + stride * 46;
  const leftKneeX = -60 - stride * 22;
  const rightKneeX = 62 + stride * 22;

  strokeCapsule(ctx, [-60, -430], [leftKneeX, -228], 82, trouser);
  strokeCapsule(ctx, [leftKneeX, -228], [leftAnkleX, -36], 74, trouser);
  strokeCapsule(ctx, [60, -430], [rightKneeX, -228], 82, trouser);
  strokeCapsule(ctx, [rightKneeX, -228], [rightAnkleX, -36], 74, trouser);

  ctx.fillStyle = INK;
  for (const [index, x] of [leftAnkleX, rightAnkleX].entries()) {
    ctx.beginPath();
    ctx.ellipse(x + 16, -22, 56, 21, index === 0 ? -0.05 : 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

function jacketPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-152, -716);
  ctx.quadraticCurveTo(-140, -640, -118, -560);
  ctx.lineTo(-104, -430);
  ctx.lineTo(104, -430);
  ctx.lineTo(118, -560);
  ctx.quadraticCurveTo(140, -640, 152, -716);
  ctx.closePath();
}

function drawTorso(ctx: CanvasRenderingContext2D, accent: string): void {
  // Neck
  ctx.fillStyle = INK;
  ctx.fillRect(-28, -786, 56, 78);

  // Jacket
  jacketPath(ctx);
  ctx.fillStyle = INK;
  ctx.fill();

  // Shirt triangle
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(-44, -722);
  ctx.lineTo(44, -722);
  ctx.lineTo(0, -616);
  ctx.closePath();
  ctx.fill();

  // Lapels
  ctx.fillStyle = INK_SOFT;
  ctx.beginPath();
  ctx.moveTo(-58, -730);
  ctx.lineTo(-4, -640);
  ctx.lineTo(-26, -604);
  ctx.lineTo(-104, -700);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(58, -730);
  ctx.lineTo(4, -640);
  ctx.lineTo(26, -604);
  ctx.lineTo(104, -700);
  ctx.closePath();
  ctx.fill();

  // Coral tie — the one accent in frame.
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(-16, -704);
  ctx.lineTo(16, -704);
  ctx.lineTo(10, -640);
  ctx.lineTo(0, -612);
  ctx.lineTo(-10, -640);
  ctx.closePath();
  ctx.fill();

  // Shirt collar
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-44, -726);
  ctx.lineTo(-18, -704);
  ctx.moveTo(44, -726);
  ctx.lineTo(18, -704);
  ctx.stroke();

  // Shoulder seam
  ctx.strokeStyle = INK_MID;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-150, -712);
  ctx.quadraticCurveTo(0, -684, 150, -712);
  ctx.stroke();
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  skin: string,
  side: 1 | -1,
  arm: ArmPose,
  shoulderY: number,
): void {
  const shoulder: [number, number] = [side * 146, shoulderY];
  const elbow: [number, number] = [side * arm.elbow[0], arm.elbow[1]];
  const hand: [number, number] = [side * arm.hand[0], arm.hand[1]];

  ctx.strokeStyle = INK;
  ctx.lineWidth = 58;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(shoulder[0], shoulder[1]);
  ctx.quadraticCurveTo(
    shoulder[0] + side * Math.abs(elbow[0] - shoulder[0]) * 0.45,
    shoulder[1] + (elbow[1] - shoulder[1]) * 0.6,
    elbow[0],
    elbow[1],
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(elbow[0], elbow[1]);
  ctx.quadraticCurveTo(elbow[0] + (hand[0] - elbow[0]) * 0.4, elbow[1] + (hand[1] - elbow[1]) * 0.55, hand[0], hand[1]);
  ctx.stroke();

  // Hand
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(hand[0], hand[1], 30, 0, Math.PI * 2);
  ctx.fill();

  const dirX = hand[0] - elbow[0];
  const dirY = hand[1] - elbow[1];
  const length = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / length;
  const ny = dirY / length;

  if (arm.handShape === 'point') {
    strokeCapsule(ctx, [hand[0], hand[1]], [hand[0] + nx * 76, hand[1] + ny * 76], 20, skin);
  } else if (arm.handShape === 'open') {
    for (const spread of [-0.34, 0, 0.34]) {
      const angle = Math.atan2(ny, nx) + spread;
      strokeCapsule(
        ctx,
        [hand[0], hand[1]],
        [hand[0] + Math.cos(angle) * 54, hand[1] + Math.sin(angle) * 54],
        15,
        skin,
      );
    }
  } else if (arm.handShape === 'fist') {
    ctx.strokeStyle = INK_MID;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(hand[0], hand[1], 16, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  // Cuff
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 6;
  const cx = hand[0] - nx * 30;
  const cy = hand[1] - ny * 30;
  ctx.beginPath();
  ctx.moveTo(cx - ny * 22, cy + nx * 22);
  ctx.lineTo(cx + ny * 22, cy - nx * 22);
  ctx.stroke();
}

function drawEar(ctx: CanvasRenderingContext2D, side: 1 | -1): void {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(side * 58, -924);
  ctx.lineTo(side * 108, -1032);
  ctx.lineTo(side * 116, -930);
  ctx.quadraticCurveTo(side * 106, -898, side * 66, -898);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK_MID;
  ctx.beginPath();
  ctx.moveTo(side * 76, -930);
  ctx.lineTo(side * 100, -996);
  ctx.lineTo(side * 100, -932);
  ctx.closePath();
  ctx.fill();
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  params: PoseParams,
  expression: Expression,
  mouth: MouthPose,
  blink: number,
  accent: string,
  cigarette: boolean,
): void {
  ctx.save();
  ctx.translate(0, -860);
  ctx.rotate((params.headTilt * Math.PI) / 180);
  ctx.translate(params.headShift, 0);
  ctx.translate(0, 860);

  drawEar(ctx, -1);
  drawEar(ctx, 1);

  // Skull
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, -866, 92, 100, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cheek / muzzle
  ctx.fillStyle = INK_SOFT;
  ctx.beginPath();
  ctx.ellipse(24, -822, 74, 48, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(24, -822, 74, 48, -0.12, 0, Math.PI * 2);
  ctx.stroke();

  // Nose
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(58, -846, 17, 13, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.arc(53, -851, 4, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  const expr = expressionParams(expression);
  const lid = Math.min(0.85, Math.max(0, expr.lid + (params.sit ? 0.08 : 0)));
  const eyeY = -884;
  for (const side of [-1, 1] as const) {
    const ex = side * 34 + params.eyeShift * 0.6 + 4;
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 22, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 22, 16, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Pupil
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + params.eyeShift * 0.5, eyeY + 2, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // Heavy upper lid (character-defining)
    const lidClose = Math.max(lid, blink);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.rect(ex - 24, eyeY - 18, 48, 36 * lidClose);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(ex - 23, eyeY - 14 + 26 * lidClose);
    ctx.quadraticCurveTo(ex, eyeY - 22 + 26 * lidClose, ex + 23, eyeY - 14 + 26 * lidClose);
    ctx.stroke();
  }

  // Brows
  const browLift = expr.browLift + params.browLift;
  const browAngle = expr.browAngle + params.browAngle;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  for (const side of [-1, 1] as const) {
    const bx = side * 34 + params.eyeShift * 0.5;
    const by = -920 - browLift;
    const tilt = (browAngle * Math.PI) / 180 * side;
    ctx.beginPath();
    ctx.moveTo(bx - side * 22, by + Math.sin(tilt) * 10);
    ctx.quadraticCurveTo(bx, by - 6, bx + side * 24, by - Math.sin(tilt) * 10);
    ctx.stroke();
  }

  // Mouth
  const mouthX = 40;
  const mouthY = -804;
  const curve = expr.mouthCurve + params.mouthCurve;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  switch (mouth) {
    case 'open':
    case 'wide':
    case 'rounded': {
      const size = mouth === 'open' ? 1 : mouth === 'wide' ? 1.25 : 0.8;
      ctx.fillStyle = '#0a0a0c';
      ctx.beginPath();
      ctx.ellipse(mouthX, mouthY, 24 * size, 16 * size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.ellipse(mouthX, mouthY - 9 * size, 20 * size, 5.5 * size, 0, 0, Math.PI);
      ctx.fill();
      break;
    }
    case 'teeth': {
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.ellipse(mouthX, mouthY - 2, 22, 10, 0, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mouthX - 22, mouthY - 2);
      ctx.lineTo(mouthX + 22, mouthY - 2);
      ctx.stroke();
      break;
    }
    case 'rest': {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(mouthX, mouthY - 4, 17, 8, 0, 0, Math.PI);
      ctx.stroke();
      break;
    }
    default: {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(mouthX - 24, mouthY);
      ctx.quadraticCurveTo(mouthX, mouthY + curve, mouthX + 24, mouthY - 2);
      ctx.stroke();
      // Faint smile crease
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mouthX + 26, mouthY - 8);
      ctx.lineTo(mouthX + 34, mouthY - 16);
      ctx.stroke();
    }
  }

  if (cigarette) {
    // Optional accessory. Kept as part of the head layer so it tracks the mouth.
    ctx.save();
    ctx.translate(mouthX + 14, mouthY - 6);
    ctx.rotate(-0.18);
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, -6, 96, 12);
    ctx.fillStyle = GRAY_LIGHT;
    ctx.fillRect(78, -6, 18, 12);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(98, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

export function drawMascot(ctx: CanvasRenderingContext2D, options: MascotDrawOptions): void {
  const accent = options.accent ?? CORAL;
  const params = poseParams(options.pose);
  const skin = INK_MID;
  const shoulderY = params.sit ? -592 : -708;

  ctx.save();
  drawShadow(ctx);

  ctx.save();
  const bodyOffsetY = params.sit ? 130 : 0;
  ctx.translate(0, bodyOffsetY);
  ctx.rotate((params.lean * Math.PI) / 180);

  drawLegs(ctx, params);
  drawTorso(ctx, accent);
  drawArm(ctx, skin, -1, params.armL, shoulderY);
  drawArm(ctx, skin, 1, params.armR, shoulderY);
  drawHead(
    ctx,
    params,
    options.expression,
    options.mouth,
    Math.max(0, Math.min(1, options.blink)),
    accent,
    options.cigarette,
  );
  ctx.restore();
  ctx.restore();
}

/** Bounding box of the drawn character in local units, for hit-testing/HUD. */
export const MASCOT_BOUNDS = { width: 460, height: 1040, originY: 0, top: -1040 };
