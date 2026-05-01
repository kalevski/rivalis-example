import { Feature } from '@toolcase/phaser-plus'
import { InputFeature } from '@toolcase/phaser-plus'
import type { ArenaInput } from '@rivalis-example/protocol'

export type InputChangeHandler = (input: ArenaInput) => void

const ZERO: ArenaInput = { up: false, down: false, left: false, right: false }

function equal(a: ArenaInput, b: ArenaInput): boolean {
    return a.up === b.up && a.down === b.down && a.left === b.left && a.right === b.right
}

export default class ArenaInputFeature extends Feature {
    static readonly KEY = 'arena.input'

    private input!: InputFeature
    private handler: InputChangeHandler | null = null
    private last: ArenaInput = { ...ZERO }

    onCreate(): void {
        this.input = this.scene.features.register('arena.input.core', InputFeature)
        this.input
            .bind('up',    [{ type: 'key', code: 'W' }, { type: 'key', code: 'UP' }])
            .bind('down',  [{ type: 'key', code: 'S' }, { type: 'key', code: 'DOWN' }])
            .bind('left',  [{ type: 'key', code: 'A' }, { type: 'key', code: 'LEFT' }])
            .bind('right', [{ type: 'key', code: 'D' }, { type: 'key', code: 'RIGHT' }])
    }

    onChange(handler: InputChangeHandler | null): void {
        this.handler = handler
    }

    reset(): void {
        if (equal(this.last, ZERO)) return
        this.last = { ...ZERO }
        this.handler?.({ ...ZERO })
    }

    onUpdate(_time: number, _delta: number): void {
        const next: ArenaInput = {
            up: this.input.isPressed('up'),
            down: this.input.isPressed('down'),
            left: this.input.isPressed('left'),
            right: this.input.isPressed('right')
        }
        if (equal(next, this.last)) return
        this.last = next
        this.handler?.(next)
    }
}
