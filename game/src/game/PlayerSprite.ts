import * as Phaser from 'phaser'
import { ARENA, type Direction } from '@rivalis-example/protocol'

const LABEL_OFFSET = ARENA.playerRadius + 14
const TWO_PI = Math.PI * 2

const FACING: Record<Direction, number> = {
    right: 0,
    down: Math.PI / 2,
    left: Math.PI,
    up: -Math.PI / 2
}

const MOUTH_MIN = Math.PI / 12   // 15°
const MOUTH_MAX = Math.PI / 4    // 45°
const CHOMP_HZ = 8               // chomps per second when moving

/**
 * One player. A pacman-style pie slice with an animated mouth that opens
 * and closes while moving, plus a name + score label, and a glowing halo
 * when the player has eaten a power pellet.
 */
export default class PlayerSprite {
    private body: Phaser.GameObjects.Graphics
    private halo: Phaser.GameObjects.Arc
    private label: Phaser.GameObjects.Text
    private color: number
    private isLocal: boolean

    private dir: Direction = 'right'
    private chompPhase = 0
    private moving = false
    private energized = false

    private targetX: number
    private targetY: number
    private name: string
    private score: number

    constructor(
        scene: Phaser.Scene,
        x: number, y: number,
        colorHex: string, name: string, score: number,
        isLocal: boolean
    ) {
        this.color = Phaser.Display.Color.HexStringToColor(colorHex).color
        this.isLocal = isLocal
        this.name = name
        this.score = score
        this.targetX = x
        this.targetY = y

        this.halo = scene.add.circle(x, y, ARENA.playerRadius + 6, 0xfacc15, 0)
        this.halo.setStrokeStyle(2, 0xfacc15, 0.6)
        this.halo.setVisible(false)

        this.body = scene.add.graphics()
        this.body.x = x
        this.body.y = y
        this.drawBody(0)

        this.label = scene.add.text(x, y - LABEL_OFFSET, this.formatLabel(), {
            fontSize: '11px',
            color: '#eee',
            fontFamily: 'system-ui, sans-serif'
        }).setOrigin(0.5, 0.5)
    }

    setTarget(x: number, y: number, dir: Direction): void {
        // "moving" if the server reports a new position OR direction.
        this.moving = x !== this.targetX || y !== this.targetY
        this.targetX = x
        this.targetY = y
        this.dir = dir
    }

    setText(name: string, score: number): void {
        if (this.name === name && this.score === score) return
        this.name = name
        this.score = score
        this.label.setText(this.formatLabel())
    }

    setEnergized(energized: boolean): void {
        if (this.energized === energized) return
        this.energized = energized
        this.halo.setVisible(energized)
    }

    update(deltaMs: number): void {
        // Lerp visual position toward server target. Covers ~80 ms of
        // distance per frame — snappy but smooths over the 30 Hz tick.
        const t = Math.min(1, deltaMs / 80)
        this.body.x += (this.targetX - this.body.x) * t
        this.body.y += (this.targetY - this.body.y) * t
        const cx = this.body.x
        const cy = this.body.y

        this.halo.x = cx
        this.halo.y = cy
        this.label.x = cx
        this.label.y = cy - LABEL_OFFSET

        if (this.moving) this.chompPhase += deltaMs / 1000 * CHOMP_HZ * TWO_PI
        // Re-render the pie slice with the current mouth opening + facing.
        this.drawBody(this.chompPhase)

        if (this.energized) {
            // Pulse the halo so the powered-up state is impossible to miss.
            const pulse = 1 + Math.sin(this.chompPhase * 0.5) * 0.15
            this.halo.setScale(pulse)
        }

        // Once we've snapped close enough to target, declare we're stopped
        // so the mouth pauses — purely cosmetic.
        const dx = this.targetX - cx
        const dy = this.targetY - cy
        if (dx * dx + dy * dy < 0.5) this.moving = false
    }

    destroy(): void {
        this.body.destroy()
        this.halo.destroy()
        this.label.destroy()
    }

    private drawBody(chompPhase: number): void {
        // Mouth opening oscillates between MOUTH_MIN and MOUTH_MAX.
        const t = (Math.sin(chompPhase) + 1) * 0.5
        const halfMouth = MOUTH_MIN + (MOUTH_MAX - MOUTH_MIN) * t
        const facing = FACING[this.dir]
        const r = ARENA.playerRadius

        const g = this.body
        g.clear()
        g.fillStyle(this.color, 1)
        g.lineStyle(this.isLocal ? 2 : 1, 0xffffff, this.isLocal ? 1 : 0.4)
        // Phaser pie slice: starts at `facing + halfMouth`, sweeps clockwise
        // around the body to `facing - halfMouth + 2π`, leaving the mouth gap.
        g.slice(0, 0, r, facing + halfMouth, facing - halfMouth + TWO_PI, false)
        g.fillPath()
        g.strokePath()
    }

    private formatLabel(): string {
        return `${this.name}  ${this.score}`
    }
}
