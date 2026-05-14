import { Scene, GameObject } from '@toolcase/phaser-plus'
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

type WithId = { id: string }

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
        const now = snapshot.t

        this.syncMap(this.players, PlayerSprite.KEY, snapshot.players,
            (sprite, p) => {
                sprite.setTarget(p.x, p.y, p.dir)
                sprite.setText(p.name, p.score)
                sprite.setEnergized(p.energizedUntil > now)
            },
            (sprite, p) => sprite.init(p, p.id === this.myId, p.energizedUntil > now)
        )

        this.syncMap(this.pellets, PelletSprite.KEY, snapshot.pellets,
            null,
            (sprite, pellet) => sprite.init(pellet)
        )

        this.syncMap(this.ghosts, GhostSprite.KEY, snapshot.ghosts,
            (sprite, g) => {
                sprite.setTarget(g.x, g.y, g.dir)
                sprite.setScared(g.scared)
            },
            (sprite, g) => sprite.init(g)
        )

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

    /** Reconcile a sprite map against an incoming snapshot list keyed by `id`. */
    private syncMap<R extends WithId, S extends GameObject>(
        map: Map<string, S>,
        poolKey: string,
        remote: ReadonlyArray<R>,
        update: ((sprite: S, item: R) => void) | null,
        create: (sprite: S, item: R) => void
    ): void {
        const seen = new Set<string>()
        for (const item of remote) {
            seen.add(item.id)
            const existing = map.get(item.id)
            if (existing) {
                update?.(existing, item)
            } else {
                const sprite = this.pool.obtain<S>(poolKey)!
                create(sprite, item)
                map.set(item.id, sprite)
            }
        }
        for (const [id, sprite] of map) {
            if (seen.has(id)) continue
            this.pool.release(sprite)
            map.delete(id)
        }
    }
}
