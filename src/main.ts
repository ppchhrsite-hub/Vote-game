import { SoundManager } from './SoundManager';



class HospitalConstructionDashboard {
  private spreadsheetId = '1aLUltNZirflTIYn2-oqeGxpND1vXBW0fScddrDNvmJs';
  private totalEmployees = 181;
  private totalVoted = 0;
  private overallPercentage = 0;
  private lastUpdate = '-';
  
  private soundManager: SoundManager;
  private autoSyncIntervalId: any = null;
  private isSimulationMode = false;
  private lastActiveStage = -1;

  // Construction Stage info mappings (0% to 100% in 5% steps)
  private stagesInfo = [
    { title: "เตรียมพื้นที่", sub: "เฟส 0: เคลียร์หน้าดินและเตรียมอุปกรณ์เขตก่อสร้าง" },                    // 0%  (Stage 0)
    { title: "ฐานราก & เสาเข็มชั้น 1", sub: "เฟส 1: เทปูนฐานรากเสร็จสิ้น ก่อเสาโครงสร้างชั้นล่าง" },          // 5%  (Stage 1)
    { title: "ผนังคอนกรีตชั้น 1", sub: "เฟส 2: ขึ้นผนังคอนกรีตบล็อกและเตรียมงานประตูทางเข้าชั้น 1" },          // 10% (Stage 2)
    { title: "พื้นคอนกรีตชั้น 2", sub: "เฟส 3: เทคานและแผ่นพื้นคอนกรีตขึ้นรูปชั้น 2" },                    // 15% (Stage 3)
    { title: "โครงสร้างเสาค้ำชั้น 2", sub: "เฟส 4: ตั้งเสาค้ำยันและคานหลักรับน้ำหนักของชั้น 2" },            // 20% (Stage 4)
    { title: "พื้นคอนกรีตชั้น 3", sub: "เฟส 5: เทคานและแผ่นพื้นคอนกรีตขึ้นรูปชั้น 3" },                    // 25% (Stage 5)
    { title: "โครงสร้างเสาค้ำชั้น 3", sub: "เฟส 6: ตั้งเสาค้ำยันและคานหลักรับน้ำหนักของชั้น 3" },            // 30% (Stage 6)
    { title: "พื้นคอนกรีตชั้น 4", sub: "เฟส 7: เทคานและแผ่นพื้นคอนกรีตขึ้นรูปชั้น 4" },                    // 35% (Stage 7)
    { title: "โครงเสาชั้น 4 & หลังคาดาดฟ้า", sub: "เฟส 8: ตั้งเสาชั้นบนสุดและหล่อแผ่นพื้นหลังคาดาดฟ้า" },    // 40% (Stage 8)
    { title: "ห้องลิฟต์ดาดฟ้า & ราวกันตก", sub: "เฟส 9: ก่อห้องเครื่องลิฟต์และติดตั้งราวเหล็กกันตกดาดฟ้า" },  // 45% (Stage 9)
    { title: "ติดตั้งกระจกอาคาร", sub: "เฟส 10: งานติดตั้งกระจกใสบลูสกายบนกรอบหน้าต่างรอบตึกทุกชั้น" },     // 50% (Stage 10)
    { title: "ติดตั้งระแนงแต่งตึกสีน้ำเงิน", sub: "เฟส 11: ติดตั้งระแนงแนวตั้งสีน้ำเงินสวยงามเด่นชัดชั้นบน" },    // 55% (Stage 11)
    { title: "โครงเสาป้ายยักษ์ทางเข้า", sub: "เฟส 12: ก่อสร้างโครงเสาป้ายโฆษณาทางเข้าฝั่งซ้ายของโครงการ" },   // 60% (Stage 12)
    { title: "ติดตั้งหลังคากันสาดทางเข้า", sub: "เฟส 13: งานทำกันสาดล็อบบี้และติดตัวอักษรทางเข้าหลัก" },     // 65% (Stage 13)
    { title: "ป้ายแผนกฉุกเฉินและทางเข้า", sub: "เฟส 14: ติดตั้งหลังคาสีแดงแผนกฉุกเฉินและป้าย Emergency" },   // 70% (Stage 14)
    { title: "ตั้งโครงเหล็กป้ายดาดฟ้า", sub: "เฟส 15: ก่อสร้างโครงถักเหล็กและติดแผงป้ายสีน้ำเงินขนาดใหญ่บนดาดฟ้า" }, // 75% (Stage 15)
    { title: "ติดตั้งโลโก้และชื่อตึกโรงพยาบาล", sub: "เฟส 16: ติดตราสัญลักษณ์ทางการแพทย์และตัวอักษรป้ายใหญ่ดาดฟ้า" }, // 80% (Stage 16)
    { title: "ภูมิทัศน์ลานหน้าอาคาร & ป้อมยาม", sub: "เฟส 17: งานปูพื้นหญ้าเขียวหน้าตึกและติดตั้งห้องป้อมยามหน้าทางเข้า" }, // 85% (Stage 17)
    { title: "สวนหย่อมไม้ยืนต้น", sub: "เฟส 18: งานปลูกต้นไม้ร่มรื่น สวนตกแต่งด้านซ้ายและขวาของอาคาร" },    // 90% (Stage 18)
    { title: "จัดแต่งสวน & ติดตั้งเสาธง", sub: "เฟส 19: ติดตั้งเสาธงชาติ/เสาธงพยาบาล และจัดวางกระถางไม้ประดับล็อบบี้" }, // 95% (Stage 19)
    { title: "อาคารเสร็จสมบูรณ์พร้อมฉลอง!", sub: "เฟส 20: เปิดไฟหน้าต่างตึกสว่างไสว เคลียร์เขตก่อสร้าง เฉลิมฉลองครบร้อยเปอร์เซ็นต์!" } // 100% (Stage 20)
  ];

