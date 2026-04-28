// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Browser entry point — wires the three layers together               ║
// ╠══════════════════════════════════════════════════════════════════════╣
// ║                                                                      ║
// ║  Read the client side in this order:                                 ║
// ║                                                                      ║
// ║    1. THIS FILE                  glues net + scene + HUD             ║
// ║    2. net/ArenaClient.ts         the only @rivalis/browser import    ║
// ║    3. game/ArenaScene.ts         Phaser scene — pure game code       ║
// ║    4. game/{Player,Ghost,...}Sprite.ts   per-entity rendering        ║
// ║    5. ui/HUD.ts                  DOM form, score, leaderboard        ║
// ║                                                                      ║
// ║  Data flow                                                           ║
// ║                                                                      ║
// ║       keyboard  ──→  ArenaScene  ──→  ArenaClient.sendInput          ║
// ║                                            │                         ║
// ║                                            ▼  WebSocket              ║
// ║                                       (server runs tick)             ║
// ║                                            │                         ║
// ║                                            ▼  ws frames              ║
// ║       ArenaClient ──→ scene.applySnapshot (renders)                  ║
// ║                  └──→ hud.set{Status,Score,Leaderboard}              ║
// ║                                                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as Phaser from 'phaser'
import { ARENA, type ArenaPlayer } from '@rivalis-example/protocol'
import ArenaClient from './net/ArenaClient'
import ArenaScene from './game/ArenaScene'
import HUD from './ui/HUD'

// Server URL. In dev, host = "localhost"; in prod, point at your real host.
const SERVER_URL = `ws://${location.hostname}:2334`

// Three independent objects, three jobs:
//   - scene  : draws the game (Phaser only, no Rivalis)
//   - client : talks to the server (Rivalis only, no Phaser/DOM)
//   - hud    : DOM form / score / leaderboard (DOM only)
//
// `main.ts` is the only file allowed to know about all three.
const scene = new ArenaScene()
const client = new ArenaClient()

// Boot Phaser. The scene's `create()` runs once when this is ready.
new Phaser.Game({
    type: Phaser.AUTO,
    width: ARENA.width,
    height: ARENA.height,
    parent: 'game',
    backgroundColor: '#1a1a2e',
    scene: [scene]
})

let myId = ''
let myScore: number | null = null

const hud = new HUD({
    onJoin: (name) => client.connect(SERVER_URL, name),
    onLeave: () => client.disconnect()
})
hud.setStatus('idle')
hud.setScore(null)

// Scene → Client: forward local key changes as 'input' frames.
scene.setCallbacks({
    onInput: (input) => client.sendInput(input),
    onScores: (players, id) => {
        hud.setLeaderboard(players, id)
        hud.setScore(findScore(players, id))
    }
})

// Client → Scene + HUD: pipe server events into the game and the UI.
client.on('status', (status, reason) => {
    hud.setStatus(status, reason)
    if (status === 'disconnected' || status === 'idle') {
        scene.reset()
        hud.reset()
        myId = ''
        myScore = null
    }
})
client.on('welcome', (event) => {
    myId = event.youId
    scene.setLocalId(event.youId)
})
client.on('snapshot', (snapshot) => {
    scene.applySnapshot(snapshot)
    const score = findScore(snapshot.players, myId)
    if (score !== myScore) {
        myScore = score
        hud.setScore(score)
    }
})

function findScore(players: ArenaPlayer[], id: string): number | null {
    if (!id) return null
    for (const p of players) if (p.id === id) return p.score
    return null
}
