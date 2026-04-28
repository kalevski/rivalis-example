// ╔══════════════════════════════════════════════════════════════════════╗
// ║  ArenaClient — the browser-side Rivalis adapter                      ║
// ╠══════════════════════════════════════════════════════════════════════╣
// ║                                                                      ║
// ║  Mirror image of `server/src/rivalis/ArenaRoom.ts`. The only file    ║
// ║  in the browser bundle that imports `@rivalis/browser`. Everything   ║
// ║  Phaser-related lives in `../game/`.                                 ║
// ║                                                                      ║
// ║  WSClient surface used here                                          ║
// ║  ─────────────────────────                                           ║
// ║    new WSClient(url)               open a connection                 ║
// ║    ws.connect(ticket)              send the auth ticket              ║
// ║    ws.disconnect()                 close gracefully                  ║
// ║    ws.send('topic', bytes)         outbound to the server            ║
// ║    ws.on('topic'|'client:*', fn)   subscribe to inbound frames       ║
// ║                                                                      ║
// ║  Built-in events                                                     ║
// ║  ───────────────                                                     ║
// ║    'client:connect'         WebSocket handshake done                 ║
// ║    'client:disconnect'      socket closed (payload = reason bytes)   ║
// ║    'client:kicked'          server-initiated kick (4xxx codes)       ║
// ║                                                                      ║
// ║  Goal of THIS class: turn raw Rivalis events into typed app events   ║
// ║  (`status`, `welcome`, `snapshot`, …) so game code never sees a      ║
// ║  `Uint8Array` or a `client:disconnect`.                              ║
// ║                                                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { WSClient } from '@rivalis/browser'
import {
    decode, encode,
    type ArenaInput, type ArenaSnapshot, type PresenceEvent, type WelcomeEvent
} from '@rivalis-example/protocol'

// ──────────────────────────────────────────────────────────────
//  Public app-level event types
// ──────────────────────────────────────────────────────────────

export type ArenaClientStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

export type ArenaClientEvents = {
    status: (status: ArenaClientStatus, reason?: string) => void
    welcome: (event: WelcomeEvent) => void
    snapshot: (snapshot: ArenaSnapshot) => void
    presenceJoin: (event: PresenceEvent) => void
    presenceLeave: (event: PresenceEvent) => void
}

type Listener<K extends keyof ArenaClientEvents> = ArenaClientEvents[K]

const decoder = new TextDecoder()

// ──────────────────────────────────────────────────────────────
//  ArenaClient
// ──────────────────────────────────────────────────────────────

export default class ArenaClient {
    private ws: WSClient | null = null
    private listeners: { [K in keyof ArenaClientEvents]?: Listener<K>[] } = {}

    // ── Pub/sub bookkeeping (NOT Rivalis — plain typed event bus) ──────

    on<K extends keyof ArenaClientEvents>(event: K, fn: Listener<K>): void {
        ;(this.listeners[event] ??= [] as Listener<K>[]).push(fn)
    }

    off<K extends keyof ArenaClientEvents>(event: K, fn: Listener<K>): void {
        const arr = this.listeners[event]
        if (!arr) return
        const i = arr.indexOf(fn)
        if (i >= 0) arr.splice(i, 1)
    }

    private emit<K extends keyof ArenaClientEvents>(event: K, ...args: Parameters<Listener<K>>): void {
        const arr = this.listeners[event]
        if (!arr) return
        for (const fn of arr) (fn as (...a: unknown[]) => void)(...args)
    }

    // ── Lifecycle: open / close the WebSocket ──────────────────────────

    connect(url: string, ticket: string): void {
        if (this.ws) this.disconnect()

        // RIVALIS: open the WebSocket. Defaults are sensible (auto-
        // reconnect off, ticket sent via query). For production you'd
        // pass `{ reconnect: true, ticketSource: 'protocol' }`.
        const ws = new WSClient(url)
        this.ws = ws

        // RIVALIS built-in lifecycle events.
        ws.on('client:connect', () => this.emit('status', 'connected'), null)
        ws.on('client:disconnect', (payload) => {
            // The close-frame reason is a UTF-8 string ("server_shutdown",
            // "room_full", "invalid_ticket", etc.) — useful for the HUD.
            const reason = decoder.decode(payload as Uint8Array)
            this.emit('status', 'disconnected', reason)
            this.ws = null
        }, null)

        // RIVALIS app-defined topics. The 2nd arg is `Uint8Array`; we use
        // the shared protocol `decode<T>` to turn it into a typed value.
        // Cross-refs:
        //   'welcome'     ← ArenaRoom.onJoin   (actor.send)
        //   'arena:state' ← ArenaRoom.onJoin / .tick (broadcast)
        //   '__presence:*'← Rivalis built-in (presence = true on the room)
        ws.on('welcome', (p) => this.emit('welcome', decode<WelcomeEvent>(p)), null)
        ws.on('arena:state', (p) => this.emit('snapshot', decode<ArenaSnapshot>(p)), null)
        ws.on('__presence:join', (p) => this.emit('presenceJoin', decode<PresenceEvent>(p)), null)
        ws.on('__presence:leave', (p) => this.emit('presenceLeave', decode<PresenceEvent>(p)), null)

        this.emit('status', 'connecting')
        // RIVALIS: the ticket is whatever AuthMiddleware.authenticate
        // expects on the server. Here = the display name.
        ws.connect(ticket)
    }

    disconnect(): void {
        if (!this.ws) return
        // RIVALIS: graceful close. Cancels pending reconnects, nulls
        // the stored ticket, and fires `client:disconnect`.
        this.ws.disconnect()
        this.ws = null
    }

    // ── Outbound: turn intent into wire frames ─────────────────────────

    /**
     * Send the local input vector. Cross-ref:
     *   ArenaRoom.onCreate binds 'input' → ArenaRoom.onInput on the server.
     */
    sendInput(input: ArenaInput): void {
        if (!this.ws) return
        // RIVALIS: payloads are opaque bytes. We encode JSON; the server
        // decodes the same way.
        this.ws.send('input', encode(input))
    }
}
