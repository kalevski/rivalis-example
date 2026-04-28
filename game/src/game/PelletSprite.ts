import * as Phaser from 'phaser'

const PELLET_COLOR = 0xfacc15
const POWER_COLOR = 0xfde68a

export default class PelletSprite {
    private dot: Phaser.GameObjects.Arc
    private tween: Phaser.Tweens.Tween | null = null

    constructor(scene: Phaser.Scene, x: number, y: number, power: boolean) {
        if (power) {
            this.dot = scene.add.circle(x, y, 7, POWER_COLOR)
            this.dot.setStrokeStyle(1, 0xffffff, 0.8)
            this.tween = scene.tweens.add({
                targets: this.dot,
                scale: { from: 0.8, to: 1.2 },
                alpha: { from: 0.85, to: 1 },
                duration: 600,
                ease: 'Sine.InOut',
                yoyo: true,
                repeat: -1
            })
        } else {
            this.dot = scene.add.circle(x, y, 2.5, PELLET_COLOR)
        }
    }

    destroy(): void {
        this.tween?.stop()
        this.dot.destroy()
    }
}
