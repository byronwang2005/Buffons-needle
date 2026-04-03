import { beforeEach, describe, expect, it } from 'vitest';
import { mountBuffonApp } from '../src/app';
import type {
  FrameScheduler,
  NeedleSink,
  PlotSample,
  PlotSink,
  ThrowResult,
  WorldBounds,
} from '../src/types';

class FakeNeedleSink implements NeedleSink {
  readonly bounds: WorldBounds = {
    left: -4,
    right: 4,
    top: 3,
    bottom: -3,
  };

  pushes: ThrowResult[][] = [];

  resetCount = 0;

  getWorldBounds(): WorldBounds {
    return this.bounds;
  }

  pushThrows(results: ThrowResult[]): void {
    this.pushes.push(results);
  }

  reset(): void {
    this.resetCount += 1;
  }
}

class FakePlotSink implements PlotSink {
  renders: Array<{ samples: PlotSample[]; liveSample: PlotSample | null }> = [];

  render(samples: PlotSample[], liveSample: PlotSample | null): void {
    this.renders.push({ samples, liveSample });
  }
}

class FakeScheduler implements FrameScheduler {
  private callbacks = new Map<number, FrameRequestCallback>();

  private nextId = 1;

  private currentNow = 0;

  request(callback: FrameRequestCallback): number {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return id;
  }

  cancel(id: number): void {
    this.callbacks.delete(id);
  }

  now(): number {
    return this.currentNow;
  }

  step(deltaMs: number): void {
    this.currentNow += deltaMs;
    const [entry] = this.callbacks.entries();

    if (!entry) {
      return;
    }

    const [id, callback] = entry;
    this.callbacks.delete(id);
    callback(this.currentNow);
  }
}

function createFixture(): void {
  document.body.innerHTML = `
    <div id="simulation-stage"></div>
    <canvas id="convergence-plot"></canvas>
    <div id="auto-indicator"></div>
    <button id="reset-button" type="button"></button>
    <button id="drop-one-button" type="button"></button>
    <button id="drop-hundred-button" type="button"></button>
    <button id="toggle-auto-button" type="button"></button>
    <button id="toggle-invalid-case-button" type="button"></button>
    <div id="total-throws"></div>
    <div id="intersection-count"></div>
    <div id="experimental-probability"></div>
    <div id="theoretical-probability"></div>
    <div id="pi-estimate"></div>
    <div id="estimate-note"></div>
    <div id="plot-mode-note"></div>
    <div id="setup-emphasis"></div>
  `;
}

describe('app wiring', () => {
  beforeEach(() => {
    createFixture();
  });

  it('updates the stats after manual drop actions', () => {
    const fakeScene = new FakeNeedleSink();
    const fakePlot = new FakePlotSink();

    mountBuffonApp({
      sceneFactory: () => fakeScene,
      plotFactory: () => fakePlot,
      scheduler: new FakeScheduler(),
    });

    (document.getElementById('drop-one-button') as HTMLButtonElement).click();

    expect(document.getElementById('total-throws')?.textContent).toBe('1');
    expect(document.getElementById('intersection-count')?.textContent).not.toBe('');
    expect(document.getElementById('theoretical-probability')?.textContent).toContain('2 / π');
    expect(fakeScene.pushes).toHaveLength(1);
    expect(fakeScene.pushes[0]).toHaveLength(1);
    expect(fakePlot.renders.length).toBeGreaterThan(0);
  });

  it('toggles auto-run and reset through the UI', () => {
    const fakeScene = new FakeNeedleSink();
    const scheduler = new FakeScheduler();

    mountBuffonApp({
      sceneFactory: () => fakeScene,
      plotFactory: () => new FakePlotSink(),
      scheduler,
    });

    const autoButton = document.getElementById('toggle-auto-button') as HTMLButtonElement;
    const resetButton = document.getElementById('reset-button') as HTMLButtonElement;

    autoButton.click();
    expect(autoButton.textContent).toBe('Pause');
    expect(autoButton.getAttribute('aria-pressed')).toBe('true');
    expect(autoButton.dataset.state).toBe('running');
    expect(document.getElementById('auto-indicator')?.textContent).toBe('Running');
    expect(document.getElementById('auto-indicator')?.dataset.state).toBe('running');

    scheduler.step(5);
    expect(Number(document.getElementById('total-throws')?.textContent)).toBeGreaterThan(0);

    autoButton.click();
    expect(autoButton.textContent).toBe('Auto Run');
    expect(autoButton.getAttribute('aria-pressed')).toBe('false');
    expect(autoButton.dataset.state).toBe('paused');
    expect(document.getElementById('auto-indicator')?.textContent).toBe('Paused');
    expect(document.getElementById('auto-indicator')?.dataset.state).toBe('paused');

    resetButton.click();
    expect(document.getElementById('total-throws')?.textContent).toBe('0');
    expect(document.getElementById('intersection-count')?.textContent).toBe('0');
    expect(fakeScene.resetCount).toBe(1);
  });

  it('switches to the l > d backdoor mode and marks the simplified theory invalid', () => {
    mountBuffonApp({
      sceneFactory: () => new FakeNeedleSink(),
      plotFactory: () => new FakePlotSink(),
      scheduler: new FakeScheduler(),
    });

    const modeButton = document.getElementById(
      'toggle-invalid-case-button',
    ) as HTMLButtonElement;
    modeButton.click();

    expect(document.getElementById('setup-emphasis')?.textContent).toContain('l = 1.25, d = 1');
    expect(document.getElementById('theoretical-probability')?.textContent).toContain(
      'not valid',
    );
    expect(document.getElementById('pi-estimate')?.textContent).toBe('Not available');
    expect(document.getElementById('estimate-note')?.textContent).toContain('l > d');
    expect(modeButton.getAttribute('aria-pressed')).toBe('true');
  });
});
