// ╔══════════════════════════════════════════════════════════════════════╗
// ║  ArenaRoom — the Rivalis adapter                                     ║
// ╠══════════════════════════════════════════════════════════════════════╣
// ║                                                                      ║
// ║  This file is the entire Rivalis API surface for the arena, in       ║
// ║  ~30 lines of actual framework calls. Everything below is one of:    ║
// ║                                                                      ║
// ║    Lifecycle hooks (you override these on the Room class)            ║
// ║    ─────────────────                                                 ║
// ║      onCreate()       once per room instance                         ║
// ║      onJoin(actor)    each time someone connects                     ║
// ║      onLeave(actor)   each time someone disconnects                  ║
// ║      onDestroy()      once when the room shuts down                  ║
// ║                                                                      ║
// ║    I/O primitives (you call these on `this` or on `actor`)           ║
// ║    ─────────────────                                                 ║
// ║      this.bind('topic', fn)        register a client→server handler  ║
// ║      actor.send('topic', bytes)    unicast to one player             ║
// ║      this.broadcast('topic', bytes) fan out to every player          ║
// ║                                                                      ║
// ║  That's it. The rest is just translating these into calls on a       ║
// ║  pure-logic ArenaSimulation that knows nothing about networking.     ║
// ║                                                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Actor, Room } from '@rivalis/core'
import {
    ARENA, encode, decode,
    type ArenaInput, type WelcomeEvent
} from '@rivalis-example/protocol'
import type { ActorData } from '../auth/AuthMiddleware'
import ArenaSimulation from '../game/ArenaSimulation'

const TICK_MS = Math.round(1000 / ARENA.tickHz)

export default class ArenaRoom extends Room<ActorData> {
    // ── Rivalis configuration ──────────────────────────────────────────
    //
    // RIVALIS: turning `presence` on makes Rivalis automatically broadcast
    // `__presence:join` and `__presence:leave` on every join/leave. Useful
    // for chat sidebars, lobbies, etc. Subscribed to in ArenaClient.connect.
    protected override presence = true

    // ── Game state (NOT Rivalis) ───────────────────────────────────────
    private readonly sim = new ArenaSimulation()
    private tickHandle: NodeJS.Timeout | null = null
    private lastTickAt = 0

    // ──────────────────────────────────────────────────────────────────
    //  Rivalis lifecycle hooks
    // ──────────────────────────────────────────────────────────────────

    /** RIVALIS: runs once when this room instance is created. */
    protected override onCreate(): void {
        // Wire each client→server topic to a handler. The `.bind(this)` is
        // necessary because `onCreate` runs from inside the parent `Room`
        // constructor, so class-field arrow methods don't exist yet.
        // Cross-ref: ArenaClient.sendInput sends `'input'` from the client.
        this.bind('input', this.onInput.bind(this))

        // ── Game loop (independent of Rivalis) ─────────────────────
        this.lastTickAt = Date.now()
        this.tickHandle = setInterval(() => this.tick(), TICK_MS)
        this.tickHandle.unref?.()
    }

    /** RIVALIS: runs each time an authenticated actor enters this room. */
    protected override onJoin(actor: Actor<ActorData>): void {
        // RIVALIS: `actor.data` is whatever AuthMiddleware.authenticate
        // returned — guaranteed non-null for any actor that reaches us.
        const { name, color } = actor.data!
        this.sim.addPlayer(actor.id, name, color)

        // RIVALIS unicast: tell THIS new client its own actor id so the
        // renderer can pick "you" out of the snapshot. Cross-ref:
        // ArenaClient registers ws.on('welcome', ...).
        const welcome: WelcomeEvent = { youAre: name, youId: actor.id, color }
        actor.send('welcome', encode(welcome))

        // RIVALIS broadcast: world changed (player added). Send a snapshot
        // immediately so the joiner doesn't wait up to one tick to see it.
        // Cross-ref: ArenaClient registers ws.on('arena:state', ...).
        this.broadcast('arena:state', encode(this.sim.snapshot()))
    }

    /** RIVALIS: runs when an actor disconnects (drop, kick, browser close). */
    protected override onLeave(actor: Actor<ActorData>): void {
        this.sim.removePlayer(actor.id)
    }

    /** RIVALIS: runs once when the manager destroys this room. */
    protected override onDestroy(): void {
        if (this.tickHandle !== null) clearInterval(this.tickHandle)
        this.tickHandle = null
    }

    /**
     * RIVALIS: optional — customizes what data goes into auto presence
     * broadcasts. Default would dump the entire `actor.data` object;
     * override here to scrub server-only fields before they hit clients.
     */
    protected override presencePayload(actor: Actor<ActorData>) {
        const { name, color } = actor.data!
        return { id: actor.id, name, color }
    }

    // ──────────────────────────────────────────────────────────────────
    //  Inbound topic handlers (registered in onCreate via `bind`)
    // ──────────────────────────────────────────────────────────────────

    /**
     * Handles 'input' frames. Cross-ref: ArenaClient.sendInput sends here.
     *
     * RIVALIS: payloads are opaque `Uint8Array` — the framework never
     * inspects them. We decode JSON ourselves and validate every field.
     * A throw out of a topic listener is logged but DOES NOT kick the
     * actor, so we have to validate explicitly.
     */
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

    // ──────────────────────────────────────────────────────────────────
    //  Game loop (NOT Rivalis — just `setInterval`)
    // ──────────────────────────────────────────────────────────────────

    /** 30 Hz tick. Broadcasts only when something visible changed. */
    private tick(): void {
        const now = Date.now()
        const dtMs = now - this.lastTickAt
        this.lastTickAt = now

        const snapshot = this.sim.tick(dtMs)
        if (snapshot !== null) {
            // RIVALIS broadcast: fan the new snapshot out to every actor
            // currently in this room.
            this.broadcast('arena:state', encode(snapshot))
        }
    }
}
