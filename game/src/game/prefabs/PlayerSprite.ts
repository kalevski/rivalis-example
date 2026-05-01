import { Display, GameObjects } from 'phaser'
import { GameObject, type Scene } from '@toolcase/phaser-plus'
import { ARENA, type ArenaPlayer, type Direction } from '@rivalis-example/protocol'

const LABEL_OFFSET = ARENA.playerRadius + 14
const TWO_PI = Math.PI * 2

const FACING: Record<Direction, number> = {
    right: 0,
    down: Math.PI / 2,
    left: Math.PI,
    up: -Math.PI / 2
}

const MOUTH_MIN = Math.PI / 12
const MOUTH_MAX = Math.PI / 4
const CHOMP_HZ = 8

export default class PlayerSprite extends GameObject {
    static readonly KEY = 'player'

    private bodyGfx!: GameObjects.Graphics
    private halo!: GameObjects.Arc
    private label!: GameObjects.Text

    private color = 0xffffff
    private isLocal = false
    private dir: Direction = 'right'
    private chompPhase = 0
    private moving = false
    private energized = false

    private targetX = 0
    private targetY = 0
    private playerName = ''
    private playerScore = 0

    constructor(scene: Scene) {
        super(scene, 0, 0)
    }

    onCreate(): void {
        this.halo = this.scene.add.circle(0, 0, ARENA.playerRadius + 6, 0xfacc15, 0)
        this.halo.setStrokeStyle(2, 0xfacc15, 0.6)
        this.halo.setVisible(false)

        this.bodyGfx = this.scene.add.graphics()

        this.label = this.scene.add.text(0, -LABEL_OFFSET, '', {
            fontSize: '11px',
            color: '#eee',
            fontFamily: 'system-ui, sans-serif'
        }).setOrigin(0.5, 0.5)

        this.add([this.halo, this.bodyGfx, this.label])
        this.scene.add.existing(this)
    }

    init(player: ArenaPlayer, isLocal: boolean, energized: boolean): void {
        this.color = Display.Color.HexStringToColor(player.color).color
        this.isLocal = isLocal
        this.x = player.x
        this.y = player.y
        this.targetX = player.x
        this.targetY = player.y
        this.dir = player.dir
        this.chompPhase = 0
        this.moving = false
        this.playerName = ''
        this.playerScore = -1
        this.setText(player.name, player.score)
        this.energized = false
        this.setEnergized(energized)
        this.setVisible(true)
        this.setActive(true)
        this.drawBody(0)
    }

    setTarget(x: number, y: number, dir: Direction): void {
        this.moving = x !== this.targetX || y !== this.targetY
        this.targetX = x
        this.targetY = y
        this.dir = dir
    }

    setText(name: string, score: number): void {
        if (this.playerName === name && this.playerScore === score) return
        this.playerName = name
        this.playerScore = score
        this.label.setText(`${name}  ${score}`)
    }

    setEnergized(energized: boolean): void {
        if (this.energized === energized) return
        this.energized = energized
        this.halo.setVisible(energized)
    }

    onUpdate(_time: number, deltaMs: number): void {
        const t = Math.min(1, deltaMs / 80)
        this.x += (this.targetX - this.x) * t
        this.y += (this.targetY - this.y) * t

        if (this.moving) this.chompPhase += deltaMs / 1000 * CHOMP_HZ * TWO_PI
        this.drawBody(this.chompPhase)

        if (this.energized) {
            const pulse = 1 + Math.sin(this.chompPhase * 0.5) * 0.15
            this.halo.setScale(pulse)
        }

        const dx = this.targetX - this.x
        const dy = this.targetY - this.y
        if (dx * dx + dy * dy < 0.5) this.moving = false
    }

    reset(): void {
        this.setVisible(false)
        this.setActive(false)
        this.energized = false
        this.halo.setVisible(false)
    }

    private drawBody(chompPhase: number): void {
        const t = (Math.sin(chompPhase) + 1) * 0.5
        const halfMouth = MOUTH_MIN + (MOUTH_MAX - MOUTH_MIN) * t
        const facing = FACING[this.dir]
        const r = ARENA.playerRadius

        const g = this.bodyGfx
        g.clear()
        g.fillStyle(this.color, 1)
        g.lineStyle(this.isLocal ? 2 : 1, 0xffffff, this.isLocal ? 1 : 0.4)
        g.slice(0, 0, r, facing + halfMouth, facing - halfMouth + TWO_PI, false)
        g.fillPath()
        g.strokePath()
    }
}
