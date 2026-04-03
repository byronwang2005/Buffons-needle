import type {
  ExperimentSetup,
  PlotSample,
  StatsSnapshot,
  ThrowResult,
  WorldBounds,
} from './types';

export const LINE_SPACING = 1;
export const NEEDLE_LENGTH = 1;
export const HALF_NEEDLE = NEEDLE_LENGTH / 2;
export const THEORETICAL_PROBABILITY = 2 / Math.PI;
export const DEFAULT_EXPERIMENT_SETUP: ExperimentSetup = {
  needleLength: NEEDLE_LENGTH,
  lineSpacing: LINE_SPACING,
  usesSimplifiedTheory: true,
};
export const LONG_NEEDLE_EXPERIMENT_SETUP: ExperimentSetup = {
  needleLength: 1.25,
  lineSpacing: LINE_SPACING,
  usesSimplifiedTheory: false,
};

const EPSILON = 1e-9;
const MAX_PLOT_SAMPLES = 2400;

export function computeTheoreticalProbability(
  setup: ExperimentSetup = DEFAULT_EXPERIMENT_SETUP,
): number {
  const ratio = setup.needleLength / setup.lineSpacing;

  if (ratio <= 1) {
    return (2 * ratio) / Math.PI;
  }

  return (
    (2 / Math.PI) *
    (ratio - Math.sqrt(ratio * ratio - 1) + Math.acos(1 / ratio))
  );
}

export function computeShortNeedlePiEstimate(
  totalThrows: number,
  intersectionCount: number,
): number | null {
  return intersectionCount > 0 ? (2 * totalThrows) / intersectionCount : null;
}

export function distanceToNearestLine(y: number, lineSpacing = LINE_SPACING): number {
  const nearestLine = Math.round(y / lineSpacing) * lineSpacing;
  return Math.abs(y - nearestLine);
}

export function computeNeedleEndpoints(
  x: number,
  y: number,
  angle: number,
  length = NEEDLE_LENGTH,
): ThrowResult['endpoints'] {
  const halfLength = length / 2;
  const dx = Math.cos(angle) * halfLength;
  const dy = Math.sin(angle) * halfLength;

  return {
    start: { x: x - dx, y: y - dy },
    end: { x: x + dx, y: y + dy },
  };
}

export function doesNeedleIntersect(
  y: number,
  angle: number,
  length = NEEDLE_LENGTH,
  lineSpacing = LINE_SPACING,
): boolean {
  const distance = distanceToNearestLine(y, lineSpacing);
  const reach = (length / 2) * Math.abs(Math.sin(angle));
  return distance <= reach + EPSILON;
}

export function createThrowResult(
  id: number,
  bounds: WorldBounds,
  setup: ExperimentSetup = DEFAULT_EXPERIMENT_SETUP,
  rng: () => number = Math.random,
): ThrowResult {
  const x = bounds.left + rng() * (bounds.right - bounds.left);
  const y = bounds.bottom + rng() * (bounds.top - bounds.bottom);
  const angle = rng() * Math.PI;
  const intersects = doesNeedleIntersect(y, angle, setup.needleLength, setup.lineSpacing);

  return {
    id,
    midpoint: { x, y },
    angle,
    intersects,
    nearestLineDistance: distanceToNearestLine(y, setup.lineSpacing),
    endpoints: computeNeedleEndpoints(x, y, angle, setup.needleLength),
  };
}

export function buildStats(
  totalThrows: number,
  intersectionCount: number,
  setup: ExperimentSetup = DEFAULT_EXPERIMENT_SETUP,
): StatsSnapshot {
  const experimentalProbability =
    totalThrows > 0 ? intersectionCount / totalThrows : null;
  const piEstimate = computeShortNeedlePiEstimate(totalThrows, intersectionCount);

  return {
    totalThrows,
    intersectionCount,
    experimentalProbability,
    theoreticalProbability: computeTheoreticalProbability(setup),
    piEstimate,
  };
}

function sampleStrideForThrow(throwCount: number): number {
  if (throwCount < 250) {
    return 1;
  }

  if (throwCount < 1_000) {
    return 5;
  }

  if (throwCount < 5_000) {
    return 20;
  }

  if (throwCount < 20_000) {
    return 50;
  }

  return 200;
}

export function shouldRecordSample(
  throwCount: number,
  lastRecordedThrowCount: number,
): boolean {
  return throwCount - lastRecordedThrowCount >= sampleStrideForThrow(throwCount);
}

export function maybeCreatePlotSample(
  totalThrows: number,
  intersectionCount: number,
  lastRecordedThrowCount: number,
  _setup: ExperimentSetup = DEFAULT_EXPERIMENT_SETUP,
): PlotSample | null {
  if (intersectionCount === 0) {
    return null;
  }

  if (!shouldRecordSample(totalThrows, lastRecordedThrowCount)) {
    return null;
  }

  return {
    throwCount: totalThrows,
    piEstimate: computeShortNeedlePiEstimate(totalThrows, intersectionCount) ?? 0,
  };
}

export function appendPlotSample(samples: PlotSample[], sample: PlotSample): PlotSample[] {
  const nextSamples = [...samples, sample];

  if (nextSamples.length <= MAX_PLOT_SAMPLES) {
    return nextSamples;
  }

  return nextSamples.filter((_, index) => index % 2 === 0);
}
