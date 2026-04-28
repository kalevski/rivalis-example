import http from 'http'
import { Rivalis, Transports } from '@rivalis/core'
import { ARENA_ROOM_ID } from '@rivalis-example/protocol'
import Auth, { type ActorData } from './auth/AuthMiddleware'
import ArenaRoom from './rivalis/ArenaRoom'

const PORT = 2334

const server = http.createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('rivalis-example server')
})

const rivalis = new Rivalis<ActorData>({
    transports: [new Transports.WSTransport({ server })],
    authMiddleware: new Auth()
})

rivalis.rooms.define('arena', ArenaRoom)
rivalis.rooms.create('arena', ARENA_ROOM_ID)

server.listen(PORT, () => {
    console.log(`server listening on :${PORT}`)
})

const shutdown = async () => {
    await rivalis.shutdown({ timeoutMs: 5000 })
    server.close()
    process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
