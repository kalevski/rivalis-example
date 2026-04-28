# rivalis-example

A minimal, fully-commented multiplayer game built on
[**Rivalis**](https://www.npmjs.com/package/@rivalis/core) — a Node.js
framework for real-time apps over WebSocket. The game is a multiplayer
**pac-maze**: collect dots, grab a power pellet, then chase down rival
players and AI ghosts while you glow.

The codebase is small on purpose. Every file is structured so the
**Rivalis touchpoints stand out** from the game logic, and every framework
call is tagged with a `RIVALIS:` marker comment. Run

```sh
grep -rn RIVALIS: .
```

from the project root to print the entire framework footprint of the app
on a single screen.

---

## Table of contents

- [Quick start](#quick-start)
- [How to play](#how-to-play)
- [What is Rivalis?](#what-is-rivalis)
- [Rivalis features used in this game](#rivalis-features-used-in-this-game)
- [Project layout](#project-layout)
- [Read the code in this order](#read-the-code-in-this-order)
- [What happens when you press a key](#what-happens-when-you-press-a-key)
- [Customize / extend](#customize--extend)
- [Build for production](#build-for-production)

---

## Quick start

```sh
git clone <this repo>
cd rivalis-example
npm install
npm run dev
```

This runs two processes in parallel via `concurrently`:

| Process | Port | What |
|---------|------|------|
| `server` | `2334` | Node + Rivalis (`@rivalis/core`) |
| `game`   | `5173` | Vite dev server (Phaser + `@rivalis/browser`) |

Open <http://localhost:5173> in **two browser tabs**, pick names, hit Join.

### Other scripts

| Command | What |
|--------|------|
| `npm run dev` | Run server + game in dev mode (hot reload). |
| `npm run dev:server` | Just the server. |
| `npm run dev:game` | Just the game (Vite). |
| `npm run build` | Type-check + produce `server/dist/` and `game/dist/`. |

### Requirements

- Node.js 22+ (the smoke tests rely on a global `WebSocket`)
- npm 10+ (workspaces are used; `pnpm` and `yarn` work too)

---

## How to play

WASD or arrow keys to move. Eat a glowing pellet → glow yellow for 8 s.

| Action | Score |
|--------|------:|
| Eat a regular dot | **+1** |
| Eat a power pellet | **+5** (and glow for 8 s) |
| While glowing: bump another pacman | **+10** (they lose 5 + respawn) |
| While glowing: bump a ghost | **+50** (ghost teleports home) |
| Get caught by a ghost (not glowing) | **−5** + respawn |

Three AI ghosts (red, pink, cyan) chase the nearest pacman. When **anyone**
is glowing, all ghosts turn dark blue, slow down, and run away.

---

## What is Rivalis?

Rivalis is a tiny, opinionated Node.js framework for real-time multiplayer
apps over WebSocket. You write three things:

| Thing | What it is |
|-------|------------|
| **`AuthMiddleware`** | Decides who's allowed to connect, and which **room** they go into. |
| **`Room`** | Owns one game session. Receives messages from clients, broadcasts updates back. |
| **`WSClient`** | The browser-side counterpart. Connects, sends, listens. |

Everything else — physics, rendering, UI, persistence — is regular code.
Rivalis stays out of the way.

The wire format is binary: every message is `{ topic: string, payload:
Uint8Array }`. The framework never inspects `payload` — you pick the
encoding (this project uses JSON; Protobuf or MessagePack would work too).

---

## Rivalis features used in this game

Every feature listed below has a `RIVALIS:` comment next to its callsite.

### Server-side

#### `Rivalis` — the orchestrator
> [server/src/index.ts](server/src/index.ts)

```ts
const rivalis = new Rivalis<ActorData>({
    transports: [new Transports.WSTransport({ server })],
    authMiddleware: new Auth()
})
```

One instance per process. It owns the transports, auth, rate limiter,
and the `RoomManager` exposed as `rivalis.rooms`.

#### `WSTransport` — WebSocket adapter
> [server/src/index.ts](server/src/index.ts)

Hooks into a plain Node `http.Server` so you can serve regular HTTP and
WebSockets on the same port. You can pass multiple transports (TCP,
WebTransport, etc.) to one Rivalis instance.

#### `AuthMiddleware` — the doorman
> [server/src/auth/AuthMiddleware.ts](server/src/auth/AuthMiddleware.ts)

The only method you have to implement is `authenticate(ticket)`:

- return `{ data, roomId }` to accept; `data` becomes `actor.data` for
  the rest of the connection's life
- return `null` to reject; Rivalis closes with code **4001 INVALID_TICKET**

This is where a real app would verify a JWT, run timing-safe HMAC
comparison, look up a session row, or call a backend.

#### Two-step room setup: `define` + `create`
> [server/src/index.ts](server/src/index.ts)

```ts
rivalis.rooms.define('arena', ArenaRoom)   // register the class
rivalis.rooms.create('arena', 'arena')     // instantiate with stable id
```

`AuthMiddleware`'s returned `roomId` must match a `create`d instance, or
Rivalis rejects the connection at the door.

#### `Room` lifecycle hooks
> [server/src/rivalis/ArenaRoom.ts](server/src/rivalis/ArenaRoom.ts)

| Hook | When |
|------|------|
| `onCreate()` | Once per room instance. Bind topics, start tick. |
| `onJoin(actor)` | Each authenticated actor enters. |
| `onLeave(actor)` | Each actor disconnects. |
| `onDestroy()` | Once when the room shuts down. |

#### Three I/O primitives
> [server/src/rivalis/ArenaRoom.ts](server/src/rivalis/ArenaRoom.ts)

```ts
this.bind('input', this.onInput.bind(this))   // client→server topic
actor.send('welcome', encode(welcome))        // unicast
this.broadcast('arena:state', encode(snap))   // fan-out
```

That's it. Every server-side multiplayer pattern in this project is
expressed as a combination of these three calls plus the four hooks above.

#### Built-in presence
> [server/src/rivalis/ArenaRoom.ts](server/src/rivalis/ArenaRoom.ts)

```ts
protected override presence = true
```

One line opts the room into automatic `__presence:join` /
`__presence:leave` broadcasts. We override `presencePayload(actor)` to
control exactly which fields go on the wire (no leaking server-only
state).

#### Graceful shutdown
> [server/src/index.ts](server/src/index.ts)

```ts
await rivalis.shutdown({ timeoutMs: 5000 })
```

Destroys every room (kicking remaining actors with reason
`server_shutdown`), then disposes every transport. Wired to `SIGINT` /
`SIGTERM` so dev workflows don't leave zombie sockets.

### Client-side

#### `WSClient` — the browser counterpart
> [game/src/net/ArenaClient.ts](game/src/net/ArenaClient.ts)

```ts
const ws = new WSClient('ws://host:2334')
ws.connect(ticket)
ws.send('input', encode(input))
ws.on('arena:state', (bytes) => decode(bytes))
ws.on('client:disconnect', (payload) => /* reason bytes */)
```

Native `WebSocket` under the hood — no `ws` polyfill, no extra build step.
Built-in events:

| Event | When |
|-------|------|
| `client:connect` | Handshake done |
| `client:disconnect` | Socket closed (payload = reason bytes) |
| `client:kicked` | Server-initiated kick (4xxx codes) |

Reconnection, exponential backoff, and short-lived JWT refresh are also
supported but not needed for this demo.

### Shared

#### Opaque-bytes payloads + a tiny codec
> [protocol/src/codec.ts](protocol/src/codec.ts)

The framework treats payloads as raw bytes. Both ends import the same
`encode` / `decode` so the wire format is one place to change.

#### Type-safe topic names
> [protocol/src/topics.ts](protocol/src/topics.ts)

```ts
export type ServerTopic = 'welcome' | 'arena:state' | '__presence:join' | '__presence:leave'
export type ClientTopic = 'input'
```

A typo on either side is now a compile-time error, not a runtime mystery.

---

## Project layout

```
rivalis-example/
├── protocol/                 ← shared TypeScript types (the wire contract)
│   └── src/
│       ├── topics.ts         ← Rivalis routing keys + ARENA_ROOM_ID
│       ├── tunables.ts       ← game numbers (no Rivalis here)
│       ├── messages.ts       ← every shape that flies over the network
│       ├── maze.ts           ← the maze ASCII + tile helpers
│       ├── codec.ts          ← encode() / decode() bytes <-> JSON
│       └── index.ts          ← re-exports
│
├── server/
│   └── src/
│       ├── index.ts          ← starts the HTTP + Rivalis server
│       ├── auth/
│       │   └── AuthMiddleware.ts   ← who can connect?
│       ├── rivalis/
│       │   └── ArenaRoom.ts        ← the only file using @rivalis/core
│       └── game/
│           └── ArenaSimulation.ts  ← pure pacman — no Rivalis import
│
└── game/
    └── src/
        ├── main.ts                  ← wires net + scene + HUD
        ├── net/
        │   └── ArenaClient.ts       ← the only file using @rivalis/browser
        ├── game/
        │   ├── ArenaScene.ts        ← Phaser scene
        │   ├── PlayerSprite.ts      ← pacman with mouth + halo
        │   ├── GhostSprite.ts       ← ghost blob + googly eyes
        │   ├── PelletSprite.ts      ← regular dots + pulsing power pellets
        │   ├── MazeRenderer.ts      ← draws the wall tiles once
        │   └── InputController.ts   ← keyboard sampling
        └── ui/
            └── HUD.ts               ← join form, score, leaderboard
```

The Rivalis bits live in **two small adapter files**: `ArenaRoom.ts` on
the server and `ArenaClient.ts` on the client. Game logic doesn't import
Rivalis at all. To swap WebSockets for any other transport, you'd rewrite
those two files and the rest of the app would not notice.

---

## Read the code in this order

The four files that actually touch Rivalis are tagged with `RIVALIS:`
comments throughout. `grep -rn RIVALIS: .` prints every framework call in
the project — ~25 lines total.

1. **[`protocol/src/topics.ts`](protocol/src/topics.ts)** — Rivalis topic
   names + room id, with a table of where each topic shows up.
2. **[`protocol/src/codec.ts`](protocol/src/codec.ts)** — wire encoding
   (bytes ↔ JSON).
3. **[`server/src/index.ts`](server/src/index.ts)** — how a Rivalis
   instance is constructed.
4. **[`server/src/auth/AuthMiddleware.ts`](server/src/auth/AuthMiddleware.ts)**
   — the doorman, with the lifecycle of `actor.data` drawn out as a
   timeline.
5. **[`server/src/rivalis/ArenaRoom.ts`](server/src/rivalis/ArenaRoom.ts)**
   — the four lifecycle hooks plus `bind` / `actor.send` / `broadcast`.
6. **[`server/src/game/ArenaSimulation.ts`](server/src/game/ArenaSimulation.ts)**
   — pure pacman: maze collision, pellet pickup, power-up timer, ghost AI.
   No Rivalis imports.
7. **[`game/src/net/ArenaClient.ts`](game/src/net/ArenaClient.ts)** — the
   browser-side mirror of `ArenaRoom`. The only file in the bundle that
   imports `@rivalis/browser`.
8. **[`game/src/main.ts`](game/src/main.ts)** — how everything is glued.
9. **[`game/src/game/`](game/src/game/)** — pure Phaser, no Rivalis.

---

## What happens when you press a key

The full round trip from `D` press to a chomp registering on every screen:

1. **Browser** — `InputController` sees `D` go down, fires `onChange`
   with `{ right: true, … }`.
2. `ArenaScene` forwards that to `main.ts`, which calls
   `client.sendInput(input)`.
3. `ArenaClient` calls `WSClient.send('input', encode(input))` — Rivalis
   ships a binary frame over the wire.
4. **Server** — Rivalis routes the frame to `ArenaRoom.onInput()`
   because that's what we bound to topic `'input'` in `onCreate()`.
5. `ArenaRoom.onInput` decodes the JSON and calls
   `sim.setInput(actor.id, input)`.
6. The next 30 Hz `tick()`, `ArenaSimulation` integrates positions,
   bounces players off walls, picks up any pellet under their center,
   resolves chomps between energized and non-energized players, runs the
   ghost AI, and returns a snapshot.
7. `ArenaRoom` calls `this.broadcast('arena:state', encode(snapshot))` —
   Rivalis fans the frame out to every connected client in the room.
8. **Browser (everyone)** — `ArenaClient` receives the frame, decodes
   it, emits a `'snapshot'` event.
9. `main.ts` hands the snapshot to `ArenaScene.applySnapshot()` and to
   the HUD. Sprites lerp toward their new targets, eaten pellets vanish,
   energized players grow halos, the leaderboard re-sorts.

---

## Customize / extend

| Want to | Edit |
|---------|------|
| Change the maze | [`protocol/src/maze.ts`](protocol/src/maze.ts) — each row 21 chars of `#`/`.`/`O`/space |
| Faster pacmen | `ARENA.speed` in [`protocol/src/tunables.ts`](protocol/src/tunables.ts) |
| Longer power-up | `ARENA.energizedMs` |
| More / fewer ghosts | `ARENA.ghostCount` (palette has 4 colors) |
| Different player colors | `PALETTE` in `AuthMiddleware.ts` |
| A second room | Add `rivalis.rooms.create('arena', 'gold')` in `server/src/index.ts` and have auth pick `'gold'` for some players |
| Ghost personalities | `pickGhostDir` runs the same logic for everyone — give each ghost a different scoring function (Blinky tight chase, Pinky aim-ahead, Clyde wander) and you've basically rebuilt classic pacman |
| Production hardening | Set `ticketSource: 'protocol'` on both transport + client (so JWTs don't show up in URL access logs), add `allowedOrigins`, plug in a `connectionLimiter` |

---

## Build for production

```sh
npm run build
```

Outputs:

- `server/dist/` — Node CommonJS bundle. Run with
  `node server/dist/index.js`.
- `game/dist/` — static HTML/JS/CSS. Serve with any static host
  (`vite preview`, nginx, S3 + CloudFront, etc.). The Vite build hardcodes
  `ws://${location.hostname}:2334`, so the game expects to find the
  Rivalis server on the same host on port 2334. For different hosts /
  TLS, edit `game/src/main.ts` before building.

---

## Further reading

- Rivalis on npm — [`@rivalis/core`](https://www.npmjs.com/package/@rivalis/core), [`@rivalis/browser`](https://www.npmjs.com/package/@rivalis/browser)
- Phaser docs — <https://docs.phaser.io>
- WebSocket close codes — <https://developer.mozilla.org/docs/Web/API/CloseEvent/code>

---

## License

MIT — copy, fork, ship. See `LICENSE` if present.
