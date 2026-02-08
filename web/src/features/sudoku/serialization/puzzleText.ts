import type { Cell } from "../types";

const DIGIT_RE = /^[1-9]$/;

type ParseResult = {
  grid: Cell[][];
  hasMetadata: boolean;
  fixedMask?: Uint8Array;
  grid81: Uint8Array;
};

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function buildSaveText(grid: Cell[][]): string {
  return grid
    .map((row) =>
      row
        .map((cell) =>
          cell.value !== null && cell.value >= 1 && cell.value <= 9
            ? String(cell.value)
            : "."
        )
        .join("")
    )
    .join("\n");
}

export function buildMetadataSaveText(grid: Cell[][]): string {
  const puzzleLines = grid.map((row) =>
    row
      .map((cell) =>
        cell.value !== null && cell.value >= 1 && cell.value <= 9
          ? String(cell.value)
          : "."
      )
      .join("")
  );
  const metaLines = grid.map((row) =>
    row.map((cell) => (cell.fixed ? "1" : "0")).join("")
  );
  return [...puzzleLines, ...metaLines].join("\n");
}

export function parsePuzzleText(text: string): ParseResult {
  const lines = normalizeLines(text);
  const hasMetadata = lines.length >= 18;
  const puzzleLines = lines.slice(0, 9);
  const metaLines = hasMetadata ? lines.slice(9, 18) : [];
  const grid81 = new Uint8Array(81);
  const fixed81 = new Uint8Array(81);

  const cells: Cell[] = Array.from({ length: 81 }, (_, i) => {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const ch = puzzleLines[r]?.[c] ?? "";
    const meta = metaLines[r]?.[c] ?? "";
    const isFixed = hasMetadata ? meta === "1" : DIGIT_RE.test(ch);
    fixed81[i] = isFixed ? 1 : 0;
    if (DIGIT_RE.test(ch)) {
      const value = Number(ch);
      grid81[i] = value;
      return { value, fixed: isFixed };
    }
    grid81[i] = 0;
    return { value: null, fixed: isFixed };
  });

  const grid: Cell[][] = Array.from({ length: 9 }, (_, r) =>
    cells.slice(r * 9, r * 9 + 9)
  );

  return {
    grid,
    hasMetadata,
    fixedMask: hasMetadata ? fixed81 : undefined,
    grid81
  };
}
