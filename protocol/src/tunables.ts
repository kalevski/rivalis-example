import { MAZE_HEIGHT, MAZE_WIDTH } from './maze'

export const ARENA = {
    width: MAZE_WIDTH,
    height: MAZE_HEIGHT,
    playerRadius: 12,
    speed: 180,
    ghostSpeed: 140,
    ghostScaredSpeed: 90,
    ghostCount: 3,
    ghostHomeTx: 10,
    ghostHomeTy: 7,
    tickHz: 30,
    energizedMs: 8000,
    eatDistance: 24,
    pelletPickupDistance: 12,
    ghostEatScore: 50,
    chompScore: 10,
    deathPenalty: 5
} as const
