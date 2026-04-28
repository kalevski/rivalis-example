export type Direction = 'up' | 'down' | 'left' | 'right'

export type WelcomeEvent = {
    youAre: string
    youId: string
    color: string
}

export type PresenceEvent = {
    id: string
    name: string
    color: string
}

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
    dir: Direction
    energizedUntil: number
}

export type Pellet = {
    id: string
    x: number
    y: number
    power: boolean
}

export type Ghost = {
    id: string
    color: string
    x: number
    y: number
    dir: Direction
    scared: boolean
}

export type ArenaSnapshot = {
    t: number
    players: ArenaPlayer[]
    pellets: Pellet[]
    ghosts: Ghost[]
}
