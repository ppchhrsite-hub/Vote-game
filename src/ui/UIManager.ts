import { PlayerState } from '../game/PlayerState';
import { SoundManager } from '../game/SoundManager';

export class UIManager {
  private state: PlayerState;
  private sfx: SoundManager;

  // DOM Elements
  private loadingScreen = document.getElementById('loading-screen')!;
  private loadingProgress = document.getElementById('loading-progress')!;
  
  private overallPercentageEl = document.getElementById('overall-percentage')!;
  private votedRatioEl = document.getElementById('voted-ratio')!;
  private topDepartmentEl = document.getElementById('top-department')!;
  private lastUpdateTimeEl = document.getElementById('last-update-time')!;
  private btnSyncEl = document.getElementById('btn-sync')! as HTMLButtonElement;
  private btnAudio = document.getElementById('btn-audio')!;
  private deptRankingList = document.getElementById('dept-ranking-list')!;
  private floatingContainer = document.getElementById('floating-texts-container')!;

  // Callbacks
  private onSyncClickedCallback?: () => Promise<void>;
  private onDepartmentSelectedCallback?: (deptName: string) => void;

  constructor(state: PlayerState, sfx: SoundManager) {
    this.state = state;
    this.sfx = sfx;

    this.setupListeners();
    this.updateHUD();
  }

  public hideLoader(): void {
    let prg = 0;
    const interval = setInterval(() => {
      prg += 20;
      this.loadingProgress.style.width = `${prg}%`;
      if (prg >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          this.loadingScreen.classList.add('hidden');
        }, 200);
      }
    }, 40);
  }

  private setupListeners(): void {
    // Sound Toggle
    this.btnAudio.addEventListener('click', () => {
      const isMuted = this.sfx.toggleMute();
      this.btnAudio.innerHTML = isMuted 
        ? `<span class="material-symbols-rounded">volume_off</span>`
        : `<span class="material-symbols-rounded">volume_up</span>`;
      this.sfx.playClick();
    });

    // Sync button
    this.btnSyncEl.addEventListener('click', async () => {
      this.sfx.playClick();
      this.btnSyncEl.disabled = true;
      this.btnSyncEl.innerHTML = `<span class="material-symbols-rounded">sync</span> กำลังดึงข้อมูล...`;
      
      if (this.onSyncClickedCallback) {
        await this.onSyncClickedCallback();
      }
      
      this.btnSyncEl.disabled = false;
      this.btnSyncEl.innerHTML = `<span class="material-symbols-rounded">sync</span> ดึงข้อมูลล่าสุด`;
    });
  }

  public registerSyncClick(callback: () => Promise<void>): void {
    this.onSyncClickedCallback = callback;
  }

  public registerDepartmentSelect(callback: (deptName: string) => void): void {
    this.onDepartmentSelectedCallback = callback;
  }

  // --- REBUILD STATS HUD ---
  public updateHUD(): void {
    // Overview figures
    this.overallPercentageEl.innerText = `${this.state.overallPercentage.toFixed(1)}%`;
    this.votedRatioEl.innerText = `${this.state.totalVoted} / ${this.state.totalEmployees}`;
    this.topDepartmentEl.innerText = this.state.topDepartment;
    this.lastUpdateTimeEl.innerText = this.state.lastUpdate;

    // Build Ranking List
    this.deptRankingList.innerHTML = '';
    
    if (this.state.departments.length === 0) {
      this.deptRankingList.innerHTML = `<div class="stat-sub" style="padding: 1rem; text-align: center;">ไม่มีข้อมูลแผนก</div>`;
      return;
    }

    this.state.departments.forEach((dept, index) => {
      const rank = index + 1;
      const card = document.createElement('div');
      
      const isCompleted = dept.percentage >= 100 ? 'completed' : '';
      card.className = `ranking-item ${isCompleted}`;
      
      card.innerHTML = `
        <div class="ranking-rank">${rank}</div>
        <div class="ranking-details">
          <span class="ranking-name">${dept.name}</span>
          <div class="ranking-bar-wrapper">
            <div class="ranking-bar-fill" style="width: ${dept.percentage}%"></div>
          </div>
          <div class="ranking-meta">
            <span class="ranking-voted-count">โหวตแล้ว: ${dept.voted} / ${dept.total} คน</span>
          </div>
        </div>
        <div class="ranking-percentage">${dept.percentage.toFixed(1)}%</div>
      `;

      card.addEventListener('click', () => {
        this.sfx.playClick();
        
        // Toggle selected styling
        const items = this.deptRankingList.querySelectorAll('.ranking-item');
        items.forEach(item => item.classList.remove('selected'));
        card.classList.add('selected');

        if (this.onDepartmentSelectedCallback) {
          this.onDepartmentSelectedCallback(dept.name);
        }
      });

      this.deptRankingList.appendChild(card);
    });
  }

  // Highlight a department in the list when its 3D tile is clicked
  public selectDepartmentInList(deptName: string): void {
    const items = this.deptRankingList.querySelectorAll('.ranking-item');
    items.forEach((item) => {
      const nameSpan = item.querySelector('.ranking-name') as HTMLElement;
      if (nameSpan && nameSpan.innerText === deptName) {
        item.classList.add('selected');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  // --- FLOATING TEXTS IN SCREEN SPACE ---
  public showFloatingText(text: string, screenX: number, screenY: number, type: 'coins' | 'xp' | 'water' | 'error' | 'info' = 'info'): void {
    const el = document.createElement('div');
    el.className = `floating-text float-${type}`;
    el.innerText = text;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;

    this.floatingContainer.appendChild(el);
    
    setTimeout(() => {
      el.remove();
    }, 1500);
  }

  public showFloatingNotification(text: string, type: 'coins' | 'xp' | 'water' | 'error' | 'info' = 'info'): void {
    this.showFloatingText(text, window.innerWidth / 2, window.innerHeight * 0.45, type);
  }

  // Plugs kept to avoid compiler warnings
  public registerToolChange(_callback: (tool: string) => void): void {}
  public registerUpgradePlaced(_callback: (type: 'sprinkler' | 'scarecrow') => void): void {}
  public alertShopUpdate(): void {}
  public updateTime(_timeStr: string, _dayStr: string): void {}
  public updateWeather(_weatherStr: string): void {}
}
