import {
    ARENA, TILE_SIZE,
    isWallTile, listOpenTiles, listPelletTiles, tileCenter,
    type ArenaInput, type ArenaPlayer, type ArenaSnapshot,
    type Direction, type Ghost, type Pellet
} from '@rivalis-example/protocol'

const DX: Record<Direction, number> = { up: 0, down: 0, left: -1, right: 1 }
const DY: Record<Direction, number> = { up: -1, down: 1, left: 0, right: 0 }
const REVERSE: Record<Direction, Direction> = {
    up: 'down', down: 'up', left: 'right', right: 'left'
}
const ALL_DIRS: ReadonlyArray<Direction> = ['up', 'down', 'left', 'right']
const GHOST_COLORS = ['#ef4444', '#f472b6', '#22d3ee', '#fb923c']

const ZERO_INPUT: ArenaInput = { up: false, down: false, left: false, right: false }

const EAT_DISTANCE_SQ = ARENA.eatDistance * ARENA.eatDistance
const PELLET_PICKUP_SQ = ARENA.pelletPickupDistance * ARENA.pelletPickupDistance

type Player = {
    id: string
    name: string
    color: string
    x: number
    y: number
    score: number
    dir: Direction
    energizedUntil: number
    input: ArenaInput
}

type GhostState = {
    id: string
    color: string
    x: number
    y: number
    dir: Direction
    lastTx: number
    lastTy: number
}

function dirFromInput(input: ArenaInput): Direction | null {
    if (input.up) return 'up'
    if (input.down) return 'down'
    if (input.left) return 'left'
    if (input.right) return 'right'
    return null
}

function pickRandom<T>(arr: ReadonlyArray<T>): T {
    return arr[Math.floor(Math.random() * arr.length)]!
}

function pickSpawn(): { x: number; y: number } {
    const tile = pickRandom(listOpenTiles())
    return tileCenter(tile.tx, tile.ty)
}

function ghostHome(): { x: number; y: number } {
    return tileCenter(ARENA.ghostHomeTx, ARENA.ghostHomeTy)
}

// 4 corner samples — if any sits on a wall tile, blocked
function canMoveTo(x: number, y: number): boolean {
    const r = ARENA.playerRadius
    const corners: ReadonlyArray<readonly [number, number]> = [
        [x - r, y - r],
        [x + r, y - r],
        [x - r, y + r],
        [x + r, y + r]
    ]
    for (const [px, py] of corners) {
        if (isWallTile(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE))) return false
    }
    return true
}

export default class ArenaSimulation {
    private players = new Map<string, Player>()
    private pellets = new Map<string, Pellet>()
    private ghosts: GhostState[] = []

    constructor() {
        this.regeneratePellets()
        this.spawnGhosts()
    }

    addPlayer(id: string, name: string, color: string): void {
        const { x, y } = pickSpawn()
        this.players.set(id, {
            id, name, color, x, y,
            score: 0,
            dir: 'right',
            energizedUntil: 0,
            input: { ...ZERO_INPUT }
        })
    }

    removePlayer(id: string): void {
        this.players.delete(id)
    }

    setInput(id: string, input: ArenaInput): void {
        const player = this.players.get(id)
        if (player) player.input = input
    }

    tick(dtMs: number): ArenaSnapshot | null {
        const dt = dtMs / 1000
        if (dt <= 0) return null
        const now = Date.now()
        const playerStep = ARENA.speed * dt
        let dirty = false

        for (const player of this.players.values()) {
            if (this.movePlayer(player, playerStep)) dirty = true
            if (this.consumePelletAt(player, now)) dirty = true
        }

        if (this.resolvePlayerCollisions(now)) dirty = true

        const anyEnergized = this.isAnyEnergized(now)
        const ghostStep = (anyEnergized ? ARENA.ghostScaredSpeed : ARENA.ghostSpeed) * dt
        for (const ghost of this.ghosts) {
            this.tickGhost(ghost, ghostStep, anyEnergized)
            dirty = true
        }

        if (this.resolveGhostCollisions(now)) dirty = true

        if (this.pellets.size === 0) {
            this.regeneratePellets()
            dirty = true
        }

        return dirty ? this.snapshot() : null
    }

