// ──────────────────────────────────────────────────────────────
//  Rivalis topics + room id (RIVALIS-LESSON)
// ──────────────────────────────────────────────────────────────
//
//  A "topic" in Rivalis is a routing key — like an event name on the wire.
//  The framework looks at the topic to decide which handler to invoke; it
//  doesn't inspect the payload bytes.
//
//  Both sides import these names so a typo turns into a compile error
//  rather than a silent dropped message at runtime.
//
//  Where each topic shows up:
//
//    Server → client                Wired up in
//    ─────────────────              ───────────────────────────────────────
//    'welcome'                      ArenaRoom.onJoin               → actor.send
//    'arena:state'                  ArenaRoom.tick / onJoin        → broadcast
//    '__presence:join' / ':leave'   automatic (presence = true)
//
//    Client → server                Wired up in
//    ─────────────────              ───────────────────────────────────────
//    'input'                        bound in ArenaRoom.onCreate    → bind
//                                   sent in   ArenaClient.sendInput → ws.send
//
//  The `__` prefix is reserved by Rivalis for built-in topics (presence,
//  etc.). Don't use it for your own topics.

export type ServerTopic =
    | 'welcome'
    | 'arena:state'
    | '__presence:join'
    | '__presence:leave'

export type ClientTopic = 'input'

/**
 * The single room id every player joins. AuthMiddleware returns this from
 * `authenticate`; the bootstrap calls `rivalis.rooms.create('arena', ...)`
 * with this same id. Those two strings MUST match or Rivalis rejects the
 * connection at the door with "room id=... does not exist".
 */
export const ARENA_ROOM_ID = 'arena'