  constructor() {
    this.soundManager = new SoundManager();
    this.bindEvents();
    
    // Start by fetching live data
    this.syncElectionData().then(() => {
      this.hideLoader();
    });

    // Start auto sync interval (every 30 seconds)
    this.startAutoSync(30000);
  }

  private bindEvents(): void {
    // Sync Button
    const btnSync = document.getElementById('btn-sync');
    if (btnSync) {
      btnSync.addEventListener('click', () => {
        this.soundManager.playClick();
        if (!this.isSimulationMode) {
          this.syncElectionData();
        } else {
          this.createFloatingText("อยู่ในโหมดจำลอง (Manual Simulation) ❌", "float-info");
        }
      });
    }

    // Audio Mute toggle Button
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

    // Simulator slider controls
    const simToggle = document.getElementById('sim-mode-toggle') as HTMLInputElement;
    const simSlider = document.getElementById('sim-percentage-slider') as HTMLInputElement;
    const modeText = document.getElementById('mode-text');

    if (simToggle && simSlider) {
      // Simulator toggle helper to enable/disable buttons
      const toggleSimButtons = (disabled: boolean) => {
        const buttons = document.querySelectorAll('.sim-btn');
        buttons.forEach(btn => {
          if (disabled) {
            btn.setAttribute('disabled', 'true');
          } else {
            btn.removeAttribute('disabled');
          }
        });
      };

      simToggle.addEventListener('change', () => {
        this.soundManager.playClick();
        this.isSimulationMode = simToggle.checked;
        
        if (this.isSimulationMode) {
          // Manual Simulation Mode active
          simSlider.removeAttribute('disabled');
          toggleSimButtons(false);
          if (modeText) {
            modeText.textContent = "โหมดทดสอบจำลอง (Simulator Mode)";
            modeText.className = "mode-text manual";
          }
          this.stopAutoSync();
          // Trigger slider update immediately
          this.updateSimulationState(parseInt(simSlider.value));
        } else {
          // Return to Live Mode
          simSlider.setAttribute('disabled', 'true');
          toggleSimButtons(true);
          if (modeText) {
            modeText.textContent = "โหมดดึงข้อมูลอัตโนมัติ (Live Mode)";
            modeText.className = "mode-text";
          }
          this.syncElectionData();
          this.startAutoSync(30000);
        }
      });

      simSlider.addEventListener('input', () => {
        if (this.isSimulationMode) {
          this.updateSimulationState(parseInt(simSlider.value));
        }
      });

      // Quick select buttons click listeners
      const simBtnGroup = document.getElementById('sim-btn-group');
      if (simBtnGroup) {
        simBtnGroup.addEventListener('click', (e) => {
          if (!this.isSimulationMode) return;
          const btn = (e.target as HTMLElement).closest('.sim-btn') as HTMLButtonElement | null;
          if (btn) {
            const pct = parseInt(btn.dataset.pct || '0');
            simSlider.value = pct.toString();
            this.updateSimulationState(pct);
          }
        });
      }
    }
  }

