import * as Phaser from 'phaser'
import {
    MAZE_COLS, MAZE_ROWS, TILE_SIZE,
    isWallTile
} from '@rivalis-example/protocol'

const WALL_FILL = 0x1d4ed8
const WALL_STROKE = 0x60a5fa
const FLOOR = 0x0a0a18

/**
 * Draws the static maze once: floor, wall tiles, optional grid hint.
 *
 * The maze never changes at runtime, so this is a fire-and-forget Graphics
 * object — no per-frame work needed.
 */
export default class MazeRenderer {
    constructor(scene: Phaser.Scene) {
        const g = scene.add.graphics()

        // Solid floor under everything, so the empty corridors aren't pure black.
        g.fillStyle(FLOOR, 1)
        g.fillRect(0, 0, MAZE_COLS * TILE_SIZE, MAZE_ROWS * TILE_SIZE)

        // Wall tiles.
        g.fillStyle(WALL_FILL, 1)
        g.lineStyle(1, WALL_STROKE, 0.7)
        for (let ty = 0; ty < MAZE_ROWS; ty++) {
            for (let tx = 0; tx < MAZE_COLS; tx++) {
                if (!isWallTile(tx, ty)) continue
                const x = tx * TILE_SIZE
                const y = ty * TILE_SIZE
                g.fillRect(x, y, TILE_SIZE, TILE_SIZE)
                g.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1)
            }
        }
    }
}
