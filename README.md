
# ↣ ↣ ↣ ↣ ↣  [**PLAY THE GAME, CLICK HERE**](https://olejardamir.github.io/sudoku/) ↤ ↤ ↤ ↤ ↤ 

---

## Rules

* Submissions should be submitted in JavaScript/TypeScript, or any other programming language you feel more comfortable with.

**How the rule was followed:**
Since TypeScript was mentioned, the best implementation of TypeScript would be through the front-end. I chose React because the application is stateless and because it gave me the flexibility to create something that was fun.

* Include a README in GitHub describing how we can run your code. This can either be an executable, a Docker image, a list of instructions, etc. We just need a way to run your code on our computers! *

**How the rule was followed:**
Since dockerizing implies that the code is not static, has a backend, and needs to be managed in a complex environment, it does not add any value at all. It would add value if we were planning login/authentication, API access, saving player data, etc. Instead, this is the script that should be used. I have done this and tested it against a blank Linux environment.

* Third-party vendor libraries can be used if needed. *

**How the rule was followed:**
All third-party libraries concern the React framework and how it connects components together. I have built the core architecture bottom-up, and it did not require any third-party imports or libraries. However, I did borrow the knowledge from these references:

### References
* Bhattarai, A., et al. (2025). *A Study Of Sudoku Solving Algorithms: Backtracking and Heuristic.* arXiv:2507.09708
* Chen, K. (2025). *Exploring A Better Way to Constraint Propagation Using Naked Pair.* ITM Web of Conferences
* Norvig, P. *Solving Every Sudoku Puzzle.*
* Pelánek, R. (2014). *Difficulty rating of sudoku puzzles: An overview and evaluation.*
* Radcliffe. (2019). *3 Million Sudoku Puzzles with Ratings* [Kaggle].
* Rao, R. (2019). *9 Million Sudoku Puzzles and Solutions* [Kaggle].

---

## Core Architecture
The core of this project consists of two primary components:
1.  **A Sudoku Solver**
2.  **A Sudoku Generator**

While a basic solver using well-known techniques (e.g., X-Wing or similar strategies) would demonstrate the ability to apply existing algorithms, this project intentionally goes further by taking a hybrid approach. The focus shifts away from selecting a particular Sudoku-solving technique and into an engineering domain, where the goal is to test the limits of TypeScript performance, determinism, and architectural rigor.

The solver and generator engines were developed using:
* Research literature
* Large, real-world Sudoku datasets (Kaggle)
* AI tools to accelerate iteration and validation

The result is an engineered system that could be used in Sudoku competitions, or serve as a strong foundation for building a world-class Sudoku engine.

---

## Programming Challenge

### 1. File I/O & Data Structures
Write a program that reads a Sudoku from a normal text file. The text file should be built with 9 rows with 9 characters each, followed by an end-of-line character. Each character is either a number (1-9) or some other character to symbolize an empty box. Store the read Sudoku in a suitable data structure.

**What was done:**
Since I wanted to make a full game that is playable, I made it read any puzzle where numbers 1-9 are filled cells and any other characters are empty cells. It simply flattens the data into one row and parses it into a Sudoku table. This means that we can read any format, including the Kaggle open-source Sudoku puzzles that are written in just one line. 

Furthermore, since I wanted to make a full game, I also made an option to save the game. Although the user could save their progress, this introduced a difficulty where the user can save it with wrong data. Unless we included metadata, we could have a situation in which it would be impossible to have static fields, and we could have no solution; thus, it would be impossible to assess the puzzle difficulty. On the other hand, I did not want to deviate from the specifications, so I made the user choose whether or not they want to save with metadata or without. If the user loads the puzzle without metadata that is wrong or has no solution, the level is treated as **UNKNOWN** and there are no static fields.

**Relevant code:**
* **Load from text file**
    * `/web/src/App.tsx` — wires the .txt file input and passes the selected file to the loader handler.
    * `/web/src/features/sudoku/hooks/useSudokuActions.ts` — reads file.text(), parses it, evaluates difficulty, and loads the grid into game state.
    * `/web/src/features/sudoku/serialization/puzzleText.ts` — parses the text into a 9x9 grid, supports “any non-digit = empty” and optional 9-line metadata mask.
* **Save to text file**
    * `/web/src/features/sudoku/hooks/useSudokuActions.ts` — builds save text (with or without metadata) and triggers file save.
    * `/web/src/features/sudoku/serialization/puzzleText.ts` — serializes the grid to 9 lines, plus optional 9-line fixed-cell metadata.
    * `/web/src/shared/services/fileSave.ts` — writes the text file.

---

### 2. Solving Algorithm & Difficulty Classification
Write an algorithm that solves the Sudoku and verifies that there is only one solution and presents it in some way (can be a console printout). Create a way of classifying the level of difficulty of the Sudoku (see the 4 attached examples).

**What was done:**
While a basic solver using well-known techniques would demonstrate basic algorithmic application, this project focuses on testing the limits of TypeScript performance and architectural rigor.

**Sudoku Solver Engine Capabilities:**
* Solve standard 9×9 Sudoku
* Search for one single solution
* Verify solution uniqueness (stops at solution number 2)
* Classify Sudoku difficulty as: **Easy, Medium, Hard, Samurai** (Note: Samurai is a custom label for extreme difficulty).

