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

const lastPulseAt = new WeakMap<HTMLElement, number>();

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

function pulseElement(element: HTMLElement): void {
  const now = globalThis.performance?.now() ?? Date.now();
  const previousPulse = lastPulseAt.get(element) ?? Number.NEGATIVE_INFINITY;

  if (now - previousPulse < 280) {
    return;
  }

  lastPulseAt.set(element, now);
  element.classList.remove('is-fresh');
  void element.offsetWidth;
  element.classList.add('is-fresh');
}

function setTextContent(element: HTMLElement, nextText: string, shouldPulse = false): void {
  if (element.textContent === nextText) {
    return;
  }

  element.textContent = nextText;

  if (shouldPulse) {
    pulseElement(element);
  }
}

function renderState(state: SimulationState): void {
  const isSimplifiedTheoryValid = state.setup.usesSimplifiedTheory;
  const setupLabel = `l = ${decimalFormatter.format(state.setup.needleLength)}, d = ${decimalFormatter.format(
    state.setup.lineSpacing,
  )}`;
  const totalThrowsLabel = integerFormatter.format(state.totalThrows);
  const intersectionLabel = integerFormatter.format(state.intersectionCount);
  const experimentalProbabilityLabel = formatNullable(state.stats.experimentalProbability);
  const theoreticalProbabilityLabel = isSimplifiedTheoryValid
    ? `2 / π ≈ ${decimalFormatter.format(THEORETICAL_PROBABILITY)}`
    : decimalFormatter.format(state.stats.theoreticalProbability);
  const piEstimateLabel = formatNullable(state.stats.piEstimate);
  const autoState = state.isAutoRunning ? 'running' : 'paused';

  setTextContent(
    byId<HTMLElement>('total-throws'),
    totalThrowsLabel,
    state.totalThrows > 0,
  );
  setTextContent(
    byId<HTMLElement>('intersection-count'),
    intersectionLabel,
    state.totalThrows > 0,
  );
  setTextContent(
    byId<HTMLElement>('experimental-probability'),
    experimentalProbabilityLabel,
    state.stats.experimentalProbability !== null,
  );
  setTextContent(byId<HTMLElement>('theoretical-probability'), theoreticalProbabilityLabel);
  setTextContent(
    byId<HTMLElement>('pi-estimate'),
    piEstimateLabel,
    state.stats.piEstimate !== null,
  );
  byId<HTMLElement>('theoretical-probability').dataset.state = isSimplifiedTheoryValid
    ? 'valid'
    : 'invalid';
  byId<HTMLElement>('pi-estimate').dataset.state = isSimplifiedTheoryValid ? 'valid' : 'invalid';
  setTextContent(byId<HTMLElement>('setup-emphasis'), setupLabel);

  const autoIndicator = byId<HTMLElement>('auto-indicator');
  setTextContent(autoIndicator, state.isAutoRunning ? 'Running' : 'Paused');
  autoIndicator.dataset.state = autoState;

  const toggleAutoButton = byId<HTMLButtonElement>('toggle-auto-button');
  setTextContent(toggleAutoButton, state.isAutoRunning ? 'Pause' : 'Auto Run');
  toggleAutoButton.dataset.state = autoState;
  toggleAutoButton.setAttribute('aria-pressed', String(state.isAutoRunning));

  const estimateNote = document.getElementById('estimate-note');
  if (estimateNote) {
    setTextContent(
      estimateNote,
      isSimplifiedTheoryValid
        ? ''
        : 'Backdoor mode: theoretical probability now uses the long-needle formula, while Estimated π still uses 2N/C, so it should not converge to π.',
    );
    estimateNote.dataset.state =
      !isSimplifiedTheoryValid ? 'invalid' : state.stats.piEstimate === null ? 'idle' : 'live';
    estimateNote.setAttribute('aria-hidden', String(isSimplifiedTheoryValid));
  }

  const modeButton = byId<HTMLButtonElement>('toggle-invalid-case-button');
  setTextContent(modeButton, isSimplifiedTheoryValid ? 'Backdoor: l > d' : 'Back to l ≤ d');
  modeButton.dataset.state = isSimplifiedTheoryValid ? 'default' : 'invalid';
  modeButton.setAttribute('aria-pressed', String(!isSimplifiedTheoryValid));

  const plotNote = byId<HTMLElement>('plot-mode-note');
  setTextContent(
    plotNote,
    isSimplifiedTheoryValid
      ? ''
      : 'The cyan curve is still the naive 2N/C estimate, so in l > d mode it drifts away from π instead of converging to it.',
  );
  plotNote.dataset.state = isSimplifiedTheoryValid ? 'hidden' : 'visible';

  document.body.dataset.autoState = autoState;
  document.body.dataset.theoryMode = isSimplifiedTheoryValid ? 'valid' : 'invalid';
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
  byId<HTMLButtonElement>('toggle-invalid-case-button').addEventListener('click', () => {
    controller.toggleLongNeedleMode();
  });

  window.addEventListener('beforeunload', () => {
    controller.dispose();
  });

  return controller;
}
