// The maze. Hand-drawn ASCII so anyone can edit it without a level editor.
//
//   '#' = wall              (collides with players)
//   '.' = pellet             (1 point when eaten)
//   'O' = power pellet       (5 points + 8 s "energized" ability to eat others)
//   ' ' = open path, no pellet
//
// Both server and client read this same array. Edit and reload.

export const TILE_SIZE = 32

export const MAZE: ReadonlyArray<string> = [
    '#####################',
    '#O.................O#',
    '#.###.###.#.###.###.#',
    '#...................#',
    '#.#.#.###.#.###.#.#.#',
    '#.....#.......#.....#',
    '#.###.###.#.###.###.#',
    '#.....#.......#.....#',
    '#.###.###.#.###.###.#',
    '#.....#.......#.....#',
    '#.#.#.###.#.###.#.#.#',
    '#...................#',
    '#.###.###.#.###.###.#',
    '#O.................O#',
    '#####################'
]

export const MAZE_COLS = 21
export const MAZE_ROWS = 15

// Validate at module load — catches typos in the maze art early.
for (const row of MAZE) {
    if (row.length !== MAZE_COLS) throw new Error('maze row width != MAZE_COLS')
}
if (MAZE.length !== MAZE_ROWS) throw new Error('maze height != MAZE_ROWS')

export const MAZE_WIDTH = MAZE_COLS * TILE_SIZE   // 672 px
export const MAZE_HEIGHT = MAZE_ROWS * TILE_SIZE  // 480 px

export type TileChar = '#' | '.' | 'O' | ' '

export function tileChar(tx: number, ty: number): TileChar {
    if (ty < 0 || ty >= MAZE_ROWS) return '#'
    const row = MAZE[ty]!
    if (tx < 0 || tx >= row.length) return '#'
    return row[tx] as TileChar
}

export function isWallTile(tx: number, ty: number): boolean {
    return tileChar(tx, ty) === '#'
}

export function tileCenter(tx: number, ty: number): { x: number; y: number } {
    return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 }
}

/** Every pellet location read off the maze art. */
export function listPelletTiles(): Array<{ tx: number; ty: number; power: boolean }> {
    const out: Array<{ tx: number; ty: number; power: boolean }> = []
    for (let ty = 0; ty < MAZE_ROWS; ty++) {
        for (let tx = 0; tx < MAZE_COLS; tx++) {
            const c = tileChar(tx, ty)
            if (c === '.') out.push({ tx, ty, power: false })
            else if (c === 'O') out.push({ tx, ty, power: true })
        }
    }
    return out
}

/** Every walkable tile (anything that isn't a wall). Used for spawn picks. */
export function listOpenTiles(): Array<{ tx: number; ty: number }> {
    const out: Array<{ tx: number; ty: number }> = []
    for (let ty = 0; ty < MAZE_ROWS; ty++) {
        for (let tx = 0; tx < MAZE_COLS; tx++) {
            if (!isWallTile(tx, ty)) out.push({ tx, ty })
        }
    }
    return out
}