    snapshot(): ArenaSnapshot {
        const now = Date.now()
        const anyEnergized = this.isAnyEnergized(now)

        const players: ArenaPlayer[] = []
        for (const p of this.players.values()) {
            players.push({
                id: p.id, name: p.name, color: p.color,
                x: Math.round(p.x), y: Math.round(p.y),
                score: p.score,
                dir: p.dir,
                energizedUntil: p.energizedUntil
            })
        }

        const ghosts: Ghost[] = this.ghosts.map((g) => ({
            id: g.id,
            color: g.color,
            x: Math.round(g.x),
            y: Math.round(g.y),
            dir: g.dir,
            scared: anyEnergized
        }))

        return { t: now, players, pellets: [...this.pellets.values()], ghosts }
    }

    private movePlayer(player: Player, step: number): boolean {
        const requested = dirFromInput(player.input)
        if (requested === null) return false
        // try requested dir, fall back to current — keeps gliding through corridors
        const tryOrder: Direction[] = [requested]
        if (requested !== player.dir) tryOrder.push(player.dir)

        for (const dir of tryOrder) {
            const nx = player.x + DX[dir] * step
            const ny = player.y + DY[dir] * step
            if (canMoveTo(nx, ny)) {
                player.x = nx
                player.y = ny
                player.dir = dir
                return true
            }
        }
        return false
    }

    private consumePelletAt(player: Player, now: number): boolean {
        const tx = Math.floor(player.x / TILE_SIZE)
        const ty = Math.floor(player.y / TILE_SIZE)
        const key = `${tx},${ty}`
        const pellet = this.pellets.get(key)
        if (!pellet) return false
        const dx = player.x - pellet.x
        const dy = player.y - pellet.y
        if (dx * dx + dy * dy > PELLET_PICKUP_SQ) return false

        this.pellets.delete(key)
        if (pellet.power) {
            player.score += ARENA.powerPelletScore
            player.energizedUntil = now + ARENA.energizedMs
        } else {
            player.score += ARENA.dotScore
        }
        return true
    }

