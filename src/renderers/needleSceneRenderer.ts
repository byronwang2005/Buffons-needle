import * as THREE from 'three';
import { LINE_SPACING } from '../simulation';
import type { NeedleSink, ThrowResult, WorldBounds } from '../types';

const MISS_COLOR = new THREE.Color('#6c7f93');
const HIT_COLOR = new THREE.Color('#f4b35f');
const MIN_ZOOM_LEVEL = 0.5;
const MAX_ZOOM_LEVEL = 8;

export interface NeedleSceneRendererOptions {
  visibleCap?: number;
}

export class NeedleSceneRenderer implements NeedleSink {
  private readonly container: HTMLElement;

  private readonly renderer: THREE.WebGLRenderer;

  private readonly scene: THREE.Scene;

  private readonly camera: THREE.OrthographicCamera;

  private readonly linesMaterial: THREE.LineBasicMaterial;

  private readonly linesGeometry = new THREE.BufferGeometry();

  private readonly lines = new THREE.LineSegments(this.linesGeometry);

  private readonly needlesGeometry = new THREE.BufferGeometry();

  private readonly needleMaterial: THREE.LineBasicMaterial;

  private readonly needles: THREE.LineSegments;

  private readonly visibleCap: number;

  private readonly needlePositions: Float32Array;

  private readonly needleColors: Float32Array;

  private readonly resizeObserver: ResizeObserver;

  private readonly baseWorldHeight = 8;

  private readonly viewCenter = new THREE.Vector2(0, 0);

  private readonly dragStartCenter = new THREE.Vector2(0, 0);

  private zoomLevel = 1;

  private dragPointerId: number | null = null;

  private dragStartClientX = 0;

  private dragStartClientY = 0;

  private visibleCount = 0;

  private writeIndex = 0;

  constructor(container: HTMLElement, options: NeedleSceneRendererOptions = {}) {
    this.container = container;
    this.visibleCap = options.visibleCap ?? 16_000;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.set(0, 0, 3);

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearAlpha(0);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);
    this.container.classList.add('is-draggable');

    this.linesMaterial = new THREE.LineBasicMaterial({
      color: '#304358',
      transparent: true,
      opacity: 0.95,
    });
    this.lines.material = this.linesMaterial;
    this.scene.add(this.lines);

    this.needlePositions = new Float32Array(this.visibleCap * 2 * 3);
    this.needleColors = new Float32Array(this.visibleCap * 2 * 3);
    this.needlesGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.needlePositions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.needlesGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.needleColors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.needlesGeometry.setDrawRange(0, 0);

