import { SoundManager } from './game/SoundManager';

interface DepartmentData {
  name: string;
  total: number;
  voted: number;
  percentage: number;
}

class AmbulanceDashboard {
  private spreadsheetId = '1aLUltNZirflTIYn2-oqeGxpND1vXBW0fScddrDNvmJs';
  private departments: DepartmentData[] = [];
  private totalEmployees = 0;
  private totalVoted = 0;
  private overallPercentage = 0;
  private lastUpdate = '-';
  private isLoading = false;

  // Ambulance position state (0.0 to 1.0 representing overall percentage progress)
  private targetAmbulanceProgress = 0;
  private currentAmbulanceProgress = 0;

  // Currently blocking department index
  private activeRoadblockIndex = 0;

  // SVG Elements
  private roadPath!: SVGPathElement;
  private ambulance!: SVGGElement;

  // Sound Manager
  private soundManager: SoundManager;

  constructor() {
    this.soundManager = new SoundManager();
    this.initElements();
    this.bindEvents();
    
    // Start animation loop
    requestAnimationFrame(this.animate);
    
    // Initial fetch
    this.fetchData();
    
    // Set periodic sync every 30 seconds
    setInterval(() => this.fetchData(), 30000);
  }

  private initElements(): void {
    this.roadPath = document.getElementById('road-path') as any;
    this.ambulance = document.getElementById('ambulance') as any;

    if (this.ambulance) {
      this.ambulance.style.opacity = '0';
    }
  }

