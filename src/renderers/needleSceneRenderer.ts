import * as THREE from 'three';
import { LINE_SPACING } from '../simulation';
import type { NeedleSink, ThrowResult, WorldBounds } from '../types';

const MISS_COLOR = new THREE.Color('#6c7f93');
const HIT_COLOR = new THREE.Color('#f4b35f');

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

  private worldHeight = 8;

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
    this.container.appendChild(this.renderer.domElement);

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
    this.linesGeometry.dispose();
    this.linesMaterial.dispose();
    this.needlesGeometry.dispose();
    this.needleMaterial.dispose();
    this.renderer.dispose();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;

    this.camera.top = this.worldHeight / 2;
    this.camera.bottom = -this.worldHeight / 2;
    this.camera.left = -(this.worldHeight * aspect) / 2;
    this.camera.right = (this.worldHeight * aspect) / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
    this.rebuildLines();
    this.render();
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
