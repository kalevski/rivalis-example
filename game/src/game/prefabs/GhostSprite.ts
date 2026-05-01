import { Display, GameObjects } from 'phaser'
import { GameObject, type Scene } from '@toolcase/phaser-plus'
import { ARENA, type Ghost, type Direction } from '@rivalis-example/protocol'

const SCARED_BODY = 0x1e3a8a
const SCARED_TRIM = 0xffffff
const EYE_OFFSET_X = 4.5
const EYE_OFFSET_Y = 3.5

const PUPIL_DX: Record<Direction, number> = { up: 0, down: 0, left: -1.5, right: 1.5 }
const PUPIL_DY: Record<Direction, number> = { up: -1.5, down: 1.5, left: 0, right: 0 }

export default class GhostSprite extends GameObject {
    static readonly KEY = 'ghost'

    private bodyGfx!: GameObjects.Graphics
    private leftEye!: GameObjects.Arc
    private rightEye!: GameObjects.Arc
    private leftPupil!: GameObjects.Arc
    private rightPupil!: GameObjects.Arc

    private color = 0xffffff
    private scared = false
    private dir: Direction = 'left'
    private targetX = 0
    private targetY = 0

    constructor(scene: Scene) {
        super(scene, 0, 0)
    }

    onCreate(): void {
        this.bodyGfx = this.scene.add.graphics()
        this.leftEye = this.scene.add.circle(-EYE_OFFSET_X, -EYE_OFFSET_Y, 3, 0xffffff)
        this.rightEye = this.scene.add.circle(EYE_OFFSET_X, -EYE_OFFSET_Y, 3, 0xffffff)
        this.leftPupil = this.scene.add.circle(-EYE_OFFSET_X, -EYE_OFFSET_Y, 1.5, 0x111122)
        this.rightPupil = this.scene.add.circle(EYE_OFFSET_X, -EYE_OFFSET_Y, 1.5, 0x111122)
        this.add([this.bodyGfx, this.leftEye, this.rightEye, this.leftPupil, this.rightPupil])
        this.scene.add.existing(this)
    }

    init(ghost: Ghost): void {
        this.color = Display.Color.HexStringToColor(ghost.color).color
        this.x = ghost.x
        this.y = ghost.y
        this.targetX = ghost.x
        this.targetY = ghost.y
        this.dir = ghost.dir
        this.scared = !ghost.scared
        this.setScared(ghost.scared)
        this.setVisible(true)
        this.setActive(true)
        this.draw()
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

    onUpdate(_time: number, deltaMs: number): void {
        const t = Math.min(1, deltaMs / 80)
        this.x += (this.targetX - this.x) * t
        this.y += (this.targetY - this.y) * t

        this.leftPupil.x = -EYE_OFFSET_X + PUPIL_DX[this.dir]
        this.leftPupil.y = -EYE_OFFSET_Y + PUPIL_DY[this.dir]
        this.rightPupil.x = EYE_OFFSET_X + PUPIL_DX[this.dir]
        this.rightPupil.y = -EYE_OFFSET_Y + PUPIL_DY[this.dir]
    }

    reset(): void {
        this.setVisible(false)
        this.setActive(false)
    }

    private draw(): void {
        const r = ARENA.playerRadius
        const fill = this.scared ? SCARED_BODY : this.color
        const stroke = this.scared ? SCARED_TRIM : 0xffffff
        const g = this.bodyGfx
        g.clear()
        g.fillStyle(fill, 1)
        g.lineStyle(1, stroke, 0.5)
        g.fillRoundedRect(-r, -r, r * 2, r * 2, { tl: r, tr: r, bl: 3, br: 3 })
        g.strokeRoundedRect(-r, -r, r * 2, r * 2, { tl: r, tr: r, bl: 3, br: 3 })
    }
}
