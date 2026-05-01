import { Scene } from '@toolcase/phaser-plus'
import {
    type ArenaInput, type ArenaPlayer, type ArenaSnapshot
} from '@rivalis-example/protocol'
import PlayerSprite from './prefabs/PlayerSprite'
import PelletSprite from './prefabs/PelletSprite'
import GhostSprite from './prefabs/GhostSprite'
import MazeFeature from './features/MazeFeature'
import ArenaInputFeature from './features/ArenaInputFeature'

export type ArenaSceneCallbacks = {
    onInput: (input: ArenaInput) => void
    onScores: (players: ArenaPlayer[], myId: string) => void
}

export default class ArenaScene extends Scene {
    private callbacks: ArenaSceneCallbacks | null = null
    private myId = ''
    private players = new Map<string, PlayerSprite>()
    private pellets = new Map<string, PelletSprite>()
    private ghosts = new Map<string, GhostSprite>()
    private inputFeature!: ArenaInputFeature

    constructor() {
        super('arena')
    }

    setCallbacks(callbacks: ArenaSceneCallbacks): void {
        this.callbacks = callbacks
        this.inputFeature?.onChange((input) => callbacks.onInput(input))
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
        for (const sprite of this.players.values()) this.pool.release(sprite)
        for (const sprite of this.pellets.values()) this.pool.release(sprite)
        for (const sprite of this.ghosts.values()) this.pool.release(sprite)
        this.players.clear()
        this.pellets.clear()
        this.ghosts.clear()
        this.myId = ''
        this.inputFeature.reset()
    }

    onCreate(): void {
        this.pool.register(PlayerSprite.KEY, PlayerSprite, null, (obj) => obj.reset())
        this.pool.register(GhostSprite.KEY, GhostSprite, null, (obj) => obj.reset())
        this.pool.register(PelletSprite.KEY, PelletSprite, null, (obj) => obj.reset())

        this.features.register(MazeFeature.KEY, MazeFeature)
        this.inputFeature = this.features.register(ArenaInputFeature.KEY, ArenaInputFeature)
        if (this.callbacks) {
            const handler = this.callbacks.onInput
            this.inputFeature.onChange((input) => handler(input))
        }
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
                const sprite = this.pool.obtain<PlayerSprite>(PlayerSprite.KEY)!
                sprite.init(p, p.id === this.myId, energized)
                this.players.set(p.id, sprite)
            }
        }
        for (const [id, sprite] of this.players) {
            if (seen.has(id)) continue
            this.pool.release(sprite)
            this.players.delete(id)
        }
    }

    private applyPellets(snapshot: ArenaSnapshot): void {
        const ids = new Set<string>()
        for (const pellet of snapshot.pellets) {
            ids.add(pellet.id)
            if (this.pellets.has(pellet.id)) continue
            const sprite = this.pool.obtain<PelletSprite>(PelletSprite.KEY)!
            sprite.init(pellet)
            this.pellets.set(pellet.id, sprite)
        }
        for (const [id, sprite] of this.pellets) {
            if (ids.has(id)) continue
            this.pool.release(sprite)
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
                const sprite = this.pool.obtain<GhostSprite>(GhostSprite.KEY)!
                sprite.init(g)
                this.ghosts.set(g.id, sprite)
            }
        }
        for (const [id, sprite] of this.ghosts) {
            if (seen.has(id)) continue
            this.pool.release(sprite)
            this.ghosts.delete(id)
        }
    }
}
