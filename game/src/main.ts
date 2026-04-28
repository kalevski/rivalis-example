import * as Phaser from 'phaser'
import { ARENA, type ArenaPlayer } from '@rivalis-example/protocol'
import ArenaClient from './net/ArenaClient'
import ArenaScene from './game/ArenaScene'
import HUD from './ui/HUD'

const SERVER_URL = `ws://${location.hostname}:2334`

const scene = new ArenaScene()
const client = new ArenaClient()

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

scene.setCallbacks({
    onInput: (input) => client.sendInput(input),
    onScores: (players, id) => {
        hud.setLeaderboard(players, id)
        hud.setScore(findScore(players, id))
    }
})

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
