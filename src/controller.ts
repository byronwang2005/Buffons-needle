import {
  appendPlotSample,
  buildStats,
  createThrowResult,
  DEFAULT_EXPERIMENT_SETUP,
  LONG_NEEDLE_EXPERIMENT_SETUP,
  maybeCreatePlotSample,
} from './simulation';
import type {
  ExperimentSetup,
  FrameScheduler,
  NeedleSink,
  PlotSample,
  PlotSink,
  SimulationState,
  ThrowResult,
} from './types';

export interface BuffonControllerOptions {
  needleSink: NeedleSink;
  plotSink: PlotSink;
  scheduler: FrameScheduler;
}

type StateListener = (state: SimulationState) => void;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class BuffonController {
  private readonly needleSink: NeedleSink;

  private readonly plotSink: PlotSink;

  private readonly scheduler: FrameScheduler;

  private readonly listeners = new Set<StateListener>();

  private totalThrows = 0;

  private intersectionCount = 0;

  private plotSamples: PlotSample[] = [];

  private latestThrow: ThrowResult | null = null;

  private setup: ExperimentSetup = DEFAULT_EXPERIMENT_SETUP;

  private isAutoRunning = false;

  private frameId: number | null = null;

  private adaptiveBatchSize = 24;

  private readonly targetWorkMs = 6.5;

  constructor(options: BuffonControllerOptions) {
    this.needleSink = options.needleSink;
    this.plotSink = options.plotSink;
    this.scheduler = options.scheduler;
    this.emitState();
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): SimulationState {
    return {
      totalThrows: this.totalThrows,
      intersectionCount: this.intersectionCount,
      isAutoRunning: this.isAutoRunning,
      latestThrow: this.latestThrow,
      plotSamples: this.plotSamples,
      setup: this.setup,
      stats: buildStats(this.totalThrows, this.intersectionCount, this.setup),
    };
  }

  drop(count: number): void {
    if (count <= 0) {
      return;
    }

    const bounds = this.needleSink.getWorldBounds();
    const batch: ThrowResult[] = [];
    let lastRecordedThrowCount =
      this.plotSamples.length > 0
        ? this.plotSamples[this.plotSamples.length - 1].throwCount
        : 0;

    for (let index = 0; index < count; index += 1) {
      const result = createThrowResult(this.totalThrows + 1, bounds, this.setup);
      this.totalThrows += 1;
      this.intersectionCount += Number(result.intersects);
      this.latestThrow = result;
      batch.push(result);

      const sample = maybeCreatePlotSample(
        this.totalThrows,
        this.intersectionCount,
        lastRecordedThrowCount,
        this.setup,
      );

      if (sample) {
        this.plotSamples = appendPlotSample(this.plotSamples, sample);
        lastRecordedThrowCount = sample.throwCount;
      }
    }

    this.needleSink.pushThrows(batch);
    this.emitState();
  }

  reset(): void {
    this.stopAuto();
    this.totalThrows = 0;
    this.intersectionCount = 0;
    this.plotSamples = [];
    this.latestThrow = null;
    this.adaptiveBatchSize = 24;
    this.needleSink.reset();
    this.emitState();
  }

  setLongNeedleMode(enabled: boolean): void {
    this.setup = enabled ? LONG_NEEDLE_EXPERIMENT_SETUP : DEFAULT_EXPERIMENT_SETUP;
    this.reset();
  }

  toggleLongNeedleMode(): void {
    this.setLongNeedleMode(this.setup.needleLength <= this.setup.lineSpacing);
  }

  toggleAuto(): void {
    if (this.isAutoRunning) {
      this.stopAuto();
      this.emitState();
      return;
    }

    this.isAutoRunning = true;
    this.scheduleFrame();
    this.emitState();
  }

  dispose(): void {
    this.stopAuto();
    this.needleSink.dispose?.();
    this.plotSink.dispose?.();
  }

  private scheduleFrame(): void {
    this.frameId = this.scheduler.request(this.handleFrame);
  }

  private readonly handleFrame: FrameRequestCallback = () => {
    if (!this.isAutoRunning) {
      return;
    }

    const start = this.scheduler.now();
    this.drop(this.adaptiveBatchSize);
    const elapsed = Math.max(0.25, this.scheduler.now() - start);
    const scale = this.targetWorkMs / elapsed;
    const nextBatch = clamp(Math.round(this.adaptiveBatchSize * scale), 1, 2048);

    this.adaptiveBatchSize = nextBatch;
    this.scheduleFrame();
  };

  private stopAuto(): void {
    this.isAutoRunning = false;

    if (this.frameId !== null) {
      this.scheduler.cancel(this.frameId);
      this.frameId = null;
    }
  }

  private emitState(): void {
    const state = this.getState();
    const liveSample =
      state.stats.piEstimate === null
        ? null
        : {
            throwCount: state.totalThrows,
            piEstimate: state.stats.piEstimate,
          };

    this.plotSink.render(this.plotSamples, liveSample);

    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

export class WindowFrameScheduler implements FrameScheduler {
  request(callback: FrameRequestCallback): number {
    return window.requestAnimationFrame(callback);
  }

  cancel(id: number): void {
    window.cancelAnimationFrame(id);
  }

  now(): number {
    return performance.now();
  }
}
