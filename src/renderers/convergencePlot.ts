import type { PlotSample, PlotSink } from '../types';

const CHART_PADDING = { top: 28, right: 18, bottom: 34, left: 44 };
const COMPACT_CHART_PADDING = { top: 16, right: 14, bottom: 28, left: 44 };

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
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
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
    const width = Math.max(280, Math.floor(rect.width || this.canvas.clientWidth || 280));
    const height = Math.max(150, Math.floor(rect.height || this.canvas.clientHeight || 150));
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
    const isCompact = height < 190;
    const chartPadding = isCompact ? COMPACT_CHART_PADDING : CHART_PADDING;
    const axisFont = `${isCompact ? 11 : 12}px "Avenir Next", "Segoe UI", sans-serif`;
    const emptyStateFont = `${isCompact ? 13 : 15}px "Iowan Old Style", "Palatino Linotype", serif`;
    const yPrecision = isCompact ? 1 : 2;
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

    const innerWidth = width - chartPadding.left - chartPadding.right;
    const innerHeight = height - chartPadding.top - chartPadding.bottom;
    const baselinePi = Math.PI;

    ctx.strokeStyle = 'rgba(145, 167, 192, 0.16)';
    ctx.lineWidth = 1;
    for (let index = 0; index <= 4; index += 1) {
      const y = chartPadding.top + (innerHeight / 4) * index;
      ctx.beginPath();
      ctx.moveTo(chartPadding.left, y);
      ctx.lineTo(width - chartPadding.right, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(145, 167, 192, 0.3)';
    ctx.beginPath();
    ctx.moveTo(chartPadding.left, height - chartPadding.bottom);
    ctx.lineTo(width - chartPadding.right, height - chartPadding.bottom);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = '#93a8c1';
    ctx.font = axisFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('throws N', chartPadding.left + innerWidth / 2, height - chartPadding.bottom + 10);
    if (!isCompact) {
      ctx.translate(14, height / 2 + 18);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('estimated π', 0, 0);
    }
    ctx.restore();

    if (data.length === 0) {
      ctx.fillStyle = '#c5d0dc';
      ctx.font = emptyStateFont;
      ctx.fillText(
        isCompact
          ? 'Start the experiment to trace π.'
          : 'Start dropping needles to trace the estimate of π.',
        chartPadding.left,
        chartPadding.top + (isCompact ? 18 : 24),
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
      chartPadding.left + (value / xMax) * innerWidth;
    const mapY = (value: number): number =>
      chartPadding.top + ((yMax - value) / (yMax - yMin || 1)) * innerHeight;

    ctx.strokeStyle = 'rgba(244, 179, 95, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(chartPadding.left, mapY(baselinePi));
    ctx.lineTo(width - chartPadding.right, mapY(baselinePi));
    ctx.stroke();

    ctx.fillStyle = '#f4b35f';
    ctx.font = axisFont;
    ctx.fillText('π', width - chartPadding.right - 10, mapY(baselinePi) - 8);

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
    const lastSampleX = mapX(lastSample.throwCount);
    const lastSampleY = mapY(lastSample.piEstimate);
    ctx.fillStyle = '#82f0d2';
    ctx.beginPath();
    ctx.arc(lastSampleX, lastSampleY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    const currentEstimateLabel = `n = ${lastSample.piEstimate.toFixed(isCompact ? 3 : 4)}`;
    ctx.font = axisFont;
    const labelWidth = ctx.measureText(currentEstimateLabel).width;
    const labelPaddingX = 8;
    const labelHeight = isCompact ? 20 : 22;
    const preferLeft = lastSampleX + labelWidth + 22 > width - chartPadding.right;
    const labelX = preferLeft
      ? Math.max(chartPadding.left, lastSampleX - labelWidth - labelPaddingX * 2 - 12)
      : Math.min(
          width - chartPadding.right - labelWidth - labelPaddingX * 2,
          lastSampleX + 12,
        );
    const preferBelow = lastSampleY - labelHeight - 10 < chartPadding.top;
    const labelY = preferBelow
      ? Math.min(height - chartPadding.bottom - labelHeight - 8, lastSampleY + 10)
      : Math.max(chartPadding.top + 4, lastSampleY - labelHeight - 10);

    ctx.fillStyle = 'rgba(8, 14, 24, 0.92)';
    ctx.fillRect(labelX, labelY, labelWidth + labelPaddingX * 2, labelHeight);
    ctx.strokeStyle = 'rgba(130, 240, 210, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(labelX, labelY, labelWidth + labelPaddingX * 2, labelHeight);
    ctx.fillStyle = '#d7f8ef';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      currentEstimateLabel,
      labelX + labelPaddingX,
      labelY + labelHeight / 2,
    );

    ctx.fillStyle = '#c5d0dc';
    ctx.font = axisFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('0', chartPadding.left - 6, height - chartPadding.bottom - 6);
    ctx.textAlign = 'right';
    ctx.fillText(
      `N = ${xMax.toLocaleString('en-US')}`,
      width - chartPadding.right,
      height - chartPadding.bottom - 6,
    );
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(yMax.toFixed(yPrecision), 8, chartPadding.top);
    ctx.fillText(yMin.toFixed(yPrecision), 8, height - chartPadding.bottom);
  }
}
