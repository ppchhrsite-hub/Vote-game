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

  // Ambulance position states (expressed in path distance units)
  private targetAmbulanceDist = 50;
  private currentAmbulanceDist = 50;

  // Currently blocking department index
  private activeRoadblockIndex = 0;

  // SVG Elements
  private roadPath!: SVGPathElement;
  private obstaclesGroup!: SVGGElement;
  private checkpointsGroup!: SVGGElement;
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
    this.obstaclesGroup = document.getElementById('obstacles-group') as any;
    this.checkpointsGroup = document.getElementById('checkpoints-group') as any;
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

      // Calculate target distance for ambulance on winding road:
      // If all 100%, ambulance arrives at hospital (totalLength).
      // Otherwise, ambulance parks 26px behind the active roadblock car distance.
      if (this.roadPath) {
        const totalLength = this.roadPath.getTotalLength();
        const N = deptsArray.length;
        const startMargin = 0.06;
        const endMargin = 0.88;

        let targetDistVal = totalLength;
        if (activeIdx < N) {
          const activeCarDist = totalLength * (startMargin + (activeIdx * (endMargin - startMargin)) / (N - 1));
          targetDistVal = activeCarDist - 26;
        }

        if (targetDistVal !== this.targetAmbulanceDist) {
          this.playSirenBeep();
        }
        this.targetAmbulanceDist = targetDistVal;
      }
      
      this.activeRoadblockIndex = activeIdx;

      // Update UI panels
      this.updateHUD();
      this.drawRoadMap();

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

  // Draw civilian cars representing each department along the winding road
  private drawRoadMap(): void {
    if (!this.obstaclesGroup || !this.checkpointsGroup || !this.roadPath) return;

    this.obstaclesGroup.innerHTML = '';
    this.checkpointsGroup.innerHTML = '';

    const totalLength = this.roadPath.getTotalLength();
    const N = this.departments.length;
    const colors = ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#06b6d4', '#475569'];
    const startMargin = 0.06;
    const endMargin = 0.88;

    this.departments.forEach((dept, i) => {
      // Calculate path distance for checkpoint i
      const dist = totalLength * (startMargin + (i * (endMargin - startMargin)) / (N - 1));
      const pt = this.roadPath.getPointAtLength(dist);

      // Get road direction angle at this point
      const ptAhead = this.roadPath.getPointAtLength(Math.min(dist + 2, totalLength));
      const dx = ptAhead.x - pt.x;
      const dy = ptAhead.y - pt.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const angleRad = Math.atan2(dy, dx);
      const angleDeg = (angleRad * 180) / Math.PI;

      // Normal perpendicular vector (pointing to the upper side of the road)
      const nx = -dy / len;
      const ny = dx / len;

      // Calculate pull-over offset (0 at 0% progress, 15px off-road at 100%)
      const offset = (dept.percentage / 100) * 15;
      const cx = pt.x + nx * offset;
      const cy = pt.y + ny * offset;

      // Status
      let status: 'cleared' | 'blocked' | 'active' = 'blocked';
      if (i < this.activeRoadblockIndex) {
        status = 'cleared';
      } else if (i === this.activeRoadblockIndex) {
        status = 'active';
      }

      // 1. Draw Civilian Car
      const carG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      carG.setAttribute('transform', `translate(${cx}, ${cy}) rotate(${angleDeg})`);
      carG.setAttribute('class', `civilian-car ${status}`);
      if (status === 'cleared') {
        carG.setAttribute('opacity', '0.65');
      }

      // Tooltip title
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${i + 1}. ${dept.name} (${dept.percentage}% - ${status === 'cleared' ? 'หลบข้างทางแล้ว' : 'กำลังขวางทาง'})`;
      carG.appendChild(title);

      // Body shadow
      const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      shadow.setAttribute('x', '-9');
      shadow.setAttribute('y', '-5');
      shadow.setAttribute('width', '18');
      shadow.setAttribute('height', '10');
      shadow.setAttribute('rx', '2.5');
      shadow.setAttribute('fill', 'rgba(0,0,0,0.12)');
      carG.appendChild(shadow);

      // Car body
      const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      body.setAttribute('x', '-8');
      body.setAttribute('y', '-4');
      body.setAttribute('width', '16');
      body.setAttribute('height', '8');
      body.setAttribute('rx', '2');
      body.setAttribute('fill', status === 'cleared' ? '#cbd5e1' : colors[i % colors.length]);
      body.setAttribute('stroke', '#475569');
      body.setAttribute('stroke-width', '0.8');
      carG.appendChild(body);

      // Windshield glass
      const glass = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      glass.setAttribute('x', '2');
      glass.setAttribute('y', '-3');
      glass.setAttribute('width', '3');
      glass.setAttribute('height', '6');
      glass.setAttribute('fill', '#e2e8f0');
      carG.appendChild(glass);

      // Windows
      const winTop = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      winTop.setAttribute('x', '-4');
      winTop.setAttribute('y', '-3.2');
      winTop.setAttribute('width', '4');
      winTop.setAttribute('height', '0.8');
      winTop.setAttribute('fill', '#334155');
      carG.appendChild(winTop);

      const winBtm = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      winBtm.setAttribute('x', '-4');
      winBtm.setAttribute('y', '2.4');
      winBtm.setAttribute('width', '4');
      winBtm.setAttribute('height', '0.8');
      winBtm.setAttribute('fill', '#334155');
      carG.appendChild(winBtm);

      // Index label text on car
      const carLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      carLabel.setAttribute('x', '0');
      carLabel.setAttribute('y', '2.2');
      carLabel.setAttribute('font-size', '6.5');
      carLabel.setAttribute('font-weight', '800');
      carLabel.setAttribute('text-anchor', 'middle');
      carLabel.setAttribute('fill', status === 'cleared' ? '#64748b' : '#ffffff');
      carLabel.textContent = (i + 1).toString();
      carG.appendChild(carLabel);

      // Flashing hazard blinkers if blocking (progress < 100%)
      if (dept.percentage < 100) {
        const hazardL = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hazardL.setAttribute('cx', '-7');
        hazardL.setAttribute('cy', '-3');
        hazardL.setAttribute('r', '1.2');
        hazardL.setAttribute('fill', '#fbbf24');
        if (status === 'active') {
          hazardL.setAttribute('id', 'siren-red'); // flash warning!
        }
        carG.appendChild(hazardL);

        const hazardR = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hazardR.setAttribute('cx', '-7');
        hazardR.setAttribute('cy', '3');
        hazardR.setAttribute('r', '1.2');
        hazardR.setAttribute('fill', '#fbbf24');
        if (status === 'active') {
          hazardR.setAttribute('id', 'siren-blue'); // flash warning!
        }
        carG.appendChild(hazardR);
      }

      this.obstaclesGroup.appendChild(carG);

      // 2. Draw Checkpoint Label opposite to the pull-over shoulder (Y-offset is -22px from road center)
      const lx = pt.x - nx * 22;
      const ly = pt.y - ny * 22;

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', lx.toString());
      label.setAttribute('y', ly.toString());
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

  // Animation Loop: Tween main ambulance position along winding road
  private animate = (): void => {
    requestAnimationFrame(this.animate);

    if (!this.roadPath || !this.ambulance) return;

    const totalLength = this.roadPath.getTotalLength();

    // Pull current distance progress towards target distance smoothly
    const easeRate = 0.04;
    const diff = this.targetAmbulanceDist - this.currentAmbulanceDist;
    
    if (Math.abs(diff) > 0.1) {
      this.currentAmbulanceDist += diff * easeRate;
    } else {
      this.currentAmbulanceDist = this.targetAmbulanceDist;
    }

    // Get winding path coordinates
    const pt = this.roadPath.getPointAtLength(this.currentAmbulanceDist);

    // Get angle
    const ptAhead = this.roadPath.getPointAtLength(Math.min(this.currentAmbulanceDist + 2, totalLength));
    const angleRad = Math.atan2(ptAhead.y - pt.y, ptAhead.x - pt.x);
    const angleDeg = (angleRad * 180) / Math.PI;

    // Apply tiny engine vibration wiggle to ambulance for extra realism
    const wiggle = Math.sin(Date.now() * 0.06) * 0.4;

    this.ambulance.setAttribute('transform', `translate(${pt.x}, ${pt.y + wiggle}) rotate(${angleDeg})`);
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
