import { BuffonController, WindowFrameScheduler } from './controller';
import { THEORETICAL_PROBABILITY } from './simulation';
import { ConvergencePlotRenderer } from './renderers/convergencePlot';
import { NeedleSceneRenderer } from './renderers/needleSceneRenderer';
import type { FrameScheduler, NeedleSink, PlotSink, SimulationState } from './types';

interface AppOptions {
  scheduler?: FrameScheduler;
  sceneFactory?: (element: HTMLElement) => NeedleSink;
  plotFactory?: (canvas: HTMLCanvasElement) => PlotSink;
}

const integerFormatter = new Intl.NumberFormat('en-US');
const decimalFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 6,
  minimumFractionDigits: 0,
});

function formatNullable(value: number | null): string {
  return value === null ? '—' : decimalFormatter.format(value);
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Expected element #${id} to exist.`);
  }

  return element as T;
}

function renderState(state: SimulationState): void {
  byId<HTMLElement>('total-throws').textContent = integerFormatter.format(state.totalThrows);
  byId<HTMLElement>('intersection-count').textContent = integerFormatter.format(
    state.intersectionCount,
  );
  byId<HTMLElement>('experimental-probability').textContent = formatNullable(
    state.stats.experimentalProbability,
  );
  byId<HTMLElement>('theoretical-probability').textContent = `2 / π ≈ ${decimalFormatter.format(
    THEORETICAL_PROBABILITY,
  )}`;
  byId<HTMLElement>('pi-estimate').textContent = formatNullable(state.stats.piEstimate);
  byId<HTMLElement>('auto-indicator').textContent = state.isAutoRunning ? 'Running' : 'Paused';
  byId<HTMLButtonElement>('toggle-auto-button').textContent = state.isAutoRunning
    ? 'Pause'
    : 'Auto Run';
  byId<HTMLElement>('estimate-note').textContent =
    state.stats.piEstimate === null
      ? 'π appears after the first intersection.'
      : `Updated live from ${integerFormatter.format(state.totalThrows)} throws and ${integerFormatter.format(
          state.intersectionCount,
        )} hits.`;
}

export function mountBuffonApp(options: AppOptions = {}): BuffonController {
  const sceneHost = byId<HTMLElement>('simulation-stage');
  const plotCanvas = byId<HTMLCanvasElement>('convergence-plot');

  const controller = new BuffonController({
    needleSink: options.sceneFactory?.(sceneHost) ?? new NeedleSceneRenderer(sceneHost),
    plotSink: options.plotFactory?.(plotCanvas) ?? new ConvergencePlotRenderer(plotCanvas),
    scheduler: options.scheduler ?? new WindowFrameScheduler(),
  });

  controller.subscribe(renderState);

  byId<HTMLButtonElement>('reset-button').addEventListener('click', () => {
    controller.reset();
  });
  byId<HTMLButtonElement>('drop-one-button').addEventListener('click', () => {
    controller.drop(1);
  });
  byId<HTMLButtonElement>('drop-hundred-button').addEventListener('click', () => {
    controller.drop(100);
  });
  byId<HTMLButtonElement>('toggle-auto-button').addEventListener('click', () => {
    controller.toggleAuto();
  });

  window.addEventListener('beforeunload', () => {
    controller.dispose();
  });

  return controller;
}