  private bindEvents(): void {
    // Sync Button
    const btnSync = document.getElementById('btn-sync');
    if (btnSync) {
      btnSync.addEventListener('click', () => {
        this.soundManager.playClick();
        this.fetchData();
        this.createFloatingText("ดึงข้อมูลสำเร็จ! 🔄", "float-info");
      });
    }

    // Audio Button
    const btnAudio = document.getElementById('btn-audio');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const isMuted = this.soundManager.toggleMute();
        const span = btnAudio.querySelector('span');
        if (span) {
          span.textContent = isMuted ? 'volume_off' : 'volume_up';
        }
        this.soundManager.playClick();
      });
    }

    // Lazy initialize audio contexts on click anywhere
    document.addEventListener('click', () => {
      this.soundManager.playClick();
    }, { once: true });
  }

  private async fetchData(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;
    this.updateLoadingUI(true);

    try {
      // Fetch Employees
      const empUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=employee`;
      const empRes = await fetch(empUrl);
      if (!empRes.ok) throw new Error("Failed to fetch employee list");
      const empCsv = await empRes.text();

      // Fetch Votes
      const votesUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=Votes`;
      const votesRes = await fetch(votesUrl);
      if (!votesRes.ok) throw new Error("Failed to fetch votes list");
      const votesCsv = await votesRes.text();

      // Parse datasets
      const employeesData = this.parseCSV(empCsv);
      const votesData = this.parseCSV(votesCsv);

      // Extract whitelist
      const whitelist: Array<{ id: string; dept: string }> = [];
      for (let i = 1; i < employeesData.length; i++) {
        const row = employeesData[i];
        if (row && row[0]) {
          whitelist.push({
            id: String(row[0]).trim(),
            dept: String(row[3]).trim()
          });
        }
      }

      // Extract voted map
      const votedIds: Record<string, boolean> = {};
      for (let j = 1; j < votesData.length; j++) {
        const row = votesData[j];
        if (row && row[1]) {
          const empId = String(row[1]).trim();
          if (empId) {
            votedIds[empId] = true;
          }
        }
      }

      // Group and aggregate by department
      const deptMap: Record<string, DepartmentData> = {};
      let votedCount = 0;

      whitelist.forEach(emp => {
        const dName = emp.dept || "ไม่ระบุแผนก";
        if (!deptMap[dName]) {
          deptMap[dName] = {
            name: dName,
            total: 0,
            voted: 0,
            percentage: 0
          };
        }
        deptMap[dName].total++;
        if (votedIds[emp.id]) {
          deptMap[dName].voted++;
          votedCount++;
        }
      });

      // Calculate percentages
      const deptsArray: DepartmentData[] = [];
      for (const name in deptMap) {
        const d = deptMap[name];
        d.percentage = d.total > 0 ? Math.round((d.voted / d.total) * 100 * 10) / 10 : 0;
        deptsArray.push(d);
      }

      // Sort alphabetically by department name
      deptsArray.sort((a, b) => a.name.localeCompare(b.name, 'th'));

      // Set State
      this.departments = deptsArray;
      this.totalEmployees = 181; // Locked to 181 employees total for overall progress
      this.totalVoted = votedCount;
      
      // Calculate overall progress out of 181 employees
      this.overallPercentage = this.totalEmployees > 0 ? Math.min(Math.round((this.totalVoted / this.totalEmployees) * 100 * 10) / 10, 100) : 0;
      
      this.lastUpdate = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';

      // Determine active roadblock index (first department that has < 100% data entry)
      let activeIdx = deptsArray.length;
      for (let i = 0; i < deptsArray.length; i++) {
        if (deptsArray[i].percentage < 100) {
          activeIdx = i;
          break;
        }
      }

      // Update target progress for main ambulance (0.0 to 1.0)
      const targetProg = this.overallPercentage / 100;
      if (targetProg !== this.targetAmbulanceProgress) {
        this.playSirenBeep();
      }
      this.targetAmbulanceProgress = targetProg;
      this.activeRoadblockIndex = activeIdx;

      // Update UI panels
      this.updateHUD();
      this.buildSidebar();

      // Hide loading screen
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.classList.add('hidden');
      }

    } catch (e) {
      console.error("Error loading data:", e);
      this.createFloatingText("ดึงข้อมูลล้มเหลว ❌", "float-error");
    } finally {
      this.isLoading = false;
      this.updateLoadingUI(false);
    }
  }

  private updateHUD(): void {
    const overallEl = document.getElementById('overall-percentage');
    const votedEl = document.getElementById('voted-ratio');
    const roadblockEl = document.getElementById('active-roadblock');
    const syncTimeEl = document.getElementById('last-update-time');

    if (overallEl) overallEl.textContent = `${this.overallPercentage.toFixed(1)}%`;
    if (votedEl) votedEl.textContent = `${this.totalVoted} / ${this.totalEmployees}`;
    
    if (roadblockEl) {
      if (this.activeRoadblockIndex < this.departments.length) {
        const activeDept = this.departments[this.activeRoadblockIndex];
        roadblockEl.textContent = `${this.activeRoadblockIndex + 1}. ${activeDept.name}`;
      } else {
        roadblockEl.textContent = "Mission Saved! 🎉";
        roadblockEl.style.color = 'var(--color-primary)';
      }
    }
    
    if (syncTimeEl) syncTimeEl.textContent = this.lastUpdate;
  }

  private buildSidebar(): void {
    const listEl = document.getElementById('dept-ranking-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    this.departments.forEach((dept, i) => {
      let status: 'cleared' | 'blocked' | 'active' = 'blocked';
      if (i < this.activeRoadblockIndex) {
        status = 'cleared';
      } else if (i === this.activeRoadblockIndex) {
        status = 'active';
      }

      const item = document.createElement('div');
      item.className = `ranking-item ${status}`;
      
      let badgeText = `${i + 1}`;
      if (status === 'cleared') badgeText = '✓';
      else if (status === 'active') badgeText = '🚑';

      // Options A: Mini-Road Track calculations
      const progressWidth = 8 + (dept.percentage / 100) * 170;
      const ambulancePos = 8 + (dept.percentage / 100) * 155;

      item.innerHTML = `
        <div class="ranking-rank">${badgeText}</div>
        <div class="ranking-details">
          <div class="ranking-name">${dept.name}</div>
          
          <!-- Mini Winding/Straight Road Track -->
          <svg class="mini-road-svg" viewBox="0 0 200 24" width="100%">
            <!-- Road Line Background -->
            <line x1="8" y1="12" x2="192" y2="12" stroke="#e2e8f0" stroke-width="8" stroke-linecap="round" />
            <!-- Voted Green/Blue Fill progress -->
            <line x1="8" y1="12" x2="${progressWidth}" stroke="${dept.percentage === 100 ? '#22c55e' : '#38bdf8'}" stroke-width="8" stroke-linecap="round" />
            <!-- Clinic emoji target at the end -->
            <text x="180" y="16" font-size="11">🏥</text>
            <!-- Ambulance driver emoji sliding -->
            <text x="${ambulancePos}" y="16" font-size="12" class="${status === 'active' ? 'mini-ambulance-siren' : ''}">🚑</text>
          </svg>
          
          <div class="ranking-meta">
            <span>ใช้สิทธิ์แล้ว ${dept.voted} / ${dept.total} คน</span>
            <span>${status === 'active' ? 'กำลังส่งผู้ป่วย! 🚨' : (status === 'cleared' ? 'ส่งสำเร็จ 🟢' : 'รอออกปฏิบัติการ ⏳')}</span>
          </div>
        </div>
        <div class="ranking-percentage">${dept.percentage}%</div>
      `;

      item.addEventListener('click', () => {
        this.soundManager.playClick();
        this.createFloatingText(`${dept.name}: ${dept.percentage}% (โหวตแล้ว ${dept.voted}/${dept.total})`, "float-info");
      });

      listEl.appendChild(item);
    });
  }

  // Animation Loop: Tween main ambulance position along straight road
  private animate = (): void => {
    requestAnimationFrame(this.animate);

    if (!this.roadPath || !this.ambulance) return;

    const totalLength = this.roadPath.getTotalLength();

    // Pull current progress towards target progress smoothly
    const easeRate = 0.04;
    const diff = this.targetAmbulanceProgress - this.currentAmbulanceProgress;
    
    if (Math.abs(diff) > 0.001) {
      this.currentAmbulanceProgress += diff * easeRate;
    } else {
      this.currentAmbulanceProgress = this.targetAmbulanceProgress;
    }

    // Get straight line coordinates
    const dist = this.currentAmbulanceProgress * totalLength;
    const pt = this.roadPath.getPointAtLength(dist);

    // Apply tiny engine vibration wiggle to ambulance for extra realism
    const wiggle = Math.sin(Date.now() * 0.06) * 0.4;

    this.ambulance.setAttribute('transform', `translate(${pt.x}, ${pt.y + wiggle}) rotate(0)`);
    this.ambulance.style.opacity = '1';
  };

  private parseCSV(text: string): string[][] {
    const result: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let entry = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          entry += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(entry);
        entry = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(entry);
        result.push(row);
        row = [];
        entry = '';
      } else {
        entry += char;
      }
    }
    if (entry || row.length > 0) {
      row.push(entry);
      result.push(row);
    }
    return result;
  }

  private updateLoadingUI(show: boolean): void {
    const progressEl = document.getElementById('loading-progress');
    if (progressEl) {
      progressEl.style.width = show ? '60%' : '100%';
    }
  }

  private playSirenBeep(): void {
    const ctx = (this.soundManager as any).ctx;
    if (!ctx || this.soundManager.getMutedState()) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(550, ctx.currentTime);
      osc.frequency.setValueAtTime(850, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.warn("Could not play custom siren sfx:", e);
    }
  }

  private createFloatingText(text: string, type: string): void {
    const container = document.getElementById('floating-texts-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `floating-text ${type}`;
    el.textContent = text;
    el.style.left = '50%';
    el.style.top = '40%';

    container.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
}

// Instantiate
new AmbulanceDashboard();