**Implemented Logic:**
* **Constraint Satisfaction Problem (CSP) solving:** Systematically removes impossible choices.
* **Rule-based logical inference:** Applies Sudoku-specific rules (hidden singles, locked candidates, etc.).
* **Depth-First Search (DFS) backtracking:** Tries remaining possibilities with automatic undo.
* **Forward checking:** Detects mistakes early by updating related options immediately.
* **Minimum Remaining Values (MRV) heuristic:** Prioritizes cells with fewest options.
* **Activity-based branching (VSIDS-like):** Focuses on conflict-heavy areas.
* **Deterministic randomized search ordering:** Ensures reproducibility.
* **Iterative deepening via controlled rule scheduling:** Keeps solver fast by applying expensive rules only when needed.

**Relevant code:**
* `/web/src/engine/solver/solver.ts` — Main solver; loads grids, runs search, computes difficulty.
* `/web/src/engine/solver/search_engine.ts` — DFS backtracking with MRV/VSIDS and uniqueness checks.
* `/web/src/engine/solver/propagation_engine.ts` — Constraint propagation loop.
* `/web/src/engine/solver/solver_rules.ts` — Rule-based inference (hidden pairs, etc.).
* `/tests/run_csv.ts` — Console-runner for batch solving and difficulty classification.

---

### 3. Generation Algorithm
Implement an algorithm that creates a Sudoku with a unique solution. An extra plus is: Having a suitable symmetry in the placement of the numbers (as in the examples). Being able to create Sudokus with an approximate difficulty as judged by part 2.

**What was done:**
The generator creates a full solution first, then carefully removes numbers while repeatedly checking uniqueness and difficulty, stopping as soon as it matches the requested difficulty and symmetry.

**Key Features:**
* **Uniqueness Verification:** Runs the solver to ensure exactly 1 solution exists.
* **Difficulty Probing:** Uses internal solver statistics (guesses, depth, conflicts) to measure effort rather than just clue count.
* **Symmetry-preserving carving:** Supports **NONE, ROT180, ROT90, and MIRROR_XY**.
* **Deterministic pseudo-random control:** Seeded hashing ensures reproducibility.

**Relevant code:**
* `/web/src/engine/generator/generator.ts` — Main generator loop.
* `/web/src/engine/generator/carving.ts` — Iterative symmetric clue removal.
* `/web/src/engine/generator/difficulty_policy.ts` — Thresholds and scoring.
* `/web/src/engine/generator/generator_utils.ts` — Symmetry definitions and orbit generation.

---

### 4. User Interface
Add a simple User Interface for managing the above features.

**What was done:**
I built a complete UI in React. While the spec asked for "simple," I spent extra time decorating it to look like a professional game. 
* **Toggleable Atmosphere:** Users can turn off backgrounds and music for a plain experience.
* **Notes:** A text area is provided for manual scratchpad notes (not saved to state).
* **Live Demo:** [https://olejardamir.github.io/sudoku/](https://olejardamir.github.io/sudoku/)

---

### 5. Deployment Instructions
Write instructions on how to deploy the application to AWS using GitHub Action or other CI/CD tools or scripts.

## Personal Computers Only (same logic applies on AWS instances).

### LINUX

Go to a directory of your choice using your terminal and run the following:

```bash
# Install git
sudo apt-get install git

# Clone the repository
git clone [https://github.com/olejardamir/sudoku.git](https://github.com/olejardamir/sudoku.git)

# Navigate to the web directory
cd sudoku/web

# Install NVM (Node Version Manager)
curl -o- [https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh](https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh) | bash

# Refresh bash configuration
source ~/.bashrc

# Install Node.js
nvm install node

# Install dependencies
npm install

# Start the development server
npm run dev

```

---

### WINDOWS

Open **PowerShell** and follow these steps:

#### 1. Prerequisites

* **Git:** Download and run the installer from [git-scm.com](https://git-scm.com/download/win).
* **NVM:** Download `nvm-setup.exe` from the [nvm-windows releases](https://github.com/coreybutler/nvm-windows/releases). Run it to install.

#### 2. Run the Commands

Open a new **PowerShell** window and run:

```powershell
# Navigate to your preferred directory
# Clone the project
git clone [https://github.com/olejardamir/sudoku.git](https://github.com/olejardamir/sudoku.git)

# Move into the project folder
cd sudoku/web

# Install and use the latest Node.js
nvm install latest
nvm use latest

# Install dependencies
npm install

# Run the development server
npm run dev

```

> [!TIP]
> **Pro-Tip for Windows:** If you get an error saying "scripts are disabled on this system," run this command once in PowerShell as Administrator:
> `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

---

#### Accessing the Game

Once the development server starts, you will see the following output in your terminal:

> **VITE v7.3.1  ready in 174 ms**
> 
> ➜  **Local:** [http://localhost:5173/sudoku/](https://www.google.com/search?q=http://localhost:5173/sudoku/)
> 
> ➜  **Network:** use --host to expose
> 
> ➜  press **h + enter** to show help

**Open [http://localhost:5173/sudoku/](https://www.google.com/search?q=http://localhost:5173/sudoku/) in your browser to start playing.**




