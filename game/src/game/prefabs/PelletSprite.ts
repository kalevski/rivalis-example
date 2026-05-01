import { GameObjects, Tweens } from 'phaser'
import { GameObject, type Scene } from '@toolcase/phaser-plus'
import type { Pellet } from '@rivalis-example/protocol'

const PELLET_COLOR = 0xfacc15
const POWER_COLOR = 0xfde68a

export default class PelletSprite extends GameObject {
    static readonly KEY = 'pellet'

    private dot!: GameObjects.Arc
    private tween: Tweens.Tween | null = null
    private power = false

    constructor(scene: Scene) {
        super(scene, 0, 0)
    }

    onCreate(): void {
        this.dot = this.scene.add.circle(0, 0, 2.5, PELLET_COLOR)
        this.add(this.dot)
        this.scene.add.existing(this)
    }

    init(pellet: Pellet): void {
        this.x = pellet.x
        this.y = pellet.y
        this.setVisible(true)
        this.setActive(true)
        this.applyKind(pellet.power)
    }

    reset(): void {
        this.setVisible(false)
        this.setActive(false)
        this.stopTween()
    }

    onDestroy(): void {
        this.stopTween()
    }

    private applyKind(power: boolean): void {
        if (this.power === power && this.dot.fillColor !== undefined) {
            return
        }
        this.power = power
        this.stopTween()
        if (power) {
            this.dot.setRadius(7)
            this.dot.setFillStyle(POWER_COLOR)
            this.dot.setStrokeStyle(1, 0xffffff, 0.8)
            this.dot.setScale(1)
            this.dot.setAlpha(1)
            this.tween = this.scene.tweens.add({
                targets: this.dot,
                scale: { from: 0.8, to: 1.2 },
                alpha: { from: 0.85, to: 1 },
                duration: 600,
                ease: 'Sine.InOut',
                yoyo: true,
                repeat: -1
            })
        } else {
            this.dot.setRadius(2.5)
            this.dot.setFillStyle(PELLET_COLOR)
            this.dot.setStrokeStyle()
            this.dot.setScale(1)
            this.dot.setAlpha(1)
        }
    }

    private stopTween(): void {
        this.tween?.stop()
        this.tween = null
    }
}
