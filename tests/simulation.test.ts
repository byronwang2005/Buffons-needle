import { describe, expect, it } from 'vitest';
import {
  computeTheoreticalProbability,
  LONG_NEEDLE_EXPERIMENT_SETUP,
  THEORETICAL_PROBABILITY,
  buildStats,
  createThrowResult,
  distanceToNearestLine,
  doesNeedleIntersect,
  maybeCreatePlotSample,
} from '../src/simulation';
import type { WorldBounds } from '../src/types';

describe('simulation math', () => {
  it('measures the distance to the nearest parallel line for positive and negative coordinates', () => {
    expect(distanceToNearestLine(0.2)).toBeCloseTo(0.2);
    expect(distanceToNearestLine(-0.2)).toBeCloseTo(0.2);
    expect(distanceToNearestLine(1.49)).toBeCloseTo(0.49);
    expect(distanceToNearestLine(-1.49)).toBeCloseTo(0.49);
  });

  it('counts boundary contacts as intersections', () => {
    const angle = Math.PI / 6;
    const boundaryY = 0.25;

    expect(doesNeedleIntersect(boundaryY, angle)).toBe(true);
    expect(doesNeedleIntersect(boundaryY + 1e-5, angle)).toBe(false);
    expect(doesNeedleIntersect(boundaryY - 1e-5, angle)).toBe(true);
  });

  it('builds statistics for empty and populated runs', () => {
    expect(buildStats(0, 0)).toEqual({
      totalThrows: 0,
      intersectionCount: 0,
      experimentalProbability: null,
      theoreticalProbability: THEORETICAL_PROBABILITY,
      piEstimate: null,
    });

    expect(buildStats(120, 77)).toEqual({
      totalThrows: 120,
      intersectionCount: 77,
      experimentalProbability: 77 / 120,
      theoreticalProbability: THEORETICAL_PROBABILITY,
      piEstimate: (2 * 120) / 77,
    });

    expect(buildStats(120, 77, LONG_NEEDLE_EXPERIMENT_SETUP)).toEqual({
      totalThrows: 120,
      intersectionCount: 77,
      experimentalProbability: 77 / 120,
      theoreticalProbability: computeTheoreticalProbability(LONG_NEEDLE_EXPERIMENT_SETUP),
      piEstimate: (2 * 120) / 77,
    });
  });

  it('creates deterministic throws inside the current world bounds', () => {
    const bounds: WorldBounds = { left: -2, right: 2, top: 1, bottom: -1 };
    const values = [0.25, 0.9, 0.5];
    let index = 0;
    const result = createThrowResult(1, bounds, undefined, () => values[index++] ?? 0.5);

    expect(result.midpoint.x).toBeCloseTo(-1);
    expect(result.midpoint.y).toBeCloseTo(0.8);
    expect(result.angle).toBeCloseTo(Math.PI / 2);
    expect(result.endpoints.start.y).toBeCloseTo(0.3);
    expect(result.endpoints.end.y).toBeCloseTo(1.3);
  });

  it('records plot samples only after intersections and stride thresholds', () => {
    expect(maybeCreatePlotSample(1, 0, 0)).toBeNull();
    expect(maybeCreatePlotSample(1, 1, 0)).toEqual({
      throwCount: 1,
      piEstimate: 2,
    });
    expect(maybeCreatePlotSample(260, 130, 256)).toBeNull();
    expect(maybeCreatePlotSample(265, 132, 256)).toEqual({
      throwCount: 265,
      piEstimate: (2 * 265) / 132,
    });
  });
});
