import * as THREE from 'three';
import { CROP_TYPES, CropDefinition } from './PlayerState';
import { ProceduralModels } from '../models/ProceduralModels';

export class Crop {
  public type: string;
  public definition: CropDefinition;
  
  public growthProgress: number = 0; // 0 to 100
  public stage: number = 0; // 0 = seed/sprout, 1 = young, 2 = growing, 3 = mature
  
  public mesh: THREE.Group;
  private parentNode: THREE.Object3D;
  
  private swayTime: number = Math.random() * 100;

  constructor(type: string, parentNode: THREE.Object3D) {
    this.type = type;
    this.definition = CROP_TYPES[type];
    this.parentNode = parentNode;

    // Create Stage 0 mesh and attach to parent tile
    this.mesh = ProceduralModels.createCropModel(type, 0);
    this.parentNode.add(this.mesh);
  }

  public update(deltaSeconds: number, isWatered: boolean, speedMultiplier: number): boolean {
    if (this.growthProgress >= 100) {
      // Already fully grown, just animate it swaying
      this.animateSway(deltaSeconds);
      return false; // No growth stage change
    }

    // Only grows when watered
    if (isWatered) {
      const growthRate = (100 / this.definition.growthTime) * speedMultiplier;
      this.growthProgress = Math.min(100, this.growthProgress + growthRate * deltaSeconds);
      
      // Determine new stage
      let newStage = 0;
      if (this.growthProgress >= 100) newStage = 3;
      else if (this.growthProgress >= 66) newStage = 2;
      else if (this.growthProgress >= 33) newStage = 1;

      if (newStage !== this.stage) {
        this.stage = newStage;
        this.rebuildMesh();
        return true; // Growth stage changed!
      }
    }

    return false;
  }

  public updateProgress(progress: number): boolean {
    this.growthProgress = progress;
    let newStage = 0;
    if (this.growthProgress >= 100) newStage = 3;
    else if (this.growthProgress >= 66) newStage = 2;
    else if (this.growthProgress >= 33) newStage = 1;

    if (newStage !== this.stage) {
      this.stage = newStage;
      this.rebuildMesh();
      return true;
    }
    return false;
  }

  private animateSway(deltaSeconds: number): void {
    if (this.mesh.userData && this.mesh.userData.sway) {
      const swaySpeed = this.mesh.userData.swaySpeed || 1.0;
      const swayAmount = this.mesh.userData.swayAmount || 0.05;
      
      this.swayTime += deltaSeconds * swaySpeed;
      this.mesh.rotation.z = Math.sin(this.swayTime) * swayAmount;
      this.mesh.rotation.x = Math.cos(this.swayTime * 0.7) * (swayAmount * 0.5);
    }
  }

  public rebuildMesh(): void {
    // Remove old mesh
    this.parentNode.remove(this.mesh);
    this.disposeMesh(this.mesh);

    // Build new mesh for current stage
    this.mesh = ProceduralModels.createCropModel(this.type, this.stage);
    this.parentNode.add(this.mesh);
    
    // Tiny pop effect animation (scale up from 0)
    this.mesh.scale.set(0, 0, 0);
    const targetScale = this.type === 'pumpkin' && this.stage === 3 ? 1.1 : 1.0;
    
    // Simple lerp animation inside Threejs animate loop would be good, but we can do a quick scale set 
    // and let it grow. For simplicity, set immediately, but we can animate it.
    let currentScale = 0;
    const popAnim = () => {
      if (currentScale < targetScale) {
        currentScale += 0.1;
        if (currentScale > targetScale) currentScale = targetScale;
        this.mesh.scale.set(currentScale, currentScale, currentScale);
        requestAnimationFrame(popAnim);
      }
    };
    popAnim();
  }

  public destroy(): void {
    this.parentNode.remove(this.mesh);
    this.disposeMesh(this.mesh);
  }

  private disposeMesh(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Only dispose geometries (materials are shared/cached)
        if (child.geometry) child.geometry.dispose();
      }
    });
  }
}
