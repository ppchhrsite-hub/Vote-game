import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class GameEngine {
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public renderer!: THREE.WebGLRenderer;
  public controls!: OrbitControls;
  private container!: HTMLElement;

  // Day/Night Cycle State
  public dayTime: number = 8.0; // Starts at 8:00 AM (0 to 24 hours)
  public dayCount: number = 1;

  
  // Lights
  private sunLight!: THREE.DirectionalLight;
  private moonLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private hemisphereLight!: THREE.HemisphereLight;

  // Environment & Weather
  public weather: 'sunny' | 'rainy' | 'foggy' = 'sunny';
  private rainParticles: THREE.Points | null = null;
  private skyColor: THREE.Color = new THREE.Color();

  // Callbacks for UI updates
  private onTimeUpdateCallback?: (timeStr: string, dayStr: string) => void;
  private onWeatherUpdateCallback?: (weatherStr: string) => void;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);

    this.initThree(container);
    this.initLights();
    this.initEnvironment();
    this.setupResizeHandler();
    this.animate();
  }

  private initThree(container: HTMLElement): void {
    this.container = container;
    
    // Scene - Light Sky Blue for White Mode
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe0f2fe);
    this.scene.fog = new THREE.FogExp2(0xe0f2fe, 0.003);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Camera - Telephoto FOV (17 degrees) for flat orthographic-like alignment
    this.camera = new THREE.PerspectiveCamera(17, width / height, 1, 1000);
    this.camera.position.set(0, 31, 35);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableRotate = false; // Lock rotation!
    this.controls.enablePan = false;    // Lock panning!
    this.controls.enableZoom = false;   // Lock zooming completely!
    this.controls.target.set(0, 0, 0.5); // Shifted to center zoomed grid vertically
  }

  private initLights(): void {
    // Ambient Light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    // Hemisphere Light (sky/ground colors)
    this.hemisphereLight = new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.5);
    this.scene.add(this.hemisphereLight);

    // Sun Light (with shadows)
    this.sunLight = new THREE.DirectionalLight(0xfff8e7, 1.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 150;
    
    const d = 40;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Moon Light (soft blue, no shadows for performance)
    this.moonLight = new THREE.DirectionalLight(0x5577aa, 0.2);
    this.scene.add(this.moonLight);
  }

  private initEnvironment(): void {
    // Create the Main Floating Island (visual only)
    this.createFloatingIsland();
  }

  private createFloatingIsland(): void {
    const islandGroup = new THREE.Group();
    islandGroup.position.set(0, -0.5, 0);

    // Grassy top (the actual surface) - Square box to fit 6x6 grid tightly
    const topGeom = new THREE.BoxGeometry(16.5, 1.2, 16.5);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x4c8f35,
      roughness: 0.8,
      metalness: 0.1
    });
    const topMesh = new THREE.Mesh(topGeom, topMat);
    topMesh.receiveShadow = true;
    islandGroup.add(topMesh);

    // Rocky dirt bottom (tapering down) - Upside-down square pyramid
    const bottomGeom = new THREE.ConeGeometry(12.0, 6.0, 4);
    const bottomMat = new THREE.MeshStandardMaterial({
      color: 0x4a3621,
      roughness: 0.9,
      bumpScale: 0.2
    });
    const bottomMesh = new THREE.Mesh(bottomGeom, bottomMat);
    bottomMesh.position.y = -3.6;
    bottomMesh.rotation.y = Math.PI / 4; // Align sides with the box
    bottomMesh.rotation.x = Math.PI; // upside down
    islandGroup.add(bottomMesh);

    this.scene.add(islandGroup);
  }


  private setupResizeHandler(): void {
    window.addEventListener('resize', () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  public setCallbacks(
    timeCallback: (timeStr: string, dayStr: string) => void,
    weatherCallback: (weatherStr: string) => void
  ): void {
    this.onTimeUpdateCallback = timeCallback;
    this.onWeatherUpdateCallback = weatherCallback;
    // Initial call
    this.updateUI();
  }

  public triggerWeatherChange(newWeather: 'sunny' | 'rainy' | 'foggy'): void {
    this.weather = newWeather;
    
    // Manage Rain Particles
    if (newWeather === 'rainy') {
      this.createRainSystem();
    } else {
      this.removeRainSystem();
    }

    if (this.onWeatherUpdateCallback) {
      this.onWeatherUpdateCallback(newWeather.charAt(0).toUpperCase() + newWeather.slice(1));
    }
  }

  private createRainSystem(): void {
    this.removeRainSystem();

    const particleCount = 1200;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Area centered on the island
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 40; // Height
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      velocities[i] = 0.2 + Math.random() * 0.3; // speed down
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Simple raindrop material
    // Use a small canvas-generated dot texture for particle transparency
    const pMat = new THREE.PointsMaterial({
      color: 0x88ccff,
      size: 0.25,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.rainParticles = new THREE.Points(geom, pMat);
    this.rainParticles.userData = { velocities };
    this.scene.add(this.rainParticles);
  }

  private removeRainSystem(): void {
    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainParticles.geometry.dispose();
      if (Array.isArray(this.rainParticles.material)) {
        this.rainParticles.material.forEach(m => m.dispose());
      } else {
        this.rainParticles.material.dispose();
      }
      this.rainParticles = null;
    }
  }

  private updateRainSystem(): void {
    if (!this.rainParticles) return;

    const geom = this.rainParticles.geometry;
    const positions = geom.attributes.position.array as Float32Array;
    const velocities = this.rainParticles.userData.velocities;
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] -= velocities[i] * 1.5; // Move down

      // Wrap around
      if (positions[i * 3 + 1] < -2) {
        positions[i * 3 + 1] = 40;
        positions[i * 3] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      }
    }

    geom.attributes.position.needsUpdate = true;
  }

  private updateDayNightCycle(_deltaTime: number): void {
    // Lock time to noon for permanent light mode bright illumination
    this.dayTime = 12.0;
    this.updateUI();

    // Position Sun high up
    const sunDist = 50;
    this.sunLight.position.set(0, sunDist, sunDist * 0.5);

    // Apply high day intensities
    this.sunLight.intensity = 1.3;
    this.moonLight.intensity = 0.0;
    this.ambientLight.intensity = 0.65;
    this.hemisphereLight.intensity = 0.75;

    // Apply bright sky color for light mode
    this.skyColor.setHex(0xe0f2fe);
    this.scene.background = this.skyColor;

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.skyColor);
      this.scene.fog.density = 0.003; // Clear bright atmosphere
    }
  }

  private updateUI(): void {
    if (!this.onTimeUpdateCallback) return;

    const hoursInt = Math.floor(this.dayTime);
    const minsInt = Math.floor((this.dayTime - hoursInt) * 60);
    const suffix = hoursInt >= 12 ? 'PM' : 'AM';
    const displayHours = hoursInt % 12 === 0 ? 12 : hoursInt % 12;
    const timeStr = `${displayHours.toString().padStart(2, '0')}:${minsInt.toString().padStart(2, '0')} ${suffix}`;
    const dayStr = `Day ${this.dayCount}`;

    this.onTimeUpdateCallback(timeStr, dayStr);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    const clock = new THREE.Clock();
    // Delta time setup
    const delta = Math.min(clock.getDelta(), 0.1) || 0.016; // limit spikes

    // Update Controls
    this.controls.update();

    // Update Day/Night Cycles
    this.updateDayNightCycle(delta);

    // Weather Effects
    this.updateRainSystem();



    // Render Scene
    this.renderer.render(this.scene, this.camera);
  };
}