    this.needleMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });
    this.needles = new THREE.LineSegments(this.needlesGeometry, this.needleMaterial);
    this.scene.add(this.needles);

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(this.container);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('pointercancel', this.handlePointerUp);
    this.renderer.domElement.addEventListener(
      'wheel',
      this.handleWheel,
      { passive: false },
    );

    this.resize();
  }

  getWorldBounds(): WorldBounds {
    return {
      left: this.camera.left,
      right: this.camera.right,
      top: this.camera.top,
      bottom: this.camera.bottom,
    };
  }

  pushThrows(results: ThrowResult[]): void {
    if (results.length === 0) {
      return;
    }

    for (const result of results) {
      const slot = this.writeIndex;
      const baseIndex = slot * 2 * 3;
      const color = result.intersects ? HIT_COLOR : MISS_COLOR;

      this.needlePositions[baseIndex] = result.endpoints.start.x;
      this.needlePositions[baseIndex + 1] = result.endpoints.start.y;
      this.needlePositions[baseIndex + 2] = 0;
      this.needlePositions[baseIndex + 3] = result.endpoints.end.x;
      this.needlePositions[baseIndex + 4] = result.endpoints.end.y;
      this.needlePositions[baseIndex + 5] = 0;

      this.needleColors[baseIndex] = color.r;
      this.needleColors[baseIndex + 1] = color.g;
      this.needleColors[baseIndex + 2] = color.b;
      this.needleColors[baseIndex + 3] = color.r;
      this.needleColors[baseIndex + 4] = color.g;
      this.needleColors[baseIndex + 5] = color.b;

      this.writeIndex = (this.writeIndex + 1) % this.visibleCap;
      this.visibleCount = Math.min(this.visibleCount + 1, this.visibleCap);
    }

    this.needlesGeometry.attributes.position.needsUpdate = true;
    this.needlesGeometry.attributes.color.needsUpdate = true;
    this.needlesGeometry.setDrawRange(0, this.visibleCount * 2);
    this.render();
  }

  reset(): void {
    this.visibleCount = 0;
    this.writeIndex = 0;
    this.needlesGeometry.setDrawRange(0, 0);
    this.render();
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('pointercancel', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel);
    this.linesGeometry.dispose();
    this.linesMaterial.dispose();
    this.needlesGeometry.dispose();
    this.needleMaterial.dispose();
    this.renderer.dispose();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.updateProjection(width, height);
    this.renderer.setSize(width, height, false);
    this.rebuildLines();
    this.render();
  }

  private updateProjection(width: number, height: number): void {
    const aspect = width / height;
    const visibleWorldHeight = this.baseWorldHeight / this.zoomLevel;
    const halfHeight = visibleWorldHeight / 2;
    const halfWidth = halfHeight * aspect;

    this.camera.top = this.viewCenter.y + halfHeight;
    this.camera.bottom = this.viewCenter.y - halfHeight;
    this.camera.left = this.viewCenter.x - halfWidth;
    this.camera.right = this.viewCenter.x + halfWidth;
    this.camera.updateProjectionMatrix();
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.dragPointerId !== null) {
      return;
    }

    event.preventDefault();
    this.dragPointerId = event.pointerId;
    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
    this.dragStartCenter.copy(this.viewCenter);
    this.container.classList.add('is-dragging');
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) {
      return;
    }

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const worldWidth = this.camera.right - this.camera.left;
    const worldHeight = this.camera.top - this.camera.bottom;
    const deltaX = event.clientX - this.dragStartClientX;
    const deltaY = event.clientY - this.dragStartClientY;

    this.viewCenter.x = this.dragStartCenter.x - (deltaX / width) * worldWidth;
    this.viewCenter.y = this.dragStartCenter.y + (deltaY / height) * worldHeight;
    this.updateProjection(width, height);
    this.rebuildLines();
    this.render();
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) {
      return;
    }

    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }

    this.dragPointerId = null;
    this.container.classList.remove('is-dragging');
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const rect = this.container.getBoundingClientRect();
    const beforeZoomPoint = this.screenPointToWorld(event.clientX, event.clientY, rect);
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    const nextZoom = THREE.MathUtils.clamp(
      this.zoomLevel * zoomFactor,
      MIN_ZOOM_LEVEL,
      MAX_ZOOM_LEVEL,
    );

    if (Math.abs(nextZoom - this.zoomLevel) < 1e-4) {
      return;
    }

    this.zoomLevel = nextZoom;
    this.updateProjection(width, height);
    const afterZoomPoint = this.screenPointToWorld(event.clientX, event.clientY, rect);

    this.viewCenter.x += beforeZoomPoint.x - afterZoomPoint.x;
    this.viewCenter.y += beforeZoomPoint.y - afterZoomPoint.y;
    this.updateProjection(width, height);
    this.rebuildLines();
    this.render();
  };

  private screenPointToWorld(
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ): THREE.Vector2 {
    const normalizedX = (clientX - rect.left) / Math.max(rect.width, 1);
    const normalizedY = (clientY - rect.top) / Math.max(rect.height, 1);
    const worldX = this.camera.left + normalizedX * (this.camera.right - this.camera.left);
    const worldY = this.camera.top - normalizedY * (this.camera.top - this.camera.bottom);

    return new THREE.Vector2(worldX, worldY);
  }

  private rebuildLines(): void {
    const left = this.camera.left;
    const right = this.camera.right;
    const top = this.camera.top;
    const bottom = this.camera.bottom;

    const firstLine = Math.floor(bottom / LINE_SPACING) - 1;
    const lastLine = Math.ceil(top / LINE_SPACING) + 1;
    const vertices: number[] = [];

    for (let index = firstLine; index <= lastLine; index += 1) {
      const y = index * LINE_SPACING;
      vertices.push(left, y, 0, right, y, 0);
    }

    this.linesGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
