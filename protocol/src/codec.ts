// ──────────────────────────────────────────────────────────────
//  Wire codec (RIVALIS-LESSON)
// ──────────────────────────────────────────────────────────────
//
//  Rivalis treats every message payload as opaque bytes — `Uint8Array` in,
//  `Uint8Array` out. The framework never inspects what's inside. That means
//  YOU pick the encoding: JSON, Protobuf, MessagePack, raw bytes, anything.
//
//  This project uses JSON for readability. Both server and client import the
//  same `encode` / `decode` from here, so the wire format stays in sync.
//
//  Server use:
//      this.broadcast('arena:state', encode(snapshot))
//
//  Client use:
//      ws.on('arena:state', (bytes) => decode<ArenaSnapshot>(bytes))

const enc = new TextEncoder()
const dec = new TextDecoder()

export const encode = <T>(value: T): Uint8Array => enc.encode(JSON.stringify(value))
export const decode = <T>(payload: Uint8Array): T => JSON.parse(dec.decode(payload)) as T
