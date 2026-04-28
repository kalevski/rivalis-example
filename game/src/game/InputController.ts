import * as Phaser from 'phaser'
import type { ArenaInput } from '@rivalis-example/protocol'

type Keys = {
    W: Phaser.Input.Keyboard.Key
    A: Phaser.Input.Keyboard.Key
    S: Phaser.Input.Keyboard.Key
    D: Phaser.Input.Keyboard.Key
    UP: Phaser.Input.Keyboard.Key
    DOWN: Phaser.Input.Keyboard.Key
    LEFT: Phaser.Input.Keyboard.Key
    RIGHT: Phaser.Input.Keyboard.Key
}

const ZERO: ArenaInput = { up: false, down: false, left: false, right: false }

function equal(a: ArenaInput, b: ArenaInput): boolean {
    return a.up === b.up && a.down === b.down && a.left === b.left && a.right === b.right
}

/**
 * Reads the keyboard each frame, but only invokes the change callback when
 * the input vector actually flips (key pressed / released).
 *
 * Why bother? Rivalis ships with a default rate limiter (30 frames/sec per
 * actor). If we sent input every frame at 60 fps we'd hit the bucket. By
 * sending only on key state changes, a sustained key press is a single frame.
 */
export default class InputController {
    private keys: Keys
    private last: ArenaInput = { ...ZERO }

    constructor(scene: Phaser.Scene, private readonly onChange: (input: ArenaInput) => void) {
        const KC = Phaser.Input.Keyboard.KeyCodes
        const kb = scene.input.keyboard!
        this.keys = {
            W: kb.addKey(KC.W),
            A: kb.addKey(KC.A),
            S: kb.addKey(KC.S),
            D: kb.addKey(KC.D),
            UP: kb.addKey(KC.UP),
            DOWN: kb.addKey(KC.DOWN),
            LEFT: kb.addKey(KC.LEFT),
            RIGHT: kb.addKey(KC.RIGHT)
        }
    }

    sample(): void {
        const next: ArenaInput = {
            up: this.keys.W.isDown || this.keys.UP.isDown,
            down: this.keys.S.isDown || this.keys.DOWN.isDown,
            left: this.keys.A.isDown || this.keys.LEFT.isDown,
            right: this.keys.D.isDown || this.keys.RIGHT.isDown
        }
        if (equal(next, this.last)) return
        this.last = next
        this.onChange(next)
    }

    reset(): void {
        if (equal(this.last, ZERO)) return
        this.last = { ...ZERO }
        this.onChange({ ...ZERO })
    }
}
