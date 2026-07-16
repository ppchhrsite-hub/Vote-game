export interface CropDefinition {
  type: string;
  name: string;
  emoji: string;
  seedCost: number;
  sellPrice: number;
  growthTime: number;
  xpReward: number;
}

export const CROP_TYPES: Record<string, CropDefinition> = {
  wheat: { type: 'wheat', name: 'Wheat', emoji: '🌾', seedCost: 5, sellPrice: 12, growthTime: 15, xpReward: 10 },
  carrot: { type: 'carrot', name: 'Carrot', emoji: '🥕', seedCost: 12, sellPrice: 28, growthTime: 30, xpReward: 20 },
  tomato: { type: 'tomato', name: 'Tomato', emoji: '🍅', seedCost: 25, sellPrice: 60, growthTime: 60, xpReward: 40 },
  sunflower: { type: 'sunflower', name: 'Sunflower', emoji: '🌻', seedCost: 45, sellPrice: 110, growthTime: 100, xpReward: 70 },
  pumpkin: { type: 'pumpkin', name: 'Golden Pumpkin', emoji: '🎃', seedCost: 80, sellPrice: 210, growthTime: 180, xpReward: 120 }
};

export interface DepartmentData {
  name: string;
  total: number;
  voted: number;
  percentage: number;
}

export class PlayerState {
  // Classic properties kept for build compatibility
  public coins: number = 0;
  public xp: number = 0;
  public level: number = 1;
  public seeds: Record<string, number> = { wheat: 0, carrot: 0, tomato: 0, sunflower: 99, pumpkin: 0 };
  public crops: Record<string, number> = { wheat: 0, carrot: 0, tomato: 0, sunflower: 0, pumpkin: 0 };
  public helpers: Record<string, number> = { sprinkler: 0, scarecrow: 0 };
  public upgrades = { waterCanCapacity: 99, waterCanUsage: 0, sprinklerCount: 0, scarecrowCount: 0, growthSpeedBonus: 1.0 };
  public activeTool: string = 'water'; // Default to water/inspect tool
  public activeSeed: string = 'sunflower';

  // --- ELECTION MONITOR PROPERTIES ---
  public spreadsheetId: string = "1aLUltNZirflTIYn2-oqeGxpND1vXBW0fScddrDNvmJs";
  public departments: DepartmentData[] = [];
  public totalEmployees: number = 0;
  public totalVoted: number = 0;
  public overallPercentage: number = 0;
  public topDepartment: string = "-";
  public lastUpdate: string = "-";
  public isLoading: boolean = false;

  private onStateChangeCallback?: () => void;

  constructor() {
    // Start fresh
  }

  public registerCallbacks(
    onStateChange: () => void
  ): void {
    this.onStateChangeCallback = onStateChange;
    this.triggerUpdate();
  }

  public triggerUpdate(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback();
    }
  }

  // --- FETCH & PARSE SHEET DATA ---
  public async fetchLiveElectionData(): Promise<boolean> {
    if (this.isLoading) return false;
    this.isLoading = true;
    this.triggerUpdate();

    try {
      // Fetch Employees
      const empUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=employee`;
      const empRes = await fetch(empUrl);
      if (!empRes.ok) throw new Error("Failed to fetch employee sheet");
      const empCsv = await empRes.text();

      // Fetch Votes
      const votesUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=Votes`;
      const votesRes = await fetch(votesUrl);
      if (!votesRes.ok) throw new Error("Failed to fetch votes sheet");
      const votesCsv = await votesRes.text();

      // Parse datasets
      const employeesData = this.parseCSV(empCsv);
      const votesData = this.parseCSV(votesCsv);

      // Whitelist
      const whitelist: Array<{ id: string; name: string; dept: string }> = [];
      for (let i = 1; i < employeesData.length; i++) {
        const row = employeesData[i];
        if (row && row[0]) {
          whitelist.push({
            id: String(row[0]).trim(),
            name: String(row[2]).trim(),
            dept: String(row[3]).trim()
          });
        }
      }

      // Voted map
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
      let topDeptName = "-";
      let topDeptPct = -1;
      let topDeptVoted = -1;

      for (const name in deptMap) {
        const d = deptMap[name];
        d.percentage = d.total > 0 ? Math.round((d.voted / d.total) * 100 * 10) / 10 : 0;
        deptsArray.push(d);

        // Track highest turnout
        if (d.percentage > topDeptPct) {
          topDeptPct = d.percentage;
          topDeptName = d.name;
          topDeptVoted = d.voted;
        } else if (d.percentage === topDeptPct && d.voted > topDeptVoted) {
          topDeptName = d.name;
          topDeptVoted = d.voted;
        }
      }

      // Sort: highest turnout percentage, then alphabetical
      deptsArray.sort((a, b) => {
        if (b.percentage !== a.percentage) {
          return b.percentage - a.percentage;
        }
        return a.name.localeCompare(b.name);
      });

      // Set State
      this.departments = deptsArray;
      this.totalEmployees = whitelist.length;
      this.totalVoted = votedCount;
      this.overallPercentage = this.totalEmployees > 0 ? Math.round((this.totalVoted / this.totalEmployees) * 100 * 10) / 10 : 0;
      this.topDepartment = topDeptPct >= 0 ? `${topDeptName} (${topDeptPct}%)` : "-";
      
      // Bind stats to classic properties for HUD compatibility
      this.coins = this.totalVoted;
      this.xp = Math.floor(this.overallPercentage);

      this.lastUpdate = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';
      
      this.isLoading = false;
      this.triggerUpdate();
      return true;
    } catch (e) {
      console.error("Error fetching live election data:", e);
      this.isLoading = false;
      this.triggerUpdate();
      return false;
    }
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
          i++; // Skip escape quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(entry.trim());
        entry = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(entry.trim());
        result.push(row);
        row = [];
        entry = '';
      } else {
        entry += char;
      }
    }

    if (entry || row.length > 0) {
      row.push(entry.trim());
      result.push(row);
    }
    return result;
  }

  // --- STAT MODIFIERS Placeholder overrides ---
  public addCoins(_amount: number): void {}
  public spendCoins(_amount: number): boolean { return false; }
  public addXP(_amount: number): void {}
  public getXPNeeded(): number { return 100; }
  public buySeed(_cropType: string): boolean { return false; }
  public sellCrop(_cropType: string): boolean { return false; }
  public useSeed(_cropType: string): boolean { return false; }
  public addHarvestedCrop(_cropType: string): void {}
  public buyHelper(_type: 'sprinkler' | 'scarecrow', _cost: number): boolean { return false; }
  public resetGame(): void {}
}
