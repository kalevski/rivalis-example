import * as Phaser from 'phaser'
import {
    type ArenaInput, type ArenaPlayer, type ArenaSnapshot
} from '@rivalis-example/protocol'
import InputController from './InputController'
import PlayerSprite from './PlayerSprite'
import PelletSprite from './PelletSprite'
import GhostSprite from './GhostSprite'
import MazeRenderer from './MazeRenderer'

export type ArenaSceneCallbacks = {
    onInput: (input: ArenaInput) => void
    onScores: (players: ArenaPlayer[], myId: string) => void
}

/**
 * The Phaser scene. Pure game code:
 *   - knows nothing about Rivalis or WebSockets
 *   - receives state via `applySnapshot()` (called by main.ts)
 *   - reports input via the `onInput` callback
 */
export default class ArenaScene extends Phaser.Scene {
    private callbacks: ArenaSceneCallbacks | null = null
    private input$: InputController | null = null
    private myId = ''
    private players = new Map<string, PlayerSprite>()
    private pellets = new Map<string, PelletSprite>()
    private ghosts = new Map<string, GhostSprite>()

    constructor() {
        super('arena')
    }

    setCallbacks(callbacks: ArenaSceneCallbacks): void {
        this.callbacks = callbacks
    }

    setLocalId(id: string): void {
        this.myId = id
    }

    applySnapshot(snapshot: ArenaSnapshot): void {
        const now = Date.now()
        this.applyPlayers(snapshot.players, now)
        this.applyPellets(snapshot)
        this.applyGhosts(snapshot)
        this.callbacks?.onScores(snapshot.players, this.myId)
    }

    reset(): void {
        for (const sprite of this.players.values()) sprite.destroy()
        for (const sprite of this.pellets.values()) sprite.destroy()
        for (const sprite of this.ghosts.values()) sprite.destroy()
        this.players.clear()
        this.pellets.clear()
        this.ghosts.clear()
        this.myId = ''
        this.input$?.reset()
    }

    create(): void {
        new MazeRenderer(this)
        this.input$ = new InputController(this, (input) => this.callbacks?.onInput(input))
    }

    update(_time: number, delta: number): void {
        this.input$?.sample()
        for (const sprite of this.players.values()) sprite.update(delta)
        for (const sprite of this.ghosts.values()) sprite.update(delta)
    }

    private applyPlayers(remote: ArenaPlayer[], now: number): void {
        const seen = new Set<string>()
        for (const p of remote) {
            seen.add(p.id)
            const energized = p.energizedUntil > now
            const existing = this.players.get(p.id)
            if (existing) {
                existing.setTarget(p.x, p.y, p.dir)
                existing.setText(p.name, p.score)
                existing.setEnergized(energized)
            } else {
                const sprite = new PlayerSprite(this, p.x, p.y, p.color, p.name, p.score, p.id === this.myId)
                sprite.setEnergized(energized)
                sprite.setTarget(p.x, p.y, p.dir)
                this.players.set(p.id, sprite)
            }
        }
        for (const [id, sprite] of this.players) {
            if (seen.has(id)) continue
            sprite.destroy()
            this.players.delete(id)
        }
    }

    private applyPellets(snapshot: ArenaSnapshot): void {
        const ids = new Set<string>()
        for (const pellet of snapshot.pellets) {
            ids.add(pellet.id)
            if (this.pellets.has(pellet.id)) continue
            this.pellets.set(pellet.id, new PelletSprite(this, pellet.x, pellet.y, pellet.power))
        }
        for (const [id, sprite] of this.pellets) {
            if (ids.has(id)) continue
            sprite.destroy()
            this.pellets.delete(id)
        }
    }

    private applyGhosts(snapshot: ArenaSnapshot): void {
        const seen = new Set<string>()
        for (const g of snapshot.ghosts) {
            seen.add(g.id)
            const existing = this.ghosts.get(g.id)
            if (existing) {
                existing.setTarget(g.x, g.y, g.dir)
                existing.setScared(g.scared)
            } else {
                const sprite = new GhostSprite(this, g.x, g.y, g.color)
                sprite.setScared(g.scared)
                sprite.setTarget(g.x, g.y, g.dir)
                this.ghosts.set(g.id, sprite)
            }
        }
        for (const [id, sprite] of this.ghosts) {
            if (seen.has(id)) continue
            sprite.destroy()
            this.ghosts.delete(id)
        }
    }
}
