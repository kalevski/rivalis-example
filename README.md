# 👻 rivalis-example

> Multiplayer **pac-maze** — built with [Rivalis](https://www.npmjs.com/package/@rivalis/core) (Node WebSocket framework) and [Phaser 4](https://phaser.io).

Eat dots. Grab a power pellet. Hunt rivals and ghosts while you glow. ✨

---

## 🚀 Run it

```sh
git clone git@github.com:kalevski/rivalis-example.git
cd rivalis-example
npm install
npm run dev
```

Open **http://localhost:5173** in two browser tabs. Pick names. Hit Join.

> Needs Node **22+** and npm 10+.

---

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `WASD` / arrows | Move |
| Touch a dot | +1 |
| Touch a power pellet | +5, glow 8 s |
| Glowing + bump rival | +10 (they respawn) |
| Glowing + bump ghost | +50 (ghost flees home) |
| Caught by a ghost | −5, respawn |

3 AI ghosts chase the closest pacman. When **anyone** is glowing, ghosts turn dark blue and run. 🥶

---

## 📦 Stack

- 🟢 **Server** — Node + [`@rivalis/core`](https://www.npmjs.com/package/@rivalis/core)
- 🔵 **Client** — [`@rivalis/browser`](https://www.npmjs.com/package/@rivalis/browser) + Phaser 4 + Vite
- 📜 **Shared** — TypeScript types in `protocol/`

---

## 📂 Layout

```
protocol/   shared types + maze + codec
server/     game logic + Rivalis adapter
game/       Phaser client + Rivalis adapter
```

The two files where Rivalis actually lives:

- 🖥️ **`server/src/rivalis/ArenaRoom.ts`** — `Room` lifecycle + `bind` / `actor.send` / `broadcast`
- 🌐 **`game/src/net/ArenaClient.ts`** — `WSClient` wrapper

Everything else is plain game code. 🎯

---

## 🛠️ Other scripts

| Command | What |
|--------|------|
| `npm run dev` | Server + client with hot reload |
| `npm run dev:server` | Just the server |
| `npm run dev:game` | Just the client |
| `npm run build` | Type-check + build to `dist/` |

---

## 📄 License

MIT
