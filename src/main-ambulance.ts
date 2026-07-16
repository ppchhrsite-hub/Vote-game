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

    // Click anywhere to dismiss tooltip
    document.addEventListener('click', () => {
      this.hideTooltip();
    });
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
      // Otherwise, ambulance parks 55px behind the active roadblock car distance.
      if (this.roadPath) {
        const totalLength = this.roadPath.getTotalLength();
        const N = deptsArray.length;
        const startMargin = 120;
        const endMargin = 120;

        let targetDistVal = totalLength;
        if (activeIdx < N) {
          const activeCarDist = startMargin + (activeIdx * (totalLength - startMargin - endMargin)) / (N - 1);
          targetDistVal = activeCarDist - 82;
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
    const colors = ['#0284c7', '#ea580c', '#e11d48', '#16a34a', '#7c3aed', '#db2777', '#0d9488', '#ca8a04', '#4f46e5', '#2563eb'];
    const startMargin = 120;
    const endMargin = 120;

    this.departments.forEach((dept, i) => {
      // Calculate path distance for checkpoint i
      const dist = startMargin + (i * (totalLength - startMargin - endMargin)) / (N - 1);
      const pt = this.roadPath.getPointAtLength(dist);

      // Get road direction angle at this point
      const ptAhead = this.roadPath.getPointAtLength(Math.min(dist + 2, totalLength));
      const dx = ptAhead.x - pt.x;
      const dy = ptAhead.y - pt.y;
      const angleRad = Math.atan2(dy, dx);
      const angleDeg = (angleRad * 180) / Math.PI;

      // Normal perpendicular vectors matching the drawing:
      // Horizontal segment: force normal down (0, 1)
      // Vertical segment: force normal left (-1, 0)
      let nx = 0;
      let ny = 0;
      if (Math.abs(dy) < Math.abs(dx)) {
        nx = 0;
        ny = 1;
      } else {
        nx = -1;
        ny = 0;
      }

      // Calculate pull-over offset (0 at 0% progress, 28px off-road at 100% to clear the road fully)
      const offset = (dept.percentage / 100) * 28;
      const cx = pt.x + nx * offset;
      const cy = pt.y + ny * offset;

      // Status
      let status: 'cleared' | 'blocked' | 'active' = 'blocked';
      if (i < this.activeRoadblockIndex) {
        status = 'cleared';
      } else if (i === this.activeRoadblockIndex) {
        status = 'active';
      }

      // 1. Draw Civilian Car (White box with a black stripe, matching user drawing - expanded size)
      const carG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      carG.setAttribute('transform', `translate(${cx}, ${cy}) rotate(${angleDeg})`);
      carG.setAttribute('class', `civilian-car ${status}`);
      carG.style.cursor = 'pointer';

      // Tooltip title
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${i + 1}. ${dept.name} (${dept.percentage}% - ${status === 'cleared' ? 'หลบข้างทางแล้ว' : 'กำลังขวางทาง'})`;
      carG.appendChild(title);

      // Wheels (Top-down alignment)
      const wTL = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      wTL.setAttribute('x', '-18'); wTL.setAttribute('y', '-15'); wTL.setAttribute('width', '9'); wTL.setAttribute('height', '3'); wTL.setAttribute('rx', '0.8'); wTL.setAttribute('fill', '#1e293b');
      carG.appendChild(wTL);

      const wBL = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      wBL.setAttribute('x', '-18'); wBL.setAttribute('y', '12'); wBL.setAttribute('width', '9'); wBL.setAttribute('height', '3'); wBL.setAttribute('rx', '0.8'); wBL.setAttribute('fill', '#1e293b');
      carG.appendChild(wBL);

      const wTR = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      wTR.setAttribute('x', '9'); wTR.setAttribute('y', '-15'); wTR.setAttribute('width', '9'); wTR.setAttribute('height', '3'); wTR.setAttribute('rx', '0.8'); wTR.setAttribute('fill', '#1e293b');
      carG.appendChild(wTR);

      const wBR = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      wBR.setAttribute('x', '9'); wBR.setAttribute('y', '12'); wBR.setAttribute('width', '9'); wBR.setAttribute('height', '3'); wBR.setAttribute('rx', '0.8'); wBR.setAttribute('fill', '#1e293b');
      carG.appendChild(wBR);

      // Main rectangle body
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '-25');
      rect.setAttribute('y', '-13');
      rect.setAttribute('width', '50');
      rect.setAttribute('height', '26');
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', status === 'cleared' ? '#cbd5e1' : colors[i % colors.length]);
      rect.setAttribute('stroke', '#1e293b');
      rect.setAttribute('stroke-width', '1.8');
      carG.appendChild(rect);

      // Black vertical stripe (mockup signature element)
      const stripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      stripe.setAttribute('x', '5');
      stripe.setAttribute('y', '-13');
      stripe.setAttribute('width', '5');
      stripe.setAttribute('height', '26');
      stripe.setAttribute('fill', '#1e293b');
      carG.appendChild(stripe);

      // Windshield
      const glass = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glass.setAttribute('d', 'M 10,-9 L 15,-9 Q 20,-9 20,-4 L 20,4 Q 20,9 15,9 L 10,9 Z');
      glass.setAttribute('fill', '#bae6fd');
      glass.setAttribute('stroke', '#1e293b');
      glass.setAttribute('stroke-width', '1.2');
      carG.appendChild(glass);

      // White circular racing number plate badge on roof
      const badge = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      badge.setAttribute('cx', '-8');
      badge.setAttribute('cy', '0');
      badge.setAttribute('r', '7.5');
      badge.setAttribute('fill', '#ffffff');
      badge.setAttribute('stroke', '#1e293b');
      badge.setAttribute('stroke-width', '1');
      carG.appendChild(badge);

      // Department Number inside the car (centered inside badge)
      const carLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      carLabel.setAttribute('x', '-8');
      carLabel.setAttribute('y', '3.5');
      carLabel.setAttribute('font-size', '10');
      carLabel.setAttribute('font-weight', '900');
      carLabel.setAttribute('text-anchor', 'middle');
      carLabel.setAttribute('fill', '#1e293b');
      carLabel.textContent = (i + 1).toString();
      carG.appendChild(carLabel);

      // Flashing alert dot if active roadblock
      if (status === 'active') {
        const siren = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        siren.setAttribute('cx', '14');
        siren.setAttribute('cy', '0');
        siren.setAttribute('r', '4.5');
        siren.setAttribute('fill', '#ef4444');
        siren.setAttribute('id', 'siren-red'); // flashing red alert siren!
        carG.appendChild(siren);
      }

      // Interactive tooltip event listeners
      carG.addEventListener('mouseenter', () => {
        this.showTooltip(dept, i, carG);
      });
      carG.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
      carG.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent document click from hiding tooltip immediately
        this.soundManager.playClick();
        this.showTooltip(dept, i, carG);
      });

      this.obstaclesGroup.appendChild(carG);

      // 2. Draw Checkpoint Label opposite to the pull-over shoulder (Y-offset is -45px or X-offset is 45px)
      const lx = pt.x - nx * 45;
      const ly = pt.y - ny * 45;

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', lx.toString());
      label.setAttribute('y', ly.toString());
      
      let labelClass = 'pending';
      if (dept.percentage === 100) {
        labelClass = 'cleared';
      } else if (i === this.activeRoadblockIndex) {
        labelClass = 'active';
      }
      label.setAttribute('class', `road-label ${labelClass}`);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '11.5px');
      label.setAttribute('font-weight', '800');
      
      // Shorten name if too long for map display
      let shortName = dept.name;
      if (shortName.length > 9) {
        shortName = shortName.substring(0, 8) + '..';
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

  // Interactive Map HTML Tooltip Helper methods
  private showTooltip(dept: DepartmentData, index: number, targetElement: SVGElement): void {
    let tooltip = document.getElementById('map-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'map-tooltip';
      tooltip.className = 'map-tooltip';
      document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
      <div class="map-tooltip-title">${index + 1}. ${dept.name}</div>
      <div class="map-tooltip-stat">ใช้สิทธิ์: <b>${dept.voted} / ${dept.total} คน</b></div>
      <div class="map-tooltip-stat">คิดเป็น: <b style="color: var(--color-primary-light);">${dept.percentage}%</b></div>
      <div class="map-tooltip-status" style="color: ${dept.percentage === 100 ? '#16a34a' : '#ea580c'}">
        ${dept.percentage === 100 ? '🟢 หลบข้างทางแล้ว' : '🔴 กำลังจอดขวางทางอยู่'}
      </div>
    `;

    const rect = targetElement.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + window.scrollX;
    const y = rect.top + window.scrollY - 8;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.classList.add('visible');
  }

  private hideTooltip(): void {
    const tooltip = document.getElementById('map-tooltip');
    if (tooltip) {
      tooltip.classList.remove('visible');
    }
  }
}

// Instantiate
new AmbulanceDashboard();
