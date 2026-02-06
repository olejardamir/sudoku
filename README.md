# Core Architecture

The core of this project consists of two primary components:
- A **Sudoku Solver**
- A **Sudoku Generator**

While a basic solver using well-known techniques (e.g., X-Wing or similar strategies) would demonstrate the ability to apply existing algorithms, this project intentionally goes further by taking a hybrid approach. 
The focus shifts away from selecting a particular Sudoku-solving technique and into an **engineering domain**, where the goal is to test the limits of **TypeScript performance, determinism, and architectural rigor**.

The solver and generator engines were developed using:
- Research literature
- Large, real-world Sudoku datasets (Kaggle)
- AI tools to accelerate iteration and validation

The result is an engineered system that could be used in Sudoku competitions, or serve as a strong foundation for building a world-class Sudoku engine.

---

# Sudoku Solver Engine

The Sudoku solver is designed with the following capabilities:

- Solve standard **9×9 Sudoku**
- Search for **one single solution**
- When a solution is found, **verify that it is unique** (by stopping at solution number 2)
- Classify Sudoku difficulty as:
  - Easy
  - Medium
  - Hard
  - Samurai

**Note:**  
The *Samurai* category here does **not** correspond to the commonly known Samurai Sudoku variant. It is treated as a **company-internal label** for extremely difficult puzzles.

## Implied Knowledge (Sudoku Constraints)

1. **Row constraint**: Each number (1–9) appears exactly once in each row.
2. **Column constraint**: Each number (1–9) appears exactly once in each column.
3. **Box constraint**: Each number (1–9) appears exactly once in each 3×3 sub-grid.

## Solution Search Terminates When

1. More than one solution is found (the puzzle is not unique)
2. A dead end is reached
3. No solution exists

---

# Sudoku Generator Engine

The Sudoku generator operates in close coordination with the solver and follows the requirements below.

## A. Sudoku with a Unique Solution

A Sudoku puzzle is considered to have a **unique solution** if exactly one completed 9×9 grid satisfies all Sudoku constraints:
- Each digit 1–9 appears exactly once per row
- Each digit 1–9 appears exactly once per column
- Each digit 1–9 appears exactly once per 3×3 box

In practical terms:
- There is exactly one valid way to fill all empty cells
- Any alternative completion violates at least one Sudoku rule

### Uniqueness Verification

Uniqueness is verified during generation by:
1. Running the solver while counting solutions
2. Stopping immediately once more than one solution is detected

Solver outcomes:
- **0 solutions** → invalid puzzle
- **1 solution** → valid puzzle (unique)
- **≥ 2 solutions** → invalid puzzle (ambiguous)

Only puzzles with exactly one solution are accepted.

---

## B. Suitable Symmetry in the Placement of Numbers

Symmetry refers to the visual arrangement of the given clues (initial numbers).

A puzzle is considered symmetric if:
- Removing or placing a clue at one position requires removing or placing a corresponding clue at a mirrored position

The most common symmetry used is **180-degree rotational symmetry**, while it also does ROT90, MIRROR_XY.

### Definition
- A clue at position `(row, col)` is mirrored at `(8 − row, 8 − col)`

### Properties of Symmetry
- Does not affect correctness
- Does not affect solvability
- Is purely aesthetic
- Is commonly expected in professionally generated Sudoku puzzles

Symmetry is enforced during generation by removing or restoring clues in symmetric orbits (such as pairs for ROT180/MIRROR_XY, 4-cycles for ROT90).

---

## C. Approximate Difficulty Classification

### About Sudoku Difficulty

Different Sudoku sources define difficulty in different ways. Given that the assignment provides only one example per difficulty category, Sudoku difficulty is treated here as **non-mathematical and approximate**.

Difficulty reflects how hard a puzzle is to solve and has been tuned specifically to:
- Match the provided examples
- Operate without additional external specifications

### Difficulty Estimation Method

In this engine, difficulty is determined by:
- Measuring the amount of logical deduction and search required by the solver

Internal solver metrics include:
- Number of guesses
- Number of conflicts
- Maximum search depth

Based on predefined thresholds, puzzles are classified as:
- Easy
- Medium
- Hard
- Samurai (company-internal category for extremely difficult puzzles)

This classification approach is:
- Deterministic
- Explainable
- Difficulty is solver-relative, not subjective human-rule-based
- Commonly used in professional Sudoku engines
- Fully acceptable for this assignment

---

# References

- Bhattarai, A., Uprety, D., Pathak, P., Shrestha, S. N., Narkarmi, S., & Sigdel, S. (2025). *A Study Of Sudoku Solving Algorithms: Backtracking and Heuristic*. arXiv:2507.09708  
- Chen, K. (2025). *Exploring A Better Way to Constraint Propagation Using Naked Pair*. ITM Web of Conferences, 70, 04025  
- Norvig, P. (n.d.). *Solving Every Sudoku Puzzle*. https://norvig.com/sudoku.html  
- Pelánek, R. (2014). *Difficulty rating of sudoku puzzles: An overview and evaluation*. arXiv:1403.7373  
- Radcliffe. (2019). *3 Million Sudoku Puzzles with Ratings* [Data set]. Kaggle  
- Rao, R. (2019). *9 Million Sudoku Puzzles and Solutions* [Data set]. Kaggle  
- Simonis, H. (2005). *Sudoku as a Constraint Problem*. CP Workshop on Modeling and Reformulating CSPs  

