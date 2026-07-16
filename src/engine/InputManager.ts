import * as THREE from 'three';
import { GameEngine } from './GameEngine';

export interface GridInteractionEvent {
  x: number;
  z: number;
  tool: string;
}

export class InputManager {
  private engine: GameEngine;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private gridMeshes: THREE.Object3D[] = [];
  
  // Highlight Mesh
  private highlightMesh!: THREE.Mesh;
  
  // Drag detection
  private dragStartPos = { x: 0, y: 0 };
  private dragThreshold = 5; // pixels
  private isMouseDown = false;
  private activeTool: string = 'hoe';

  // Callbacks
  private onTileClickCallback?: (event: GridInteractionEvent) => void;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.createHighlightMesh();
    this.setupListeners();
  }

  private createHighlightMesh(): void {
    // Semi-transparent box to highlight active tile
    const geom = new THREE.BoxGeometry(1.95, 0.2, 1.95);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x86efac,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    });
    this.highlightMesh = new THREE.Mesh(geom, mat);
    this.highlightMesh.position.set(0, -999, 0); // Hide initially
    this.engine.scene.add(this.highlightMesh);

    // Grid wireframe boundary
    const edges = new THREE.EdgesGeometry(geom);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    this.highlightMesh.add(wireframe);
  }

  public setGridMeshes(meshes: THREE.Object3D[]): void {
    this.gridMeshes = meshes;
  }

  public setActiveTool(tool: string): void {
    this.activeTool = tool;
    
    // Update highlight color based on tool
    const mat = this.highlightMesh.material as THREE.MeshBasicMaterial;
    const wireframe = this.highlightMesh.children[0] as THREE.LineSegments;
    const lineMat = wireframe.material as THREE.LineBasicMaterial;

    if (tool === 'hoe') {
      mat.color.setHex(0xeab308); // Gold for plowing
      lineMat.color.setHex(0xeab308);
    } else if (tool === 'water') {
      mat.color.setHex(0x3b82f6); // Blue for water
      lineMat.color.setHex(0x3b82f6);
    } else if (tool === 'seed') {
      mat.color.setHex(0x22c55e); // Green for planting
      lineMat.color.setHex(0x22c55e);
    } else if (tool === 'harvest') {
      mat.color.setHex(0xa855f7); // Purple for harvest
      lineMat.color.setHex(0xa855f7);
    }
  }

  private setupListeners(): void {
    const el = this.engine.renderer.domElement;

    el.addEventListener('mousemove', (e) => this.onMouseMove(e));
    el.addEventListener('mousedown', (e) => this.onMouseDown(e));
    el.addEventListener('mouseup', (e) => this.onMouseUp(e));
  }

  public onTileClick(callback: (event: GridInteractionEvent) => void): void {
    this.onTileClickCallback = callback;
  }

  private onMouseMove(e: MouseEvent): void {
    // Convert screen coordinates to normalized device coordinates (-1 to +1)
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Check intersection with grid
    this.raycaster.setFromCamera(this.mouse, this.engine.camera);
    const intersects = this.raycaster.intersectObjects(this.gridMeshes);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      // Extract position details stored in object userData
      if (hitObj.userData && hitObj.userData.gridX !== undefined) {
        // Snap highlight to grid position
        this.highlightMesh.position.set(hitObj.position.x, hitObj.position.y + 0.1, hitObj.position.z);
        this.highlightMesh.visible = true;
      }
    } else {
      // Hide highlight if not pointing at farm grid
      this.highlightMesh.visible = false;
    }
  }

  private onMouseDown(e: MouseEvent): void {
    this.isMouseDown = true;
    this.dragStartPos.x = e.clientX;
    this.dragStartPos.y = e.clientY;
  }

  private onMouseUp(e: MouseEvent): void {
    if (!this.isMouseDown) return;
    this.isMouseDown = false;

    // Check drag distance to ensure it's a click, not camera rotation
    const dx = Math.abs(e.clientX - this.dragStartPos.x);
    const dy = Math.abs(e.clientY - this.dragStartPos.y);

    if (dx < this.dragThreshold && dy < this.dragThreshold) {
      // It is a valid click!
      this.raycaster.setFromCamera(this.mouse, this.engine.camera);
      const intersects = this.raycaster.intersectObjects(this.gridMeshes);

      if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        if (hitObj.userData && hitObj.userData.gridX !== undefined) {
          const gx = hitObj.userData.gridX;
          const gz = hitObj.userData.gridZ;
          
          if (this.onTileClickCallback) {
            this.onTileClickCallback({
              x: gx,
              z: gz,
              tool: this.activeTool
            });
          }
        }
      }
    }
  }
}
