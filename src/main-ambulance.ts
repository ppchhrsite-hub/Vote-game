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

  // Ambulance position state
  private activeRoadblockIndex = 0; // 0 to N
  private currentAmbulanceProgress = 0; // float tweening to activeRoadblockIndex

  // SVG Elements
  private roadPath!: SVGPathElement;
  private checkpointsGroup!: SVGGElement;
  private obstaclesGroup!: SVGGElement;
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
    this.checkpointsGroup = document.getElementById('checkpoints-group') as any;
    this.obstaclesGroup = document.getElementById('obstacles-group') as any;
    this.ambulance = document.getElementById('ambulance') as any;

    // Set initial ambulance opacity to 0 until path length is calculated
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
      // Triggers internal context resume
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
      this.totalEmployees = whitelist.length;
      this.totalVoted = votedCount;
      this.overallPercentage = this.totalEmployees > 0 ? Math.round((this.totalVoted / this.totalEmployees) * 100 * 10) / 10 : 0;
      this.lastUpdate = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';

      // Determine active roadblock index (first department that has < 100% data entry)
      let activeIdx = deptsArray.length; // Defaults to hospital if all 100%
      for (let i = 0; i < deptsArray.length; i++) {
        if (deptsArray[i].percentage < 100) {
          activeIdx = i;
          break;
        }
      }

      // Trigger siren sound effect if roadblock changes
      if (activeIdx !== this.activeRoadblockIndex) {
        this.playSirenBeep();
      }
      this.activeRoadblockIndex = activeIdx;

      // Update UI panels
      this.updateHUD();
      this.drawRoadMap();
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

  private drawRoadMap(): void {
    if (!this.roadPath) return;

    // Clear dynamic SVGs
    this.checkpointsGroup.innerHTML = '';
    this.obstaclesGroup.innerHTML = '';

    const totalLength = this.roadPath.getTotalLength();
    const N = this.departments.length;
    const startMargin = 0.08;
    const endMargin = 0.90;

    this.departments.forEach((dept, i) => {
      // Calculate path distance for checkpoint i
      const dist = totalLength * (startMargin + (i * (endMargin - startMargin)) / (N - 1));
      const pt = this.roadPath.getPointAtLength(dist);

      // Get road rotation angle at this point
      const ptAhead = this.roadPath.getPointAtLength(Math.min(dist + 2, totalLength));
      const angleRad = Math.atan2(ptAhead.y - pt.y, ptAhead.x - pt.x);
      const angleDeg = (angleRad * 180) / Math.PI;

      // Status
      let status: 'cleared' | 'blocked' | 'active' = 'blocked';
      if (i < this.activeRoadblockIndex) {
        status = 'cleared';
      } else if (i === this.activeRoadblockIndex) {
        status = 'active';
      }

      // 1. Draw Checkpoint Dot
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pt.x.toString());
      circle.setAttribute('cy', pt.y.toString());
      circle.setAttribute('r', status === 'active' ? '6.5' : '5');
      circle.setAttribute('class', `checkpoint-node ${status}`);
      
      // Hover details
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${dept.name} (${dept.percentage}%)`;
      circle.appendChild(title);
      this.checkpointsGroup.appendChild(circle);

      // 2. Draw Gate/Obstacle
      const gateGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gateGroup.setAttribute('class', `barrier-gate ${status}`);
      gateGroup.setAttribute('transform', `translate(${pt.x}, ${pt.y}) rotate(${angleDeg + 90})`);

      // Swing angle: 0 degrees is fully closed, -80 degrees is fully open (swung up)
      const gateAngle = -80 * (dept.percentage / 100);
      const gateOpacity = 1.0 - 0.75 * (dept.percentage / 100);
      gateGroup.setAttribute('opacity', gateOpacity.toString());

      // Base post at the left side of the road
      const postLeft = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      postLeft.setAttribute('cx', '-12');
      postLeft.setAttribute('cy', '0');
      postLeft.setAttribute('r', '3.5');
      postLeft.setAttribute('fill', '#475569');
      gateGroup.appendChild(postLeft);

      // Swing arm group pivoting around (-12, 0)
      const armGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      armGroup.setAttribute('transform', `translate(-12, 0) rotate(${gateAngle})`);

      // Orange gate bar
      const barRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      barRect.setAttribute('x', '-2');
      barRect.setAttribute('y', '-2.5');
      barRect.setAttribute('width', '25');
      barRect.setAttribute('height', '5');
      barRect.setAttribute('rx', '1');
      barRect.setAttribute('fill', '#f97316'); // Orange base
      armGroup.appendChild(barRect);

      // White stripes overlay (3)
      for (const offset of [2, 10, 18]) {
        const stripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        stripe.setAttribute('x', offset.toString());
        stripe.setAttribute('y', '-2.5');
        stripe.setAttribute('width', '4');
        stripe.setAttribute('height', '5');
        stripe.setAttribute('fill', '#ffffff');
        armGroup.appendChild(stripe);
      }

      // Warning warning light on top of the tip
      const warnLight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      warnLight.setAttribute('cx', '20');
      warnLight.setAttribute('cy', '0');
      warnLight.setAttribute('r', '3');
      
      if (status === 'active') {
        warnLight.setAttribute('fill', '#ef4444');
        warnLight.setAttribute('id', 'siren-red'); // will animate/flash red!
      } else if (status === 'cleared') {
        warnLight.setAttribute('fill', '#22c55e');
      } else {
        warnLight.setAttribute('fill', '#ef4444');
      }
      armGroup.appendChild(warnLight);

      gateGroup.appendChild(armGroup);
      this.obstaclesGroup.appendChild(gateGroup);

      // 3. Label Text (alternating above and below path to avoid overlaps)
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const yOffset = i % 2 === 0 ? -22 : 22;
      label.setAttribute('x', pt.x.toString());
      label.setAttribute('y', (pt.y + yOffset).toString());
      label.setAttribute('class', `road-label ${status}`);
      label.setAttribute('text-anchor', 'middle');
      
      // Shorten name if too long for map display
      let shortName = dept.name;
      if (shortName.length > 8) {
        shortName = shortName.substring(0, 7) + '..';
      }
      label.textContent = `${i + 1}.${shortName} (${dept.percentage}%)`;
      this.checkpointsGroup.appendChild(label);
    });
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
      
      // Badge text
      let badgeText = `${i + 1}`;
      if (status === 'cleared') badgeText = '✓';
      else if (status === 'active') badgeText = '🚑';

      item.innerHTML = `
        <div class="ranking-rank">${badgeText}</div>
        <div class="ranking-details">
          <div class="ranking-name">${dept.name}</div>
          <div class="ranking-bar-wrapper">
            <div class="ranking-bar-fill" style="width: ${dept.percentage}%"></div>
          </div>
          <div class="ranking-meta">
            <span>ใช้สิทธิ์แล้ว ${dept.voted} / ${dept.total} คน</span>
            <span>${status === 'active' ? 'กำลังปิดถนน! 🚧' : (status === 'cleared' ? 'เคลียร์แล้ว 🟢' : 'รอดำเนินการ ⏳')}</span>
          </div>
        </div>
        <div class="ranking-percentage">${dept.percentage}%</div>
      `;

      item.addEventListener('click', () => {
        this.soundManager.playClick();
        this.highlightMapNode(i);
      });

      listEl.appendChild(item);
    });
  }

  private highlightMapNode(index: number): void {
    const totalLength = this.roadPath.getTotalLength();
    const startMargin = 0.08;
    const endMargin = 0.90;
    const N = this.departments.length;
    
    const dist = totalLength * (startMargin + (index * (endMargin - startMargin)) / (N - 1));
    const pt = this.roadPath.getPointAtLength(dist);

    // Trigger local text flash at coordinate
    const dept = this.departments[index];
    this.createFloatingText(`${dept.name}: ${dept.percentage}%`, "float-info", pt.x, pt.y);
  }

  // Linear interpolation logic for smooth driving
  private animate = (): void => {
    requestAnimationFrame(this.animate);

    if (!this.roadPath || !this.ambulance) return;

    const totalLength = this.roadPath.getTotalLength();
    const N = this.departments.length;

    // Pull current progress towards active target roadblock smoothly
    const easeRate = 0.04;
    const diff = this.activeRoadblockIndex - this.currentAmbulanceProgress;
    
    if (Math.abs(diff) > 0.002) {
      this.currentAmbulanceProgress += diff * easeRate;
    } else {
      this.currentAmbulanceProgress = this.activeRoadblockIndex;
    }

    // Get path coordinates for current progress
    const dist = this.getDistForProgress(this.currentAmbulanceProgress, totalLength, N);
    const pt = this.roadPath.getPointAtLength(dist);

    // Get angle
    const ptAhead = this.roadPath.getPointAtLength(Math.min(dist + 2, totalLength));
    const angleRad = Math.atan2(ptAhead.y - pt.y, ptAhead.x - pt.x);
    const angleDeg = (angleRad * 180) / Math.PI;

    // Set position and rotation
    this.ambulance.setAttribute('transform', `translate(${pt.x}, ${pt.y}) rotate(${angleDeg})`);
    this.ambulance.style.opacity = '1'; // Show once position is computed
  };

  private getDistForProgress(progress: number, totalLength: number, N: number): number {
    const startMargin = 0.08;
    const endMargin = 0.90;
    
    if (progress <= 0) return 0;
    if (progress >= N) return totalLength; // Arrived at Hospital

    const idx = Math.floor(progress);
    const frac = progress - idx;

    const dist1 = totalLength * (startMargin + (idx * (endMargin - startMargin)) / (N - 1));
    const dist2 = totalLength * (startMargin + ((idx + 1) * (endMargin - startMargin)) / (N - 1));

    return dist1 + (dist2 - dist1) * frac;
  }

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
    // Siren audio effect using SoundManager context
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

  private createFloatingText(text: string, type: string, x?: number, y?: number): void {
    const container = document.getElementById('floating-texts-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `floating-text ${type}`;
    el.textContent = text;

    // If coordinates are provided, place absolute in viewport. Else center screen.
    if (x !== undefined && y !== undefined) {
      // Find SVG parent client rect to map coordinate relative to screen
      const svg = document.getElementById('road-svg');
      if (svg) {
        const rect = svg.getBoundingClientRect();
        // Since viewport coordinates are 1000x480, scale to actual screen size
        const scaleX = rect.width / 1000;
        const scaleY = rect.height / 480;
        
        el.style.left = `${rect.left + window.scrollX + x * scaleX}px`;
        el.style.top = `${rect.top + window.scrollY + y * scaleY}px`;
      }
    } else {
      el.style.left = '50%';
      el.style.top = '40%';
    }

    container.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
}

// Instantiate
new AmbulanceDashboard();
