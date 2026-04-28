// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Server entry point — Rivalis bootstrap                              ║
// ╠══════════════════════════════════════════════════════════════════════╣
// ║                                                                      ║
// ║  Read the server side in this order:                                 ║
// ║                                                                      ║
// ║    1. THIS FILE          how a Rivalis instance is constructed       ║
// ║    2. auth/AuthMiddleware.ts   who can connect, into which room      ║
// ║    3. rivalis/ArenaRoom.ts     the four lifecycle hooks + bind /     ║
// ║                                actor.send / broadcast                ║
// ║    4. game/ArenaSimulation.ts  pure game logic, no Rivalis import    ║
// ║                                                                      ║
// ║  Every line that touches the framework is tagged `RIVALIS:`. Grep    ║
// ║  for it to see every Rivalis call in the project.                    ║
// ║                                                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import http from 'http'
// RIVALIS: the framework's two top-level exports we use.
import { Rivalis, Transports } from '@rivalis/core'
import { ARENA_ROOM_ID } from '@rivalis-example/protocol'
import Auth, { type ActorData } from './auth/AuthMiddleware'
import ArenaRoom from './rivalis/ArenaRoom'

const PORT = 2334

// Plain Node HTTP server. Rivalis hooks into it via WSTransport — the same
// server can serve regular HTTP traffic side-by-side with the WebSocket
// upgrade for `ws://host:2334`.
const server = http.createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('rivalis-example server')
})

// RIVALIS: one Rivalis instance per process. It's the orchestrator:
//   - holds the list of transports (= ways clients can connect)
//   - holds exactly one auth middleware (= the door)
//   - exposes `.rooms` (= where game logic lives) and `.shutdown()`
//
//   Optional knobs you'd add for production:
//     - rateLimiter:  per-actor message rate cap (default token bucket on)
//     - logging:      level + reporter
//     - maxTopicLength
const rivalis = new Rivalis<ActorData>({
    transports: [new Transports.WSTransport({ server })],
    authMiddleware: new Auth()
})

// RIVALIS: rooms have a TWO-STEP setup.
//   1. `define` registers the *class* under a name. (Many room *types* can
//      live in one Rivalis instance: 'arena', 'lobby', 'private-match', ...)
//   2. `create` instantiates the class with a stable id. (Many *instances*
//      of one room type can run side-by-side: 'arena/global', 'arena/dev', ...)
//
// AuthMiddleware.authenticate's returned `roomId` MUST match a room id that
// `create` has already produced — otherwise Rivalis rejects the connection
// with "room id=... does not exist".
rivalis.rooms.define('arena', ArenaRoom)
rivalis.rooms.create('arena', ARENA_ROOM_ID)

server.listen(PORT, () => {
    console.log(`rivalis-example server listening on :${PORT}`)
})

// RIVALIS: graceful shutdown — destroys every room (kicking remaining actors
// with reason "server_shutdown") and disposes every transport. Skipping this
// leaves zombie sockets in dev / test harnesses.
const shutdown = async () => {
    await rivalis.shutdown({ timeoutMs: 5000 })
    server.close()
    process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
