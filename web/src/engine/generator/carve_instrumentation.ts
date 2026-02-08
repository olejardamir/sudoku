import type { Difficulty } from "../solver/solver.ts";

export type CarveSummary = {
  probeCount: number;
  uniqueRejects: number;
  nullProbeRejects: number;
  overshootRejects: number;
  samples: string[];
};

export class CarveInstrumentation {
  private readonly sampleLimit: number;
  private readonly samples: string[] = [];
  private probeCount = 0;
  private uniqueRejects = 0;
  private nullProbeRejects = 0;
  private overshootRejects = 0;

  constructor(sampleLimit: number = 5) {
    this.sampleLimit = sampleLimit;
  }

  public recordProbe(clues: number, diff: Difficulty | null, label: (d: Difficulty) => string): void {
    this.probeCount++;
    if (this.samples.length < this.sampleLimit) {
      const diffLabel = diff !== null ? label(diff) : "null";
      this.samples.push(`probe clues=${clues} diff=${diffLabel}`);
    }
  }

  public recordUniqueReject(): void {
    this.uniqueRejects++;
  }

  public recordNullProbeReject(): void {
    this.nullProbeRejects++;
  }

  public recordOvershootReject(): void {
    this.overshootRejects++;
  }

  public summary(): CarveSummary {
    return {
      probeCount: this.probeCount,
      uniqueRejects: this.uniqueRejects,
      nullProbeRejects: this.nullProbeRejects,
      overshootRejects: this.overshootRejects,
      samples: this.samples.slice(),
    };
  }
}