    private resolvePlayerCollisions(now: number): boolean {
        const arr = [...this.players.values()]
        let dirty = false
        for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
                const a = arr[i]!
                const b = arr[j]!
                const dx = a.x - b.x
                const dy = a.y - b.y
                if (dx * dx + dy * dy > EAT_DISTANCE_SQ) continue
                const aEnergized = a.energizedUntil > now
                const bEnergized = b.energizedUntil > now
                if (aEnergized && !bEnergized) { this.chompPlayer(a, b); dirty = true }
                else if (bEnergized && !aEnergized) { this.chompPlayer(b, a); dirty = true }
            }
        }
        return dirty
    }

    private chompPlayer(eater: Player, victim: Player): void {
        eater.score += ARENA.chompScore
        this.respawnPlayer(victim)
    }

    private respawnPlayer(player: Player): void {
        player.score = Math.max(0, player.score - ARENA.deathPenalty)
        const { x, y } = pickSpawn()
        player.x = x
        player.y = y
    }

    private sendGhostHome(ghost: GhostState): void {
        const { x, y } = ghostHome()
        ghost.x = x
        ghost.y = y
        ghost.dir = pickRandom(ALL_DIRS)
        ghost.lastTx = ARENA.ghostHomeTx
        ghost.lastTy = ARENA.ghostHomeTy
    }

    private isAnyEnergized(now: number): boolean {
        for (const player of this.players.values()) {
            if (player.energizedUntil > now) return true
        }
        return false
    }

    private spawnGhosts(): void {
        const home = ghostHome()
        for (let i = 0; i < ARENA.ghostCount; i++) {
            this.ghosts.push({
                id: `g${i}`,
                color: GHOST_COLORS[i % GHOST_COLORS.length]!,
                x: home.x + (i - (ARENA.ghostCount - 1) / 2) * 2,
                y: home.y,
                dir: pickRandom(ALL_DIRS),
                lastTx: ARENA.ghostHomeTx,
                lastTy: ARENA.ghostHomeTy
            })
        }
    }

    private tickGhost(ghost: GhostState, step: number, scared: boolean): void {
        let nx = ghost.x + DX[ghost.dir] * step
        let ny = ghost.y + DY[ghost.dir] * step
        if (!canMoveTo(nx, ny)) {
            ghost.dir = this.pickGhostDir(ghost, scared)
            nx = ghost.x + DX[ghost.dir] * step
            ny = ghost.y + DY[ghost.dir] * step
            if (!canMoveTo(nx, ny)) return
        }
        ghost.x = nx
        ghost.y = ny

        const tx = Math.floor(ghost.x / TILE_SIZE)
        const ty = Math.floor(ghost.y / TILE_SIZE)
        if (tx !== ghost.lastTx || ty !== ghost.lastTy) {
            ghost.lastTx = tx
            ghost.lastTy = ty
            // re-pick at some intersections, not every one — keeps motion readable
            if (Math.random() < 0.7) ghost.dir = this.pickGhostDir(ghost, scared)
        }
    }

    private pickGhostDir(ghost: GhostState, scared: boolean): Direction {
        const target = this.nearestPacman(ghost)
        const reverse = REVERSE[ghost.dir]
        const options: Direction[] = []
        for (const dir of ALL_DIRS) {
            if (dir === reverse) continue
            // peek further than one step so we don't wedge against a wall
            const peekX = ghost.x + DX[dir] * (TILE_SIZE * 0.6)
            const peekY = ghost.y + DY[dir] * (TILE_SIZE * 0.6)
            if (canMoveTo(peekX, peekY)) options.push(dir)
        }
        if (options.length === 0) return reverse
        if (!target) return pickRandom(options)

        const sign = scared ? -1 : 1
        let best = options[0]!
        let bestScore = Infinity
        for (const dir of options) {
            const peekX = ghost.x + DX[dir] * TILE_SIZE
            const peekY = ghost.y + DY[dir] * TILE_SIZE
            const dx = target.x - peekX
            const dy = target.y - peekY
            const score = sign * (dx * dx + dy * dy)
            if (score < bestScore) { best = dir; bestScore = score }
        }
        return best
    }

    private nearestPacman(ghost: GhostState): Player | null {
        let best: Player | null = null
        let bestDist = Infinity
        for (const player of this.players.values()) {
            const dx = player.x - ghost.x
            const dy = player.y - ghost.y
            const dist = dx * dx + dy * dy
            if (dist < bestDist) { best = player; bestDist = dist }
        }
        return best
    }

    private resolveGhostCollisions(now: number): boolean {
        let dirty = false
        for (const player of this.players.values()) {
            const energized = player.energizedUntil > now
            for (const ghost of this.ghosts) {
                const dx = player.x - ghost.x
                const dy = player.y - ghost.y
                if (dx * dx + dy * dy > EAT_DISTANCE_SQ) continue
                if (energized) {
                    player.score += ARENA.ghostEatScore
                    this.sendGhostHome(ghost)
                } else {
                    this.respawnPlayer(player)
                }
                dirty = true
            }
        }
        return dirty
    }

    private regeneratePellets(): void {
        this.pellets.clear()
        for (const tile of listPelletTiles()) {
            const id = `${tile.tx},${tile.ty}`
            const center = tileCenter(tile.tx, tile.ty)
            this.pellets.set(id, { id, x: center.x, y: center.y, power: tile.power })
        }
    }
}
