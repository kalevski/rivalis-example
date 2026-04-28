// Every shape that flies across the wire. Both ends encode/decode using the
// helpers in `index.ts` (JSON over `Uint8Array`).

export type Direction = 'up' | 'down' | 'left' | 'right'

/** Sent once to each player right after they connect. */
export type WelcomeEvent = {
    youAre: string
    youId: string
    color: string
}

/** Server → all clients on join / leave (Rivalis built-in presence topic). */
export type PresenceEvent = {
    id: string
    name: string
    color: string
}

/** Client → server. Four booleans — server runs the physics. */
export type ArenaInput = {
    up: boolean
    down: boolean
    left: boolean
    right: boolean
}

export type ArenaPlayer = {
    id: string
    name: string
    color: string
    x: number
    y: number
    score: number
    dir: Direction              // last direction of motion (drives mouth/face)
    energizedUntil: number      // server ms timestamp; > Date.now() = powered up
}

export type Pellet = {
    id: string                  // "tx,ty" — unique per maze cell
    x: number
    y: number
    power: boolean              // big yellow = power pellet, small = regular
}

/** AI-driven ghost. Identical wire shape regardless of state — `scared`
 *  toggles flee behaviour and the dark-blue render. */
export type Ghost = {
    id: string
    color: string
    x: number
    y: number
    dir: Direction
    scared: boolean
}

/** The whole world, every tick. */
export type ArenaSnapshot = {
    t: number
    players: ArenaPlayer[]
    pellets: Pellet[]
    ghosts: Ghost[]
}
