export class CandidateSelector<T> {
  private best: T | null = null;
  private bestScore = Infinity;

  public update(candidate: T, score: number): void {
    if (score < this.bestScore) {
      this.bestScore = score;
      this.best = candidate;
    }
  }

  public getBest(): T | null {
    return this.best;
  }
}
