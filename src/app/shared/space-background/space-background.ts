import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';

/**
 * Full-page fixed 3D background: twinkling starfield, a slowly rotating
 * "data globe" (dark Earth with glowing green vegetation points + wireframe),
 * soft nebula gradients (CSS) and an orbiting satellite SVG.
 *
 * Mouse movement gently parallaxes the whole scene so it feels alive.
 * Everything runs outside Angular's zone to avoid change-detection churn.
 */
@Component({
  selector: 'app-space-background',
  standalone: true,
  template: `
    <div class="space-bg">
      <div class="nebula nebula-green"></div>
      <div class="nebula nebula-amber"></div>
      <canvas #canvas class="scene"></canvas>
      <div class="satellite" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="46" height="46">
          <g fill="none" stroke="#9FB3A6" stroke-width="1.6">
            <rect x="27" y="22" width="10" height="20" rx="2" fill="rgba(73,224,123,0.08)"/>
            <path d="M27 26 L8 20 M27 38 L8 44" stroke="#49E07B" stroke-width="1.2"/>
            <rect x="2" y="16" width="14" height="10" rx="1.5" fill="rgba(73,224,123,0.12)" stroke="#49E07B"/>
            <rect x="2" y="38" width="14" height="10" rx="1.5" fill="rgba(73,224,123,0.12)" stroke="#49E07B"/>
            <path d="M37 30 L52 30" stroke="#F2B347" stroke-width="1.4"/>
            <circle cx="55" cy="30" r="3" fill="rgba(242,179,71,0.3)" stroke="#F2B347"/>
          </g>
        </svg>
      </div>
      <div class="vignette"></div>
    </div>
  `,
  styleUrl: './space-background.scss',
})
export class SpaceBackgroundComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sceneGroup!: THREE.Group;
  private globe!: THREE.Group;
  private stars!: THREE.Points;
  private starMat!: THREE.ShaderMaterial;
  private frameId = 0;
  private clock = new THREE.Clock();

  private readonly pointer = { x: 0, y: 0 };
  private readonly target = { x: 0, y: 0 };

  private onResize = () => this.resize();
  private onPointerMove = (e: PointerEvent) => {
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.init();
      window.addEventListener('resize', this.onResize);
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      this.animate();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    this.renderer?.dispose();
    this.scene?.traverse((o) => {
      const m = o as THREE.Mesh | THREE.Points;
      (m.geometry as THREE.BufferGeometry)?.dispose?.();
      const mat = (m as any).material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
  }

  // ------------------------------------------------------------------
  private init(): void {
    const canvas = this.canvasRef.nativeElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    this.sceneGroup = new THREE.Group();
    this.scene.add(this.sceneGroup);

    this.sceneGroup.add(this.buildStars());
    this.globe = this.buildGlobe();
    this.sceneGroup.add(this.globe);

    this.scene.add(new THREE.AmbientLight(0x224433, 0.6));
    const key = new THREE.PointLight(0x49e07b, 1.4, 40);
    key.position.set(-6, 4, 6);
    this.scene.add(key);
  }

  /** 1200 twinkling stars via a custom additive point shader. */
  private buildStars(): THREE.Points {
    const COUNT = 1200;
    const positions = new Float32Array(COUNT * 3);
    const phases = new Float32Array(COUNT);
    const sizes = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      // Distribute in a large spherical shell behind the globe.
      const r = 14 + Math.random() * 26;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi) - 10;
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 0.8 + Math.random() * 2.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    this.starMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        varying float vTw;
        void main() {
          vTw = 0.55 + 0.45 * sin(uTime * 1.6 + aPhase);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (300.0 / -mv.z) * (0.6 + vTw * 0.6);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vTw;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.0, d) * vTw;
          vec3 col = mix(vec3(0.8,0.95,0.85), vec3(0.29,0.88,0.48), 0.25);
          gl_FragColor = vec4(col, a);
        }`,
    });

    this.stars = new THREE.Points(geo, this.starMat);
    return this.stars;
  }

  /** Dark globe + glowing green vegetation points clustered into "continents". */
  private buildGlobe(): THREE.Group {
    const group = new THREE.Group();
    const R = 2.0;

    // Dark base sphere.
    const base = new THREE.Mesh(
      new THREE.SphereGeometry(R, 48, 48),
      new THREE.MeshStandardMaterial({
        color: 0x061410,
        emissive: 0x05120c,
        roughness: 1,
        metalness: 0,
      }),
    );
    group.add(base);

    // Green wireframe shell.
    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(R * 1.004, 4),
      new THREE.MeshBasicMaterial({ color: 0x49e07b, wireframe: true, transparent: true, opacity: 0.08 }),
    );
    group.add(wire);

    // Vegetation point cloud: Fibonacci sphere, kept where pseudo-noise says "land".
    const N = 2600;
    const pos: number[] = [];
    const bright: number[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const theta = golden * i;
      const x = Math.cos(theta) * rad;
      const z = Math.sin(theta) * rad;
      const land = this.landNoise(x, y, z);
      if (land < 0.5) continue;
      pos.push(x * R * 1.012, y * R * 1.012, z * R * 1.012);
      bright.push(0.4 + land * 0.9);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aBright', new THREE.Float32BufferAttribute(bright, 1));
    const vegMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aBright;
        uniform float uTime;
        varying float vB;
        void main() {
          vB = aBright * (0.7 + 0.3 * sin(uTime * 2.0 + position.x * 3.0));
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (2.4 + aBright * 2.0) * (120.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vB;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(c)) * vB;
          gl_FragColor = vec4(0.29, 0.88, 0.48, a);
        }`,
    });
    const veg = new THREE.Points(g, vegMat);
    veg.userData['mat'] = vegMat;
    group.add(veg);

    // Soft atmospheric halo (back-side additive sphere).
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.14, 48, 48),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {},
        vertexShader: `
          varying vec3 vN;
          void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          varying vec3 vN;
          void main() {
            float i = pow(0.75 - abs(vN.z), 2.2);
            gl_FragColor = vec4(0.29, 0.88, 0.48, clamp(i,0.0,1.0) * 0.5);
          }`,
      }),
    );
    group.add(halo);

    group.position.set(2.6, -0.4, 0);
    group.rotation.z = 0.35;
    group.userData['veg'] = veg;
    return group;
  }

  /** Cheap layered-sine value noise → clusters that read as continents. */
  private landNoise(x: number, y: number, z: number): number {
    const n =
      Math.sin(x * 3.1 + 1.3) * Math.cos(y * 2.7 - 0.6) +
      Math.sin(z * 4.3 + 2.1) * Math.cos(x * 1.9 + 0.4) +
      Math.sin(y * 5.2 - 1.1) * Math.cos(z * 2.3 + 1.7);
    return (n / 3) * 0.5 + 0.5;
  }

  private animate = (): void => {
    this.frameId = requestAnimationFrame(this.animate);
    const t = this.clock.getElapsedTime();

    this.starMat.uniforms['uTime'].value = t;
    const vegMat = this.globe.userData['veg']?.userData?.['mat'] as THREE.ShaderMaterial;
    if (vegMat) vegMat.uniforms['uTime'].value = t;

    this.globe.rotation.y += 0.0016;
    this.stars.rotation.y = t * 0.01;

    // Parallax: ease the scene toward the pointer.
    this.target.x += (this.pointer.x - this.target.x) * 0.045;
    this.target.y += (this.pointer.y - this.target.y) * 0.045;
    this.sceneGroup.rotation.y = this.target.x * 0.18;
    this.sceneGroup.rotation.x = this.target.y * 0.12;
    this.camera.position.x = this.target.x * 0.4;
    this.camera.position.y = -this.target.y * 0.3;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  };

  private resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
