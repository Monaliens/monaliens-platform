import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useTheme } from '../../../context/ThemeContext';
import { RISK_LEVELS } from '../utils/constants';
import { playSound, initAudioManager } from '../utils/audioManager';
import toast from 'react-hot-toast';

const BoardContainer = styled.div`
  width: 100%;
  max-width: 860px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  overflow: hidden;

  canvas {
    width: 100% !important;
    height: auto !important;
  }

  @media (max-width: 900px) {
    max-width: 100%;
    border-radius: 0;
    border-left: none;
    border-right: none;
    overflow: visible;
  }
`;

// Game constants
const WIDTH = 700;
const HEIGHT = 520;
const PIN_RADIUS = 5;
const BALL_RADIUS = 9;
const BUCKET_HEIGHT = 30;
const SIDE_PADDING = 20;
const TOP_PADDING = 50;
const FRAME_STEP_LIMIT = 1 / 30;
const FIXED_STEP = 1 / 120;
const GRAVITY = 1450;
const AIR_DRAG = 0.993;
const MIN_DROP_VY = 95;
const MAX_DROP_VY = 620;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (from, to, t) => from + (to - from) * t;
const easeInQuad = t => t * t;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

const getBucketColor = mult => {
  if (mult >= 100) return { bgColor: '#ff003f', shadowColor: '#a60004' };
  if (mult >= 25) return { bgColor: '#ff1837', shadowColor: '#a70f04' };
  if (mult >= 10) return { bgColor: '#ff302f', shadowColor: '#a71e03' };
  if (mult >= 5) return { bgColor: '#ff4827', shadowColor: '#a82d03' };
  if (mult >= 3) return { bgColor: '#ff6020', shadowColor: '#a93d02' };
  if (mult >= 1.5) return { bgColor: '#ff7818', shadowColor: '#a94c02' };
  if (mult >= 1) return { bgColor: '#ff9010', shadowColor: '#aa5b01' };
  if (mult >= 0.5) return { bgColor: '#ffa808', shadowColor: '#aa6a01' };
  return { bgColor: '#ffc000', shadowColor: '#ab7900' };
};

