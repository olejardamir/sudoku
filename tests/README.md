````markdown
# Sudoku Engines — Test Harness

This repository contains a full test harness for validating a Sudoku solver, difficulty classifier, and generator, including large-scale CSV verification and round-trip generator checks.

## Prerequisites
- Node.js (LTS recommended) + npm
- Download `sudoku-3m.csv` from Kaggle: https://www.kaggle.com/datasets/radcliffe/3-million-sudoku-puzzles-with-ratings  
  Place `sudoku-3m.csv` in this folder.

## Initial Setup (run in this folder)
```bash
npm init -y
npm i -D typescript @types/node
````

## Build

```bash
npx tsc run_csv.ts runner.ts verify_runner.ts generator.ts solver.ts --target ES2020 --module commonjs --outDir .
```

## Run: Quick Difficulty Check (No CSV)

Uses the four assignment puzzles and expects a full match.

```bash
node run_csv.js --no-scan-csv
```

Optional debug output:

```bash
node run_csv.js --no-scan-csv --debug-difficulty
```

Expected output:

```
✅ Easy: EASY (match)
   stats: guesses=0 depth=0 conflicts=0 hiddenSingles=243 lockedElims=0 hiddenPairElims=0 score=243
✅ Medium: MEDIUM (match)
   stats: guesses=0 depth=0 conflicts=0 hiddenSingles=352 lockedElims=11 hiddenPairElims=4 score=390
✅ Hard: HARD (match)
   stats: guesses=0 depth=0 conflicts=0 hiddenSingles=547 lockedElims=18 hiddenPairElims=13 score=635
✅ Samurai: SAMURAI (match)
   stats: guesses=4 depth=4 conflicts=2 hiddenSingles=1043 lockedElims=10 hiddenPairElims=12 score=1165
====================================
DONE
Matches  : 4
Mismatch : 0
====================================
```

## Run: CSV Verification (3M Dataset)

Reads `sudoku-3m.csv` in this folder and validates solutions and difficulty buckets.

```bash
node run_csv.js
```

## Generate Puzzles

Generates puzzles into `generated_puzzles.csv` and attempt logs into `generated_attempts.csv`.

```bash
node runner.js
```

## Verify Generated Puzzles

Verifies solutions and difficulty matches from the generator output.

```bash
node verify_runner.js
```

Expected output:

```
====================================
VERIFICATION COMPLETE
------------------------------------
Total rows          : 798
Verified OK         : 798
Failed              : 0
Solution verified   : 798
Solution skipped    : 0
Difficulty match (generated) : 798/798
Difficulty match (target)    : 798/798
Difficulty confusion matrix (target → solver):
EASY     →  200    0    0    0
MEDIUM   →    0  200    0    0
HARD     →    0    0  200    0
SAMURAI  →    0    0    0  200
====================================
```

## Notes

* `sudoku-3m.csv` is large; CSV verification can take a long time.
* If the CSV filename or location changes, update `run_csv.ts`.
* If solver logic changes, rebuild before running any scripts.

```
```

