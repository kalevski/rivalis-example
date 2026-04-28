import { AuthMiddleware, type AuthResult } from '@rivalis/core'
import { ARENA_ROOM_ID } from '@rivalis-example/protocol'

export type ActorData = { name: string; color: string }

const PALETTE = [
    '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
    '#9b59b6', '#e67e22', '#1abc9c', '#e84393'
]

// stable color per name so refresh keeps the same one
function pickColor(name: string): string {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
    return PALETTE[h % PALETTE.length]!
}

export default class Auth extends AuthMiddleware<ActorData> {
    override async authenticate(ticket: string): Promise<AuthResult<ActorData> | null> {
        const name = ticket.trim()
        if (!name || name.length > 20) return null
        return {
            data: { name, color: pickColor(name) },
            roomId: ARENA_ROOM_ID
        }
    }
}
