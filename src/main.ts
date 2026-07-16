import * as THREE from 'three';
import { GameEngine } from './engine/GameEngine';
import { InputManager } from './engine/InputManager';
import { PlayerState } from './game/PlayerState';
import { FarmGrid } from './game/FarmGrid';
import { SoundManager } from './game/SoundManager';
import { WeatherManager } from './game/WeatherManager';
import { UIManager } from './ui/UIManager';

class GameApp {
  private engine: GameEngine;
  private input: InputManager;
  private state: PlayerState;
  private grid: FarmGrid;
  private sound: SoundManager;
  private weather: WeatherManager;
  private ui: UIManager;
  
  private clock: THREE.Clock;
  private autoSyncIntervalId: any = null;

  constructor() {
    this.clock = new THREE.Clock();

    // 1. Core Systems
    this.engine = new GameEngine('game-container');
    this.sound = new SoundManager();
    this.state = new PlayerState();
    
    // 2. Game World
    this.grid = new FarmGrid(this.engine);
    this.input = new InputManager(this.engine);
    this.weather = new WeatherManager(this.engine);
    
    // 3. Setup UI Overlay
    this.ui = new UIManager(this.state, this.sound);
    
    // Set default active tool in input manager to water (inspect mode)
    this.input.setActiveTool('water');

    // 4. Connect interaction events
    this.setupEventBindings();

    // 5. Initial Sync and load loader
    this.syncElectionData().then(() => {
      this.ui.hideLoader();
    });

    // 6. Set Auto-refresh interval (30 seconds)
    this.startAutoSync(30000);

    // 7. Start update tick
    this.tick();
  }

  private setupEventBindings(): void {
    // Engine day/night & weather hooks -> UI updates
    this.engine.setCallbacks(
      (timeStr, dayStr) => this.ui.updateTime(timeStr, dayStr),
      (weatherStr) => this.ui.updateWeather(weatherStr)
    );

    // Player State statistics updates -> UI HUD updates
    this.state.registerCallbacks(
      () => this.ui.updateHUD()
    );

    // Connect Sync trigger from UI button
    this.ui.registerSyncClick(async () => {
      await this.syncElectionData();
    });

    // Connect list clicks to 3D focus
    this.ui.registerDepartmentSelect((deptName) => {
      this.focusOnDepartment(deptName);
    });

    // Handle 3D Grid interactions
    this.input.onTileClick((event) => {
      this.handleTileClick(event.x, event.z);
    });
  }

  private async syncElectionData(): Promise<void> {
    const success = await this.state.fetchLiveElectionData();
    if (success) {
      // Repopulate grid with new percentages
      this.grid.updateDepartments(this.state.departments);
      // Re-hook updated clickable meshes
      this.input.setGridMeshes(this.grid.getClickableMeshes());
      
      this.ui.updateHUD();
      this.sound.playCoin();
      this.ui.showFloatingNotification('อัปเดตข้อมูลเสร็จสิ้น! 🔄', 'info');
    } else {
      this.ui.showFloatingNotification('การดึงข้อมูลล้มเหลว ❌', 'error');
    }
  }

  private startAutoSync(ms: number): void {
    if (this.autoSyncIntervalId) {
      clearInterval(this.autoSyncIntervalId);
    }
    this.autoSyncIntervalId = setInterval(async () => {
      await this.state.fetchLiveElectionData();
      this.grid.updateDepartments(this.state.departments);
      this.input.setGridMeshes(this.grid.getClickableMeshes());
      this.ui.updateHUD();
    }, ms);
  }

  private focusOnDepartment(deptName: string): void {
    let targetCell = null;
    for (let z = 0; z < this.grid.gridHeight; z++) {
      for (let x = 0; x < this.grid.gridWidth; x++) {
        const cell = this.grid.cells[z][x];
        if (cell.deptName === deptName) {
          targetCell = cell;
          break;
        }
      }
    }

    if (targetCell) {
      // Trigger water splash effect
      this.grid.waterTile(targetCell.x, targetCell.z);
      this.sound.playWater();

      // Display floating turnout text above tile
      const pos3d = new THREE.Vector3();
      targetCell.tileMesh.getWorldPosition(pos3d);
      pos3d.y += 0.9;
      pos3d.project(this.engine.camera);

      const screenX = (pos3d.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-(pos3d.y) * 0.5 + 0.5) * window.innerHeight;

      const voted = targetCell.tileMesh.userData.voted || 0;
      const total = targetCell.tileMesh.userData.total || 0;
      const pct = targetCell.tileMesh.userData.percentage || 0;

      this.ui.showFloatingText(`${deptName}: ${voted} / ${total} คน (${pct.toFixed(1)}%)`, screenX, screenY, 'water');
    }
  }

  private handleTileClick(gx: number, gz: number): void {
    const cell = this.grid.cells[gz][gx];
    
    // Project tile position to screen-space for floating texts
    const pos3d = new THREE.Vector3();
    cell.tileMesh.getWorldPosition(pos3d);
    pos3d.y += 0.9; // float slightly above
    pos3d.project(this.engine.camera);

    const screenX = (pos3d.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(pos3d.y) * 0.5 + 0.5) * window.innerHeight;

    if (cell.deptName) {
      // Trigger bounce & splash sound
      this.grid.waterTile(gx, gz);
      this.sound.playWater();

      const voted = cell.tileMesh.userData.voted || 0;
      const total = cell.tileMesh.userData.total || 0;
      const pct = cell.tileMesh.userData.percentage || 0;

      // Show float text
      this.ui.showFloatingText(`${cell.deptName}: ${voted} / ${total} คน (${pct.toFixed(1)}%)`, screenX, screenY, 'water');
      
      // Select department card in sidebar list
      this.ui.selectDepartmentInList(cell.deptName);
    } else {
      // Empty/decorative tile click
      this.grid.waterTile(gx, gz);
      this.sound.playClick();
      this.ui.showFloatingText('ตกแต่ง 🌳', screenX, screenY, 'info');
    }
  }

  private tick = (): void => {
    requestAnimationFrame(this.tick);

    const delta = Math.min(this.clock.getDelta(), 0.1) || 0.016;

    // 1. Update weather
    this.weather.update(delta);

    // 2. Update farm grid (sings, sways)
    this.grid.update(delta, 1.0);
  };
}

// Instantiate App
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
