export interface Vector2 {
  x: number;
  y: number;
}

export interface ThrowResult {
  id: number;
  midpoint: Vector2;
  angle: number;
  intersects: boolean;
  nearestLineDistance: number;
  endpoints: {
    start: Vector2;
    end: Vector2;
  };
}

export interface StatsSnapshot {
  totalThrows: number;
  intersectionCount: number;
  experimentalProbability: number | null;
  theoreticalProbability: number | null;
  piEstimate: number | null;
}

export interface ExperimentSetup {
  needleLength: number;
  lineSpacing: number;
  usesSimplifiedTheory: boolean;
}

export interface PlotSample {
  throwCount: number;
  piEstimate: number;
}

export interface SimulationState {
  totalThrows: number;
  intersectionCount: number;
  isAutoRunning: boolean;
  latestThrow: ThrowResult | null;
  plotSamples: PlotSample[];
  setup: ExperimentSetup;
  stats: StatsSnapshot;
}

export interface WorldBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface NeedleSink {
  getWorldBounds(): WorldBounds;
  pushThrows(results: ThrowResult[]): void;
  reset(): void;
  dispose?(): void;
}

export interface PlotSink {
  render(samples: PlotSample[], liveSample: PlotSample | null): void;
  resize?(): void;
  dispose?(): void;
}

export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
  now(): number;
}
