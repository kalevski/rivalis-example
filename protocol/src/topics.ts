export type ServerTopic =
    | 'welcome'
    | 'arena:state'
    | '__presence:join'
    | '__presence:leave'

export type ClientTopic = 'input'

export const ARENA_ROOM_ID = 'arena'