  // Handle simulation slider values change
  private updateSimulationState(pctValue: number): void {
    const stage = Math.min(20, Math.floor(pctValue / 5));
    
    // Play sound on stage transition
    if (stage !== this.lastActiveStage) {
      if (stage === 20) {
        this.soundManager.playCheer();
      } else {
        this.soundManager.playCoin();
      }
      this.lastActiveStage = stage;
    }

    // Update UI labels manually
    const turnoutVal = document.getElementById('overall-percentage');
    if (turnoutVal) {
      turnoutVal.textContent = pctValue.toFixed(1) + '%';
    }

    const votedRatio = document.getElementById('voted-ratio');
    if (votedRatio) {
      const simulatedVoted = Math.round((pctValue / 100) * this.totalEmployees);
      votedRatio.textContent = `${simulatedVoted} / ${this.totalEmployees}`;
    }

    // Render construction
    this.renderStage(stage);

    // Update active quick select button class styling
    const buttons = document.querySelectorAll('.sim-btn');
    buttons.forEach(btn => {
      const btnPct = parseInt((btn as HTMLElement).dataset.pct || '0');
      if (btnPct === pctValue) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  private async syncElectionData(): Promise<void> {
    this.updateLoadingUI(true);

    try {
      // Fetch Employees Whitelist
      const empUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=employee`;
      const empRes = await fetch(empUrl);
      if (!empRes.ok) throw new Error("Failed to fetch employee list");
      const empCsv = await empRes.text();

      // Fetch Votes data
      const votesUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=Votes`;
      const votesRes = await fetch(votesUrl);
      if (!votesRes.ok) throw new Error("Failed to fetch votes list");
      const votesCsv = await votesRes.text();

      // Parse csv datasets
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

      // Aggregate voted count
      let votedCount = 0;
      whitelist.forEach(emp => {
        if (votedIds[emp.id]) {
          votedCount++;
        }
      });

      this.totalVoted = votedCount;
      this.overallPercentage = this.totalEmployees > 0 ? Math.min(Math.round((this.totalVoted / this.totalEmployees) * 100 * 10) / 10, 100) : 0;
      this.lastUpdate = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';

      // Apply changes to UI
      this.updateHUD();
      
      const currentStage = Math.min(20, Math.floor(this.overallPercentage / 5));
      if (currentStage !== this.lastActiveStage) {
        if (currentStage === 20) {
          this.soundManager.playCheer();
        } else if (this.lastActiveStage !== -1) {
          this.soundManager.playCoin();
        }
        this.lastActiveStage = currentStage;
      }

      this.renderStage(currentStage);

      // Highlight the corresponding quick button under Live Mode (rounded to nearest 5%)
      const nearestPct = Math.round(this.overallPercentage / 5) * 5;
      const buttons = document.querySelectorAll('.sim-btn');
      buttons.forEach(btn => {
        const btnPct = parseInt((btn as HTMLElement).dataset.pct || '0');
        if (btnPct === nearestPct) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      this.createFloatingText("ซิงก์ข้อมูลสร้างตึกสำเร็จ! 🏗️", "float-info");

    } catch (e) {
      console.error("Sync error:", e);
      this.createFloatingText("การดึงข้อมูลล้มเหลว ❌", "float-info");
    } finally {
      this.updateLoadingUI(false);
    }
  }

  // Draw & Toggle SVG elements according to selected progress stage (0 - 20)
  private renderStage(stageNum: number): void {
    // 1. Toggle stages 1 to 20 built elements
    for (let s = 1; s <= 20; s++) {
      const layer = document.getElementById(`layer-stage-${s}`);
      if (layer) {
        if (s <= stageNum) {
          layer.classList.add('built');
        } else {
          layer.classList.remove('built');
        }
      }
    }

    // 2. Scaffolding/Cranes layer visible only when building (Stage 1 to 19)
    const scaffolding = document.getElementById('layer-scaffolding');
    if (scaffolding) {
      if (stageNum > 0 && stageNum < 20) {
        scaffolding.classList.add('active');
      } else {
        scaffolding.classList.remove('active');
      }
    }

    // 3. Stage 0 elements (zinc sheet protective fences) disappears at 100% (stage 20)
    const stage0Fence = document.getElementById('layer-stage-0');
    if (stage0Fence) {
      if (stageNum < 20) {
        stage0Fence.classList.remove('hidden');
      } else {
        stage0Fence.classList.add('hidden');
      }
    }

    // 4. Totem details (always visible once totem is built at stage 12)
    const totemDetails = document.getElementById('layer-totem-details');
    if (totemDetails) {
      if (stageNum >= 12) {
        totemDetails.classList.add('built');
      } else {
        totemDetails.classList.remove('built');
      }
    }

    // 5. Celebration overlay active only on completed building (stage 20)
    const celebration = document.getElementById('layer-celebration');
    const svgEl = document.getElementById('building-svg');
    if (celebration && svgEl) {
      if (stageNum === 20) {
        celebration.classList.add('active');
        svgEl.classList.add('completed');
      } else {
        celebration.classList.remove('active');
        svgEl.classList.remove('completed');
      }
    }

    // Update HUD Stage info labels
    const stageInfo = this.stagesInfo[stageNum];
    const stageText = document.getElementById('construction-stage-text');
    const stageSub = document.getElementById('construction-stage-sub');
    if (stageText && stageSub && stageInfo) {
      stageText.textContent = stageInfo.title;
      stageSub.textContent = stageInfo.sub;
    }
  }

  private updateHUD(): void {
    const overallPctEl = document.getElementById('overall-percentage');
    if (overallPctEl) {
      overallPctEl.textContent = this.overallPercentage.toFixed(1) + '%';
    }

    const votedRatioEl = document.getElementById('voted-ratio');
    if (votedRatioEl) {
      votedRatioEl.textContent = `${this.totalVoted} / ${this.totalEmployees}`;
    }

    const lastUpdateEl = document.getElementById('last-update-time');
    if (lastUpdateEl) {
      lastUpdateEl.textContent = this.lastUpdate;
    }
  }

  // CSV parsing logic helper
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

  private startAutoSync(ms: number): void {
    if (this.autoSyncIntervalId) {
      clearInterval(this.autoSyncIntervalId);
    }
    this.autoSyncIntervalId = setInterval(async () => {
      await this.syncElectionData();
    }, ms);
  }

  private stopAutoSync(): void {
    if (this.autoSyncIntervalId) {
      clearInterval(this.autoSyncIntervalId);
      this.autoSyncIntervalId = null;
    }
  }

  private updateLoadingUI(show: boolean): void {
    const progressEl = document.getElementById('loading-progress');
    if (progressEl) {
      progressEl.style.width = show ? '60%' : '100%';
    }
  }

  private hideLoader(): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
  }

  private createFloatingText(text: string, type: string): void {
    const container = document.body;
    const el = document.createElement('div');
    el.className = `floating-text ${type}`;
    el.textContent = text;
    el.style.left = '50%';
    el.style.top = '45%';

    container.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
}

// Instantiate
new HospitalConstructionDashboard();
