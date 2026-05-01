import { GameObjects } from 'phaser'
import { Feature } from '@toolcase/phaser-plus'
import { MAZE_COLS, MAZE_ROWS, TILE_SIZE, isWallTile } from '@rivalis-example/protocol'

const WALL_FILL = 0x1d4ed8
const WALL_STROKE = 0x60a5fa
const FLOOR = 0x0a0a18

export default class MazeFeature extends Feature {
    static readonly KEY = 'maze'

    private gfx: GameObjects.Graphics | null = null

    onCreate(): void {
        const g = this.scene.add.graphics()
        g.setDepth(-100)
        this.gfx = g

        g.fillStyle(FLOOR, 1)
        g.fillRect(0, 0, MAZE_COLS * TILE_SIZE, MAZE_ROWS * TILE_SIZE)

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

    onDestroy(): void {
        this.gfx?.destroy()
        this.gfx = null
    }
}
