import type { ArenaClientStatus } from '../net/ArenaClient'
import type { ArenaPlayer } from '@rivalis-example/protocol'

const STATUS_COLOR: Record<ArenaClientStatus, string> = {
    idle: '#888',
    connecting: '#fa0',
    connected: '#0a7',
    disconnected: '#c33'
}

const STATUS_TEXT: Record<ArenaClientStatus, string> = {
    idle: 'not connected',
    connecting: 'connecting…',
    connected: 'in arena',
    disconnected: 'disconnected'
}

export type HUDCallbacks = {
    onJoin: (name: string) => void
    onLeave: () => void
}

/**
 * All DOM-side UI: the join form, status badge, your-score panel, and the
 * top-5 leaderboard. Has no Rivalis or Phaser imports — gets data piped in
 * from main.ts.
 */
export default class HUD {
    private nameInput: HTMLInputElement
    private joinBtn: HTMLButtonElement
    private leaveBtn: HTMLButtonElement
    private statusEl: HTMLSpanElement
    private scoreEl: HTMLSpanElement
    private leaderboardEl: HTMLOListElement

    constructor(callbacks: HUDCallbacks) {
        this.nameInput = document.getElementById('name') as HTMLInputElement
        this.joinBtn = document.getElementById('connect') as HTMLButtonElement
        this.leaveBtn = document.getElementById('leave') as HTMLButtonElement
        this.statusEl = document.getElementById('status') as HTMLSpanElement
        this.scoreEl = document.getElementById('score') as HTMLSpanElement
        this.leaderboardEl = document.getElementById('leaderboard') as HTMLOListElement

        const join = () => {
            const name = this.nameInput.value.trim()
            if (!name) return
            callbacks.onJoin(name)
        }
        this.joinBtn.addEventListener('click', join)
        this.leaveBtn.addEventListener('click', () => callbacks.onLeave())
        this.nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') join()
        })
    }

    setStatus(status: ArenaClientStatus, reason?: string): void {
        const text = reason ? `${STATUS_TEXT[status]} (${reason})` : STATUS_TEXT[status]
        this.statusEl.textContent = text
        this.statusEl.style.color = STATUS_COLOR[status]

        const isLocked = status === 'connecting' || status === 'connected'
        this.joinBtn.disabled = isLocked
        this.leaveBtn.disabled = !isLocked
        this.nameInput.disabled = isLocked
    }

    setScore(score: number | null): void {
        this.scoreEl.textContent = score === null ? '—' : String(score)
    }

    setLeaderboard(players: ArenaPlayer[], myId: string): void {
        const sorted = [...players].sort((a, b) => b.score - a.score).slice(0, 5)
        this.leaderboardEl.innerHTML = ''
        for (const p of sorted) {
            const li = document.createElement('li')
            li.style.color = p.color
            if (p.id === myId) li.style.fontWeight = '700'
            const name = document.createElement('span')
            name.textContent = p.name
            const score = document.createElement('span')
            score.textContent = String(p.score)
            score.style.float = 'right'
            li.appendChild(name)
            li.appendChild(score)
            this.leaderboardEl.appendChild(li)
        }
    }

    reset(): void {
        this.setScore(null)
        this.leaderboardEl.innerHTML = ''
    }
}
