// ──────────────────────────────────────────────────────────────
//  AuthMiddleware — who gets in, and which room they go to
// ──────────────────────────────────────────────────────────────
//
//  This is the only place Rivalis lets you decide whether to accept a
//  connection. `authenticate` runs BEFORE any `Room` ever sees the actor,
//  so unauthorized clients are dropped at the door.
//
//  Lifecycle of `ActorData`:
//
//    Client                    Server
//    ──────                    ──────
//    ws.connect(ticket)  ──→   authenticate(ticket)
//                                returns { data, roomId } | null
//                                if null: socket closed (4001 INVALID_TICKET)
//                                if ok:   actor.data = data      ─┐
//                                         routed to room=roomId   │ for the
//                                                                 │ rest of
//    ws.send('input', ...)──→  ArenaRoom.onInput(actor, payload) ─┤ the
//                                actor.data is still { name, ... } │ session
//                                                                 ─┘
//
//  In a real app the `ticket` would be a JWT or one-time token from your
//  web backend, validated with `crypto.timingSafeEqual` for any secret
//  comparison. Here we use the display name to keep the demo runnable
//  without any backend dependency.

import { AuthMiddleware, type AuthResult } from '@rivalis/core'
import { ARENA_ROOM_ID } from '@rivalis-example/protocol'

/**
 * Whatever you return from `authenticate` becomes `actor.data` and lives
 * for the entire connection. Keep it small — it's hot in memory for every
 * inbound frame.
 */
export type ActorData = { name: string; color: string }

const PALETTE = [
    '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
    '#9b59b6', '#e67e22', '#1abc9c', '#e84393'
]

// Stable color per name so the same display name keeps the same color
// across reconnects. Pure cosmetics, not Rivalis-related.
function pickColor(name: string): string {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
    return PALETTE[h % PALETTE.length]!
}

export default class Auth extends AuthMiddleware<ActorData> {
    // RIVALIS: the only method Rivalis requires you to implement.
    //   - return `{ data, roomId }` to accept; data → actor.data, roomId selects room
    //   - return `null` to reject; Rivalis closes with code 4001 INVALID_TICKET
    override async authenticate(ticket: string): Promise<AuthResult<ActorData> | null> {
        const name = ticket.trim()
        if (!name || name.length > 20) return null
        return {
            data: { name, color: pickColor(name) },
            roomId: ARENA_ROOM_ID
        }
    }
}
