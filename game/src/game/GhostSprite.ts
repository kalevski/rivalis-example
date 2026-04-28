import * as Phaser from 'phaser'
import { ARENA, type Direction } from '@rivalis-example/protocol'

const SCARED_BODY = 0x1e3a8a
const SCARED_TRIM = 0xffffff
const EYE_OFFSET_X = 4.5
const EYE_OFFSET_Y = 3.5

const PUPIL_DX: Record<Direction, number> = { up: 0, down: 0, left: -1.5, right: 1.5 }
const PUPIL_DY: Record<Direction, number> = { up: -1.5, down: 1.5, left: 0, right: 0 }

export default class GhostSprite {
    private body: Phaser.GameObjects.Graphics
    private leftEye: Phaser.GameObjects.Arc
    private rightEye: Phaser.GameObjects.Arc
    private leftPupil: Phaser.GameObjects.Arc
    private rightPupil: Phaser.GameObjects.Arc

    private color: number
    private scared = false
    private dir: Direction = 'left'
    private targetX: number
    private targetY: number

    constructor(scene: Phaser.Scene, x: number, y: number, colorHex: string) {
        this.color = Phaser.Display.Color.HexStringToColor(colorHex).color
        this.targetX = x
        this.targetY = y

        this.body = scene.add.graphics()
        this.body.x = x
        this.body.y = y
        this.draw()

        this.leftEye = scene.add.circle(x - EYE_OFFSET_X, y - EYE_OFFSET_Y, 3, 0xffffff)
        this.rightEye = scene.add.circle(x + EYE_OFFSET_X, y - EYE_OFFSET_Y, 3, 0xffffff)
        this.leftPupil = scene.add.circle(x - EYE_OFFSET_X, y - EYE_OFFSET_Y, 1.5, 0x111122)
        this.rightPupil = scene.add.circle(x + EYE_OFFSET_X, y - EYE_OFFSET_Y, 1.5, 0x111122)
    }

    setTarget(x: number, y: number, dir: Direction): void {
        this.targetX = x
        this.targetY = y
        this.dir = dir
    }

    setScared(scared: boolean): void {
        if (this.scared === scared) return
        this.scared = scared
        this.draw()
    }

    update(deltaMs: number): void {
        const t = Math.min(1, deltaMs / 80)
        this.body.x += (this.targetX - this.body.x) * t
        this.body.y += (this.targetY - this.body.y) * t

        const cx = this.body.x
        const cy = this.body.y
        this.leftEye.x = cx - EYE_OFFSET_X; this.leftEye.y = cy - EYE_OFFSET_Y
        this.rightEye.x = cx + EYE_OFFSET_X; this.rightEye.y = cy - EYE_OFFSET_Y
        // pupils look where the ghost is heading
        this.leftPupil.x = this.leftEye.x + PUPIL_DX[this.dir]
        this.leftPupil.y = this.leftEye.y + PUPIL_DY[this.dir]
        this.rightPupil.x = this.rightEye.x + PUPIL_DX[this.dir]
        this.rightPupil.y = this.rightEye.y + PUPIL_DY[this.dir]
    }

    destroy(): void {
        this.body.destroy()
        this.leftEye.destroy()
        this.rightEye.destroy()
        this.leftPupil.destroy()
        this.rightPupil.destroy()
    }

    private draw(): void {
        const r = ARENA.playerRadius
        const fill = this.scared ? SCARED_BODY : this.color
        const stroke = this.scared ? SCARED_TRIM : 0xffffff
        const g = this.body
        g.clear()
        g.fillStyle(fill, 1)
        g.lineStyle(1, stroke, 0.5)
        // round top, square-ish bottom — classic ghost silhouette
        g.fillRoundedRect(-r, -r, r * 2, r * 2, { tl: r, tr: r, bl: 3, br: 3 })
        g.strokeRoundedRect(-r, -r, r * 2, r * 2, { tl: r, tr: r, bl: 3, br: 3 })
    }
}
