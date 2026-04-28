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

/**
 * Pure game state — knows nothing about Rivalis or networks.
 *
 * Owns the maze, the live pellets, every player's body, and the AI ghosts.
 * The Rivalis adapter (ArenaRoom) drives this via `addPlayer / removePlayer
 * / setInput / tick`; the simulation never imports `@rivalis/core`.
 */
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
        const p = this.players.get(id)
        if (p) p.input = input
    }

    tick(dtMs: number): ArenaSnapshot | null {
        const dt = dtMs / 1000
        if (dt <= 0) return null
        const now = Date.now()
        const playerStep = ARENA.speed * dt
        let dirty = false

        for (const p of this.players.values()) {
            if (this.movePlayer(p, playerStep)) dirty = true
            if (this.consumePelletAt(p, now)) dirty = true
        }

        if (this.resolvePlayerCollisions(now)) dirty = true

        // Ghosts run scared whenever ANY pacman is energized — easier to
        // spot the global state in HUD too.
        const anyEnergized = this.isAnyEnergized(now)
        const ghostStep = (anyEnergized ? ARENA.ghostScaredSpeed : ARENA.ghostSpeed) * dt
        for (const g of this.ghosts) {
            this.tickGhost(g, ghostStep, anyEnergized)
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

    // -- player movement & pickups --

    private movePlayer(p: Player, step: number): boolean {
        const requested = dirFromInput(p.input)
        const tryOrder: Direction[] = []
        if (requested) tryOrder.push(requested)
        if (requested !== p.dir) tryOrder.push(p.dir)

        for (const d of tryOrder) {
            const nx = p.x + DX[d] * step
            const ny = p.y + DY[d] * step
            if (canMoveTo(nx, ny)) {
                p.x = nx; p.y = ny; p.dir = d
                return true
            }
        }
        return false
    }

    private consumePelletAt(p: Player, now: number): boolean {
        const tx = Math.floor(p.x / TILE_SIZE)
        const ty = Math.floor(p.y / TILE_SIZE)
        const key = `${tx},${ty}`
        const pellet = this.pellets.get(key)
        if (!pellet) return false
        const dx = p.x - pellet.x
        const dy = p.y - pellet.y
        if (dx * dx + dy * dy > PELLET_PICKUP_SQ) return false

        this.pellets.delete(key)
        if (pellet.power) {
            p.score += 5
            p.energizedUntil = now + ARENA.energizedMs
        } else {
            p.score += 1
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
                const aE = a.energizedUntil > now
                const bE = b.energizedUntil > now
                if (aE && !bE) { this.chompPlayer(a, b); dirty = true }
                else if (bE && !aE) { this.chompPlayer(b, a); dirty = true }
            }
        }
        return dirty
    }

    private chompPlayer(eater: Player, victim: Player): void {
        eater.score += ARENA.chompScore
        victim.score = Math.max(0, victim.score - ARENA.deathPenalty)
        const { x, y } = pickSpawn()
        victim.x = x
        victim.y = y
    }

    private isAnyEnergized(now: number): boolean {
        for (const p of this.players.values()) {
            if (p.energizedUntil > now) return true
        }
        return false
    }

    // -- ghosts --

    private spawnGhosts(): void {
        const home = ghostHome()
        for (let i = 0; i < ARENA.ghostCount; i++) {
            // Spread spawn slightly so ghosts don't stack on tile center.
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

    private tickGhost(g: GhostState, step: number, scared: boolean): void {
        // Try the current direction first. If a wall blocks us, force a new
        // pick. We always re-decide at tile centers so ghosts can pick up
        // intersections without overshooting.
        let nx = g.x + DX[g.dir] * step
        let ny = g.y + DY[g.dir] * step
        if (!canMoveTo(nx, ny)) {
            g.dir = this.pickGhostDir(g, scared)
            nx = g.x + DX[g.dir] * step
            ny = g.y + DY[g.dir] * step
            if (!canMoveTo(nx, ny)) return
        }
        g.x = nx
        g.y = ny

        const tx = Math.floor(g.x / TILE_SIZE)
        const ty = Math.floor(g.y / TILE_SIZE)
        if (tx !== g.lastTx || ty !== g.lastTy) {
            g.lastTx = tx
            g.lastTy = ty
            // Re-evaluate direction at intersections, but not every tile —
            // some inertia keeps motion readable.
            if (Math.random() < 0.7) g.dir = this.pickGhostDir(g, scared)
        }
    }

    private pickGhostDir(g: GhostState, scared: boolean): Direction {
        const target = this.nearestPacman(g)
        const reverse = REVERSE[g.dir]
        const options: Direction[] = []
        for (const d of ALL_DIRS) {
            if (d === reverse) continue
            // Peek into the next tile, not just one step ahead, so we don't
            // pick a direction that wedges us against an immediate wall.
            const peekX = g.x + DX[d] * (TILE_SIZE * 0.6)
            const peekY = g.y + DY[d] * (TILE_SIZE * 0.6)
            if (canMoveTo(peekX, peekY)) options.push(d)
        }
        if (options.length === 0) return reverse

        if (!target) return pickRandom(options)

        let best = options[0]!
        let bestScore = scared ? -Infinity : Infinity
        for (const d of options) {
            const peekX = g.x + DX[d] * TILE_SIZE
            const peekY = g.y + DY[d] * TILE_SIZE
            const dx = target.x - peekX
            const dy = target.y - peekY
            const dist = dx * dx + dy * dy
            if (scared) {
                if (dist > bestScore) { best = d; bestScore = dist }
            } else {
                if (dist < bestScore) { best = d; bestScore = dist }
            }
        }
        return best
    }

    private nearestPacman(g: GhostState): Player | null {
        let best: Player | null = null
        let bestDist = Infinity
        for (const p of this.players.values()) {
            const dx = p.x - g.x
            const dy = p.y - g.y
            const dist = dx * dx + dy * dy
            if (dist < bestDist) { best = p; bestDist = dist }
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
                    // Pacman chomps ghost — big points, ghost teleports home.
                    player.score += ARENA.ghostEatScore
                    const home = ghostHome()
                    ghost.x = home.x
                    ghost.y = home.y
                    ghost.dir = pickRandom(ALL_DIRS)
                    ghost.lastTx = ARENA.ghostHomeTx
                    ghost.lastTy = ARENA.ghostHomeTy
                } else {
                    // Ghost catches pacman — light penalty, respawn elsewhere.
                    player.score = Math.max(0, player.score - ARENA.deathPenalty)
                    const spawn = pickSpawn()
                    player.x = spawn.x
                    player.y = spawn.y
                }
                dirty = true
            }
        }
        return dirty
    }

    // -- pellets --

    private regeneratePellets(): void {
        this.pellets.clear()
        for (const p of listPelletTiles()) {
            const id = `${p.tx},${p.ty}`
            const c = tileCenter(p.tx, p.ty)
            this.pellets.set(id, { id, x: c.x, y: c.y, power: p.power })
        }
    }
}
