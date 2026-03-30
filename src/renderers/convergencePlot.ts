import type { PlotSample, PlotSink } from '../types';

const CHART_PADDING = { top: 28, right: 18, bottom: 34, left: 44 };

export class ConvergencePlotRenderer implements PlotSink {
  private readonly canvas: HTMLCanvasElement;

  private readonly context: CanvasRenderingContext2D;

  private readonly resizeObserver: ResizeObserver;

  private lastSamples: PlotSample[] = [];

  private lastLiveSample: PlotSample | null = null;

  private scale = 1;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('2D canvas context is required for the convergence plot.');
    }

    this.canvas = canvas;
    this.context = context;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.resize();
  }

  render(samples: PlotSample[], liveSample: PlotSample | null): void {
    this.lastSamples = samples;
    this.lastLiveSample = liveSample;
    this.draw();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || this.canvas.clientWidth || 320));
    const height = Math.max(240, Math.floor(rect.height || this.canvas.clientHeight || 240));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    this.scale = pixelRatio;
    this.canvas.width = Math.floor(width * pixelRatio);
    this.canvas.height = Math.floor(height * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.draw();
  }

  dispose(): void {
    this.resizeObserver.disconnect();
  }

  private draw(): void {
    const width = this.canvas.width / this.scale;
    const height = this.canvas.height / this.scale;
    const ctx = this.context;
    const liveSample =
      this.lastLiveSample &&
      (this.lastSamples.length === 0 ||
        this.lastLiveSample.throwCount !==
          this.lastSamples[this.lastSamples.length - 1].throwCount)
        ? this.lastLiveSample
        : null;
    const data = liveSample ? [...this.lastSamples, liveSample] : this.lastSamples;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(7, 13, 23, 0.86)';
    ctx.fillRect(0, 0, width, height);

    const innerWidth = width - CHART_PADDING.left - CHART_PADDING.right;
    const innerHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;
    const baselinePi = Math.PI;

    ctx.strokeStyle = 'rgba(145, 167, 192, 0.16)';
    ctx.lineWidth = 1;
    for (let index = 0; index <= 4; index += 1) {
      const y = CHART_PADDING.top + (innerHeight / 4) * index;
      ctx.beginPath();
      ctx.moveTo(CHART_PADDING.left, y);
      ctx.lineTo(width - CHART_PADDING.right, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(145, 167, 192, 0.3)';
    ctx.beginPath();
    ctx.moveTo(CHART_PADDING.left, height - CHART_PADDING.bottom);
    ctx.lineTo(width - CHART_PADDING.right, height - CHART_PADDING.bottom);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = '#93a8c1';
    ctx.font = '12px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText('throws N', width - 76, height - 10);
    ctx.translate(14, height / 2 + 18);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('estimated π', 0, 0);
    ctx.restore();

    if (data.length === 0) {
      ctx.fillStyle = '#c5d0dc';
      ctx.font = '15px "Iowan Old Style", "Palatino Linotype", serif';
      ctx.fillText(
        'Start dropping needles to trace the estimate of π.',
        CHART_PADDING.left,
        CHART_PADDING.top + 24,
      );
      return;
    }

    const xMax = Math.max(10, data[data.length - 1].throwCount);
    const minPi = Math.min(...data.map((sample) => sample.piEstimate), baselinePi);
    const maxPi = Math.max(...data.map((sample) => sample.piEstimate), baselinePi);
    const padding = Math.max(0.08, (maxPi - minPi) * 0.15);
    const yMin = minPi - padding;
    const yMax = maxPi + padding;

    const mapX = (value: number): number =>
      CHART_PADDING.left + (value / xMax) * innerWidth;
    const mapY = (value: number): number =>
      CHART_PADDING.top + ((yMax - value) / (yMax - yMin || 1)) * innerHeight;

    ctx.strokeStyle = 'rgba(244, 179, 95, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(CHART_PADDING.left, mapY(baselinePi));
    ctx.lineTo(width - CHART_PADDING.right, mapY(baselinePi));
    ctx.stroke();

    ctx.fillStyle = '#f4b35f';
    ctx.font = '12px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText('π', width - CHART_PADDING.right - 10, mapY(baselinePi) - 8);

    ctx.strokeStyle = '#82f0d2';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    data.forEach((sample, index) => {
      const x = mapX(sample.throwCount);
      const y = mapY(sample.piEstimate);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    const lastSample = data[data.length - 1];
    ctx.fillStyle = '#82f0d2';
    ctx.beginPath();
    ctx.arc(mapX(lastSample.throwCount), mapY(lastSample.piEstimate), 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#c5d0dc';
    ctx.font = '12px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText('0', CHART_PADDING.left - 6, height - CHART_PADDING.bottom + 18);
    ctx.fillText(
      `${xMax.toLocaleString('en-US')}`,
      width - CHART_PADDING.right - 36,
      height - CHART_PADDING.bottom + 18,
    );
    ctx.fillText(yMax.toFixed(2), 8, CHART_PADDING.top + 4);
    ctx.fillText(yMin.toFixed(2), 8, height - CHART_PADDING.bottom);
  }
}