class PlinkoGame {
  constructor(canvas, isDarkMode) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    this.isDarkMode = isDarkMode;
    this.balls = [];
    this.pins = [];
    this.multipliers = [];
    this.rows = 10;
    this.running = false;
    this.animationFrameId = null;
    this.lastFrameTime = null;
    this.elapsedTime = 0;
    this.configKey = '';
    this.onComplete = null;
    this.winningBuckets = new Set();

    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = WIDTH + 'px';
    canvas.style.height = HEIGHT + 'px';
    this.ctx.scale(dpr, dpr);
    this.dpr = dpr;
  }

  destroy() {
    this.stop();
    this.balls = [];
    this.pins = [];
    this.winningBuckets.clear();
  }

  setConfig(rows, multipliers, onComplete) {
    this.onComplete = onComplete;

    const nextRows = Number(rows) || 10;
    const nextMultipliers = Array.isArray(multipliers) ? multipliers : [];
    const nextKey = `${nextRows}:${nextMultipliers.join(',')}`;

    if (this.configKey === nextKey) return;

    this.rows = nextRows;
    this.multipliers = nextMultipliers;
    this.configKey = nextKey;
    this.calculatePins();
  }

  setTheme(isDarkMode) {
    this.isDarkMode = isDarkMode;
  }

  calculatePins() {
    this.pins = [];
    const bucketCount = this.rows + 1;
    this.bucketWidth = (WIDTH - SIDE_PADDING * 2) / bucketCount;
    this.pinSpacing = this.bucketWidth;
    this.bucketsY = HEIGHT - BUCKET_HEIGHT - 5;
    this.rowSpacing = (HEIGHT - TOP_PADDING - BUCKET_HEIGHT - 30) / this.rows;

    for (let row = 0; row < this.rows; row++) {
      const pinsInRow = row + 3;
      const rowWidth = (pinsInRow - 1) * this.pinSpacing;
      const startX = (WIDTH - rowWidth) / 2;
      const y = TOP_PADDING + row * this.rowSpacing;

      for (let col = 0; col < pinsInRow; col++) {
        this.pins.push({
          x: startX + col * this.pinSpacing,
          y,
          row,
          col,
          flash: 0
        });
      }
    }
  }

  getPathBit(path, row) {
    const numericPath = Number(path || 0);
    return Math.floor(numericPath / (2 ** row)) % 2;
  }

  getBucketCenter(bucketIndex) {
    return SIDE_PADDING + bucketIndex * this.bucketWidth + this.bucketWidth / 2;
  }

  getTargetPinX(row, rightsBeforeRow) {
    return WIDTH / 2 + (2 * rightsBeforeRow - row) * (this.pinSpacing / 2);
  }

  normalizeBucketIndex(bucketIndex) {
    const parsed = Number(bucketIndex);
    if (!Number.isFinite(parsed)) return 0;
    return clamp(Math.round(parsed), 0, this.rows);
  }

  dropBall(gameResult) {
    this._dropBallNow(gameResult);
  }

  _dropBallNow(gameResult) {
    const { path, bucketIndex, gameId } = gameResult;
    const startX = WIDTH / 2 + (Math.random() - 0.5) * 7;
    const ball = {
      x: startX,
      y: -BALL_RADIUS * 1.4,
      previousX: startX,
      previousY: -BALL_RADIUS * 1.4,
      vx: (Math.random() - 0.5) * 35,
      vy: 175,
      angle: 0,
      angularVelocity: 0,
      path,
      bucketIndex: this.normalizeBucketIndex(bucketIndex),
      gameResult,
      gameId,
      nextRow: 0,
      rightsBeforeRow: 0,
      age: 0,
      done: false,
      sinking: false,
      sinkProgress: 0,
      hitPins: new Set(),
      lastPinSoundAt: -1
    };

    this.balls.push(ball);
    playSound('bet', { volume: 0.4 });

    if (!this.running) {
      this.start();
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = null;
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastFrameTime = null;
  }

  loop = timestamp => {
    if (!this.running) return;

    const deltaTime = this.lastFrameTime
      ? Math.min((timestamp - this.lastFrameTime) / 1000, FRAME_STEP_LIMIT)
      : 1 / 60;

    this.lastFrameTime = timestamp;
    this.elapsedTime += deltaTime;
    this.update(deltaTime);
    this.draw();

    if (this.balls.length > 0 || this.winningBuckets.size > 0) {
      this.animationFrameId = requestAnimationFrame(this.loop);
    } else {
      this.running = false;
      this.animationFrameId = null;
      this.lastFrameTime = null;
    }
  }

  update(deltaTime) {
    for (const pin of this.pins) {
      pin.flash = Math.max(0, pin.flash - deltaTime * 7);
    }

    let remaining = deltaTime;
    while (remaining > 0) {
      const step = Math.min(remaining, FIXED_STEP);
      this.stepPhysics(step);
      remaining -= step;
    }

    this.updateSinkingBalls(deltaTime);
  }

  stepPhysics(deltaTime) {
    for (const ball of this.balls) {
      if (ball.sinking || ball.done) continue;

      ball.age += deltaTime;
      ball.previousX = ball.x;
      ball.previousY = ball.y;

      this.applyPathGuidance(ball, deltaTime);

      ball.vy += GRAVITY * deltaTime;
      ball.vx *= AIR_DRAG;
      ball.vy = clamp(ball.vy, MIN_DROP_VY, MAX_DROP_VY);

      ball.x += ball.vx * deltaTime;
      ball.y += ball.vy * deltaTime;

      this.resolveWallCollision(ball);
      this.resolvePinCollisions(ball);

      ball.angle += (ball.vx / BALL_RADIUS) * deltaTime;

      if (ball.y >= this.bucketsY - BALL_RADIUS * 0.2 || ball.age > 7.5) {
        this.completeBall(ball);
      }
    }
  }

  updateSinkingBalls(deltaTime) {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      if (!ball.sinking) continue;

      ball.sinkProgress += deltaTime / 0.34;
      const t = Math.min(ball.sinkProgress, 1);
      ball.x = lerp(ball.sinkStartX, ball.sinkTargetX, easeOutCubic(t));
      ball.y = lerp(ball.sinkStartY, this.bucketsY + BUCKET_HEIGHT * 0.55, easeInQuad(t));
      ball.angle += 7 * deltaTime;

      if (t >= 1) {
        ball.removed = true;
        this.balls.splice(i, 1);
        this.winningBuckets.delete(ball.bucketIndex);
        if (this.onComplete) this.onComplete(ball.gameId);
      }
    }
  }

  advanceRows(ball) {
    while (ball.nextRow < this.rows) {
      const rowY = TOP_PADDING + ball.nextRow * this.rowSpacing;
      if (ball.y <= rowY + this.rowSpacing * 0.24) break;

      if (this.getPathBit(ball.path, ball.nextRow) === 1) {
        ball.rightsBeforeRow += 1;
      }

      ball.nextRow += 1;
    }
  }

  applyPathGuidance(ball) {
    this.advanceRows(ball);

    if (ball.nextRow < this.rows) {
      const rowY = TOP_PADDING + ball.nextRow * this.rowSpacing;
      const approachStart = rowY - this.rowSpacing * 0.78;
      const approachEnd = rowY + this.rowSpacing * 0.16;

      if (ball.y >= approachStart && ball.y <= approachEnd) {
        const side = this.getPathBit(ball.path, ball.nextRow) === 1 ? 1 : -1;
        const pinX = this.getTargetPinX(ball.nextRow, ball.rightsBeforeRow);
        const targetX = pinX + side * (PIN_RADIUS + BALL_RADIUS) * 0.68;
        const influence = clamp((ball.y - approachStart) / (approachEnd - approachStart), 0, 1);
        const desiredVx = clamp((targetX - ball.x) * 7.8 + side * 52, -280, 280);

        ball.vx = lerp(ball.vx, desiredVx, 0.06 + influence * 0.07);
        ball.vy = Math.max(ball.vy, 115);
      }

      return;
    }

    const bucketCenter = this.getBucketCenter(ball.bucketIndex);
    const nearBuckets = ball.y > this.bucketsY - this.rowSpacing * 1.15;
    const desiredVx = clamp((bucketCenter - ball.x) * (nearBuckets ? 6.8 : 4.2), -360, 360);

    ball.vx = lerp(ball.vx, desiredVx, nearBuckets ? 0.09 : 0.045);
    ball.vy = Math.max(ball.vy, nearBuckets ? 155 : 120);
  }

  resolveWallCollision(ball) {
    const minX = SIDE_PADDING + BALL_RADIUS;
    const maxX = WIDTH - SIDE_PADDING - BALL_RADIUS;

    if (ball.x < minX) {
      ball.x = minX;
      ball.vx = Math.abs(ball.vx) * 0.45;
      ball.vy = Math.max(ball.vy, 135);
    } else if (ball.x > maxX) {
      ball.x = maxX;
      ball.vx = -Math.abs(ball.vx) * 0.45;
      ball.vy = Math.max(ball.vy, 135);
    }
  }

  resolvePinCollisions(ball) {
    const minDistance = BALL_RADIUS + PIN_RADIUS;
    const minDistanceSq = minDistance * minDistance;

    for (const pin of this.pins) {
      if (Math.abs(ball.y - pin.y) > minDistance + 5 || Math.abs(ball.x - pin.x) > minDistance + 5) {
        continue;
      }

      const dx = ball.x - pin.x;
      const dy = ball.y - pin.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq <= 0.0001 || distanceSq >= minDistanceSq) continue;

      const distance = Math.sqrt(distanceSq);
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = minDistance - distance;
      const key = `${pin.row}:${pin.col}`;
      const desiredSide = this.getPathBit(ball.path, clamp(pin.row, 0, this.rows - 1)) === 1 ? 1 : -1;
      const physicalSide = ball.x >= pin.x ? 1 : -1;
      const side = Math.abs(pin.row - ball.nextRow) <= 1 ? desiredSide : physicalSide;

      ball.x += nx * overlap * 0.98;
      ball.y += ny * overlap * (ny < 0 ? 0.24 : 0.7);

      if (!ball.hitPins.has(key)) {
        ball.hitPins.add(key);
        pin.flash = 1;

        if (this.elapsedTime - ball.lastPinSoundAt > 0.045) {
          ball.lastPinSoundAt = this.elapsedTime;
          playSound('pin', { volume: 0.15 });
        }

        const releaseVx = side * clamp(Math.abs(ball.vx) * 0.45 + 142, 135, 340);
        const releaseVy = clamp(ball.vy * 0.54 + 172, 190, MAX_DROP_VY);

        ball.vx = lerp(ball.vx, releaseVx, 0.72);
        ball.vy = Math.max(lerp(ball.vy, releaseVy, 0.68), 185);
        ball.angularVelocity = ball.vx / BALL_RADIUS;
      } else {
        ball.vx += side * 18;
        ball.vy = Math.max(ball.vy, 155);
      }
    }
  }

  completeBall(ball) {
    if (ball.done) return;

    const bucketCenter = this.getBucketCenter(ball.bucketIndex);
    ball.done = true;
    ball.sinking = true;
    ball.sinkProgress = 0;
    ball.sinkStartX = lerp(ball.x, bucketCenter, 0.58);
    ball.sinkStartY = Math.min(ball.y, this.bucketsY - BALL_RADIUS * 0.12);
    ball.sinkTargetX = bucketCenter;
    ball.x = ball.sinkStartX;
    ball.y = ball.sinkStartY;
    ball.vx = 0;
    ball.vy = 0;

    this.winningBuckets.add(ball.bucketIndex);

    const { gameResult } = ball;
    const isWin = gameResult.multiplier >= 1;
    const payoutStr = parseFloat(gameResult.payout).toFixed(4);

    playSound(isWin ? 'win' : 'lose', { volume: 0.5 });

    if (isWin) {
      toast.success(`${gameResult.multiplier}x  +${payoutStr} MON`, { duration: 2000 });
    } else {
      toast.error(`${gameResult.multiplier}x  ${payoutStr} MON`, { duration: 2000 });
    }
  }

  draw() {
    const ctx = this.ctx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.scale(this.dpr, this.dpr);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.filter = 'none';
    ctx.imageSmoothingEnabled = true;

    ctx.fillStyle = this.isDarkMode ? '#1a1a2e' : '#f8fafc';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.drawPins(ctx);
    this.drawBuckets(ctx);
    this.drawBalls(ctx);
  }

  drawPins(ctx) {
    for (const pin of this.pins) {
      const flash = pin.flash;
      const radius = PIN_RADIUS + flash * 1.8;

      if (flash > 0) {
        ctx.shadowColor = this.isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(90, 90, 90, 0.35)';
        ctx.shadowBlur = 9 * flash;
      }

      ctx.beginPath();
      ctx.arc(pin.x, pin.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = this.isDarkMode ? '#ffffff' : '#666666';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    }
  }

  drawBuckets(ctx) {
    for (let i = 0; i < this.multipliers.length; i++) {
      const mult = this.multipliers[i];
      const x = SIDE_PADDING + i * this.bucketWidth + 2;
      const w = this.bucketWidth - 4;
      const h = BUCKET_HEIGHT;
      const isWinning = this.winningBuckets.has(i);
      const { bgColor, shadowColor } = getBucketColor(mult);

      if (isWinning) {
        ctx.shadowColor = bgColor;
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 0;
      }

      ctx.beginPath();
      ctx.roundRect(x, this.bucketsY + 2, w, h, 4);
      ctx.fillStyle = shadowColor;
      ctx.fill();

      ctx.beginPath();
      ctx.roundRect(x, this.bucketsY, w, h - 2, 4);
      ctx.fillStyle = bgColor;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${mult}x`, x + w / 2, this.bucketsY + (h - 2) / 2);
    }
  }

  drawBalls(ctx) {
    for (const ball of this.balls) {
      if (ball.removed) continue;

      const sinkT = ball.sinking ? Math.min(ball.sinkProgress, 1) : 0;
      const radius = BALL_RADIUS * (1 - sinkT * 0.75);
      const alpha = 1 - sinkT;

      if (radius <= 0 || alpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.angle || 0);

      const gradient = ctx.createRadialGradient(
        -radius * 0.35,
        -radius * 0.45,
        radius * 0.1,
        0,
        0,
        radius
      );
      gradient.addColorStop(0, '#ffc1c7');
      gradient.addColorStop(0.28, '#ff2d46');
      gradient.addColorStop(1, '#a9001c');

      ctx.shadowColor = 'rgba(180, 0, 30, 0.4)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-radius * 0.3, -radius * 0.35, radius * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
      ctx.fill();
      ctx.restore();
    }
  }
}

const PlinkoBoard = ({
  rows = 10,
  multipliers = [],
  activeAnimations = [],
  pendingCount = 0,
  onAnimationComplete,
  selectedRisk = RISK_LEVELS.HIGH
}) => {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const processedRef = useRef(new Set());
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameRef.current) return;

    gameRef.current = new PlinkoGame(canvas, isDarkMode);
    initAudioManager();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.setConfig(rows, multipliers, onAnimationComplete);
      gameRef.current.draw();
    }
  }, [rows, multipliers, onAnimationComplete]);

  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.setTheme(isDarkMode);
      gameRef.current.draw();
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!gameRef.current) return;

    activeAnimations.forEach(result => {
      const id = result.gameId?.toString();
      if (id && !processedRef.current.has(id)) {
        processedRef.current.add(id);
        gameRef.current.dropBall(result);

        if (processedRef.current.size > 100) {
          const arr = Array.from(processedRef.current);
          processedRef.current = new Set(arr.slice(-50));
        }
      }
    });
  }, [activeAnimations]);

  return (
    <BoardContainer>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          borderRadius: '12px',
          imageRendering: 'auto'
        }}
      />
    </BoardContainer>
  );
};

export default PlinkoBoard;
