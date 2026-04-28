import { Actor, Room } from '@rivalis/core'
import {
    ARENA, encode, decode,
    type ArenaInput, type WelcomeEvent
} from '@rivalis-example/protocol'
import type { ActorData } from '../auth/AuthMiddleware'
import ArenaSimulation from '../game/ArenaSimulation'

const TICK_MS = Math.round(1000 / ARENA.tickHz)

export default class ArenaRoom extends Room<ActorData> {
    protected override presence = true

    private readonly sim = new ArenaSimulation()
    private tickHandle: NodeJS.Timeout | null = null
    private lastTickAt = 0

    protected override onCreate(): void {
        // .bind(this) — onCreate runs from the parent constructor before
        // class-field arrow methods exist
        this.bind('input', this.onInput.bind(this))

        this.lastTickAt = Date.now()
        this.tickHandle = setInterval(() => this.tick(), TICK_MS)
        this.tickHandle.unref?.()
    }

    protected override onJoin(actor: Actor<ActorData>): void {
        const { name, color } = actor.data!
        this.sim.addPlayer(actor.id, name, color)

        const welcome: WelcomeEvent = { youAre: name, youId: actor.id, color }
        actor.send('welcome', encode(welcome))

        // immediate snapshot so joiner doesn't wait a tick
        this.broadcast('arena:state', encode(this.sim.snapshot()))
    }

    protected override onLeave(actor: Actor<ActorData>): void {
        this.sim.removePlayer(actor.id)
    }

    protected override onDestroy(): void {
        if (this.tickHandle !== null) clearInterval(this.tickHandle)
        this.tickHandle = null
    }

    protected override presencePayload(actor: Actor<ActorData>) {
        const { name, color } = actor.data!
        return { id: actor.id, name, color }
    }

    private onInput(actor: Actor<ActorData>, payload: Uint8Array): void {
        let raw: Partial<ArenaInput>
        try { raw = decode<Partial<ArenaInput>>(payload) } catch { return }
        this.sim.setInput(actor.id, {
            up: raw.up === true,
            down: raw.down === true,
            left: raw.left === true,
            right: raw.right === true
        })
    }

    private tick(): void {
        const now = Date.now()
        const dtMs = now - this.lastTickAt
        this.lastTickAt = now

        const snapshot = this.sim.tick(dtMs)
        if (snapshot !== null) this.broadcast('arena:state', encode(snapshot))
    }
}
