import * as THREE from 'three';
import { GameEngine } from '../engine/GameEngine';
import { Crop } from './Crop';
import { ProceduralModels } from '../models/ProceduralModels';

export interface GridCell {
  x: number;
  z: number;
  state: 'grass' | 'plowed' | 'watered';
  waterLevel: number; // 0 to 100
  crop: Crop | null;
  helper: 'sprinkler' | 'scarecrow' | null;
  helperMesh: THREE.Group | null;
  tileMesh: THREE.Mesh;
  deptName?: string; // New field for mapping to department name
}

export class FarmGrid {
  private engine: GameEngine;
  public gridWidth: number = 6;
  public gridHeight: number = 6;
  public cellSize: number = 2.4;
  
  public cells: GridCell[][] = [];
  private tileGroup: THREE.Group;
  
  // Materials cached for transitions
  private grassMat!: THREE.MeshStandardMaterial;
  private drySoilMat!: THREE.MeshStandardMaterial;
  private wetSoilMat!: THREE.MeshStandardMaterial;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.tileGroup = new THREE.Group();
    this.tileGroup.name = 'farm-grid';
    this.engine.scene.add(this.tileGroup);

    this.initMaterials();
    this.createGrid();
    this.createSurroundings();
  }

  private initMaterials(): void {
    this.grassMat = new THREE.MeshStandardMaterial({
      color: 0x55a630, // Vibrant grass green
      roughness: 0.9,
      metalness: 0.05
    });

    this.drySoilMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033, // Warm brown
      roughness: 0.85
    });

    this.wetSoilMat = new THREE.MeshStandardMaterial({
      color: 0x2b1d0c, // Deep rich wet brown
      roughness: 0.8
    });
  }

  private createGrid(): void {
    const halfW = (this.gridWidth - 1) / 2;
    const halfH = (this.gridHeight - 1) / 2;

    const tileGeom = new THREE.BoxGeometry(2.32, 0.2, 2.32);

    for (let z = 0; z < this.gridHeight; z++) {
      this.cells[z] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        // Calculate 3D position
        const posX = (x - halfW) * this.cellSize;
        const posZ = (z - halfH) * this.cellSize;
        const posY = 0.35; // slightly raised above island cylinder top

        // Create Mesh
        const mesh = new THREE.Mesh(tileGeom, this.grassMat);
        mesh.position.set(posX, posY, posZ);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        
        // Save indices in user data for Raycast identification
        mesh.userData = { gridX: x, gridZ: z };
        
        this.tileGroup.add(mesh);

        // Grid Cell structure
        this.cells[z][x] = {
          x,
          z,
          state: 'grass',
          waterLevel: 0,
          crop: null,
          helper: null,
          helperMesh: null,
          tileMesh: mesh
        };
      }
    }
  }

  private createSurroundings(): void {
    // Fences removed for clean flat straight grid view
  }

  public getClickableMeshes(): THREE.Object3D[] {
    const list: THREE.Object3D[] = [];
    for (let z = 0; z < this.gridHeight; z++) {
      for (let x = 0; x < this.gridWidth; x++) {
        list.push(this.cells[z][x].tileMesh);
      }
    }
    return list;
  }

  // --- ACTIONS ---

  public plowTile(x: number, z: number): boolean {
    const cell = this.cells[z][x];
    if (cell.state === 'grass') {
      cell.state = 'plowed';
      cell.tileMesh.material = this.drySoilMat;
      
      // Small pop/bounce on plow
      this.bounceTile(cell.tileMesh);
      return true;
    }
    return false;
  }

  public waterTile(x: number, z: number): boolean {
    const cell = this.cells[z][x];
    if (cell.state === 'plowed' || cell.state === 'watered') {
      cell.state = 'watered';
      cell.waterLevel = 100;
      cell.tileMesh.material = this.wetSoilMat;
      this.bounceTile(cell.tileMesh);
      return true;
    }
    return false;
  }

  public plantTile(x: number, z: number, cropType: string): boolean {
    const cell = this.cells[z][x];
    if ((cell.state === 'plowed' || cell.state === 'watered') && !cell.crop && !cell.helper) {
      cell.crop = new Crop(cropType, cell.tileMesh);
      this.bounceTile(cell.tileMesh);
      return true;
    }
    return false;
  }

  public harvestTile(x: number, z: number): string | null {
    const cell = this.cells[z][x];
    if (cell.crop && cell.crop.stage === 3) {
      const type = cell.crop.type;
      cell.crop.destroy();
      cell.crop = null;
      
      // Tile returns to dry plowed soil
      cell.state = 'plowed';
      cell.waterLevel = 0;
      cell.tileMesh.material = this.drySoilMat;
      
      this.bounceTile(cell.tileMesh);
      return type;
    }
    return null;
  }

  public placeHelper(x: number, z: number, type: 'sprinkler' | 'scarecrow'): boolean {
    const cell = this.cells[z][x];
    // Helper must be placed on empty plowed/watered soil (no crops, no other helper)
    if ((cell.state === 'plowed' || cell.state === 'watered') && !cell.crop && !cell.helper) {
      cell.helper = type;
      if (type === 'sprinkler') {
        cell.helperMesh = ProceduralModels.createSprinklerModel();
      } else {
        cell.helperMesh = ProceduralModels.createScarecrowModel();
      }
      // Position model on top of tile
      cell.helperMesh.position.set(0, 0.1, 0);
      cell.tileMesh.add(cell.helperMesh);
      this.bounceTile(cell.tileMesh);
      return true;
    }
    return false;
  }

  private bounceTile(mesh: THREE.Mesh): void {
    if (mesh.userData.isBouncing) return; // Prevent overlapping bounce runs
    mesh.userData.isBouncing = true;

    const baseY = 0.35;
    let animTime = 0;
    
    const bounce = () => {
      animTime += 0.25;
      if (animTime < Math.PI) {
        mesh.position.y = baseY + Math.sin(animTime) * 0.25;
        requestAnimationFrame(bounce);
      } else {
        mesh.position.y = baseY;
        mesh.userData.isBouncing = false;
      }
    };
    bounce();
  }

  // --- GRID UPDATE LOOP ---
  public update(deltaSeconds: number, gameSpeedMultiplier: number): void {
    // 1. Weather impact
    const isRaining = this.engine.weather === 'rainy';

    // 2. Loop cells
    for (let z = 0; z < this.gridHeight; z++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cell = this.cells[z][x];

        // Automatic watering if raining
        if (isRaining && (cell.state === 'plowed' || cell.state === 'watered')) {
          cell.state = 'watered';
          cell.waterLevel = Math.min(100, cell.waterLevel + 12 * deltaSeconds);
          cell.tileMesh.material = this.wetSoilMat;
        }

        // Handle water evaporation
        if (cell.state === 'watered' && !isRaining) {
          // Normal evaporation: 1.5 units per game second
          cell.waterLevel -= 1.8 * deltaSeconds * gameSpeedMultiplier;
          if (cell.waterLevel <= 0) {
            cell.waterLevel = 0;
            cell.state = 'plowed';
            cell.tileMesh.material = this.drySoilMat;
          }
        }

        // Gather surrounding modifiers (Scarecrow growth speed bonus)
        let growthSpeedBonus = 1.0;
        if (this.hasNearbyScarecrow(x, z)) {
          growthSpeedBonus = 1.35; // 35% growth speed bump
        }

        // Update active crops
        if (cell.crop) {
          const isWatered = cell.state === 'watered';
          cell.crop.update(deltaSeconds, isWatered, growthSpeedBonus * gameSpeedMultiplier);
        }

        // Run helper mechanics
        if (cell.helper === 'sprinkler') {
          // Spin nozzle animation
          if (cell.helperMesh) {
            cell.helperMesh.rotation.y += 4.5 * deltaSeconds;
          }

          // Sprinkler waters adjacent tiles every tick
          this.runSprinklerWatering(x, z, deltaSeconds);
        }
      }
    }
  }

  private runSprinklerWatering(sx: number, sz: number, deltaSeconds: number): void {
    // Water adjacent neighbors (up, down, left, right)
    const dirs = [
      [0, 1], [0, -1], [1, 0], [-1, 0]
    ];
    
    dirs.forEach(([dx, dz]) => {
      const nx = sx + dx;
      const nz = sz + dz;
      if (nx >= 0 && nx < this.gridWidth && nz >= 0 && nz < this.gridHeight) {
        const neighbor = this.cells[nz][nx];
        // Sprinkler adds water to plowed or dry-watered tiles
        if (neighbor.state === 'plowed' || neighbor.state === 'watered') {
          neighbor.state = 'watered';
          // Sprinkler waters tiles at 15 units per second
          neighbor.waterLevel = Math.min(100, neighbor.waterLevel + 15 * deltaSeconds);
          neighbor.tileMesh.material = this.wetSoilMat;
        }
      }
    });
  }

  private hasNearbyScarecrow(cx: number, cz: number): boolean {
    // Check 3x3 radius around crop
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx >= 0 && nx < this.gridWidth && nz >= 0 && nz < this.gridHeight) {
          if (this.cells[nz][nx].helper === 'scarecrow') {
            return true;
          }
        }
      }
    }
    return false;
  }

  public updateDepartments(depts: any[]): void {
    const totalSlots = this.gridWidth * this.gridHeight;
    for (let i = 0; i < totalSlots; i++) {
      const z = Math.floor(i / this.gridWidth);
      const x = i % this.gridWidth;
      const cell = this.cells[z][x];
      
      if (i < depts.length) {
        const dept = depts[i];
        cell.deptName = dept.name;
        
        cell.tileMesh.userData.gridX = x;
        cell.tileMesh.userData.gridZ = z;
        cell.tileMesh.userData.deptName = dept.name;
        cell.tileMesh.userData.voted = dept.voted;
        cell.tileMesh.userData.total = dept.total;
        cell.tileMesh.userData.percentage = dept.percentage;

        if (dept.percentage > 0) {
          cell.state = 'watered';
          cell.waterLevel = dept.percentage;
          cell.tileMesh.material = this.wetSoilMat;
        } else {
          cell.state = 'plowed';
          cell.waterLevel = 0;
          cell.tileMesh.material = this.drySoilMat;
        }

        if (!cell.crop) {
          cell.crop = new Crop('sunflower', cell.tileMesh);
        }
        cell.crop.updateProgress(dept.percentage);
      } else {
        cell.deptName = undefined;
        cell.state = 'grass';
        cell.waterLevel = 0;
        cell.tileMesh.material = this.grassMat;
        if (cell.crop) {
          cell.crop.destroy();
          cell.crop = null;
        }
      }
    }
  }
}
