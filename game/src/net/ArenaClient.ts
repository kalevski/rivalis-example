import { WSClient } from '@rivalis/browser'
import {
    decode, encode,
    type ArenaInput, type ArenaSnapshot, type PresenceEvent, type WelcomeEvent
} from '@rivalis-example/protocol'

export type ArenaClientStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

export type ArenaClientEvents = {
    status: (status: ArenaClientStatus, reason?: string) => void
    welcome: (event: WelcomeEvent) => void
    snapshot: (snapshot: ArenaSnapshot) => void
    presenceJoin: (event: PresenceEvent) => void
    presenceLeave: (event: PresenceEvent) => void
}

type Listener<K extends keyof ArenaClientEvents> = ArenaClientEvents[K]

const decoder = new TextDecoder()

export default class ArenaClient {
    private ws: WSClient | null = null
    private listeners: { [K in keyof ArenaClientEvents]?: Listener<K>[] } = {}

    on<K extends keyof ArenaClientEvents>(event: K, fn: Listener<K>): void {
        ;(this.listeners[event] ??= [] as Listener<K>[]).push(fn)
    }

    off<K extends keyof ArenaClientEvents>(event: K, fn: Listener<K>): void {
        const arr = this.listeners[event]
        if (!arr) return
        const i = arr.indexOf(fn)
        if (i >= 0) arr.splice(i, 1)
    }

    private emit<K extends keyof ArenaClientEvents>(event: K, ...args: Parameters<Listener<K>>): void {
        const arr = this.listeners[event]
        if (!arr) return
        for (const fn of arr) (fn as (...a: unknown[]) => void)(...args)
    }

    connect(url: string, ticket: string): void {
        if (this.ws) this.disconnect()

        const ws = new WSClient(url)
        this.ws = ws

        ws.on('client:connect', () => this.emit('status', 'connected'), null)
        ws.on('client:disconnect', (payload) => {
            const reason = decoder.decode(payload as Uint8Array)
            this.emit('status', 'disconnected', reason)
            this.ws = null
        }, null)

        ws.on('welcome', (p) => this.emit('welcome', decode<WelcomeEvent>(p)), null)
        ws.on('arena:state', (p) => this.emit('snapshot', decode<ArenaSnapshot>(p)), null)
        ws.on('__presence:join', (p) => this.emit('presenceJoin', decode<PresenceEvent>(p)), null)
        ws.on('__presence:leave', (p) => this.emit('presenceLeave', decode<PresenceEvent>(p)), null)

        this.emit('status', 'connecting')
        ws.connect(ticket)
    }

    disconnect(): void {
        if (!this.ws) return
        this.ws.disconnect()
        this.ws = null
    }

    sendInput(input: ArenaInput): void {
        if (!this.ws) return
        this.ws.send('input', encode(input))
    }
}
