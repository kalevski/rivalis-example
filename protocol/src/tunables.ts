// ──────────────────────────────────────────────────────────────
//  Game tunables (NOT Rivalis-specific)
// ──────────────────────────────────────────────────────────────
//
//  Numbers shared between server (physics) and client (rendering). Single
//  source of truth — change once, both sides agree on the next reload.
//
//  None of these touch Rivalis. They're regular game-design constants;
//  they live in the protocol package only because both processes need
//  them. A learner reading for Rivalis can skip this file.

import { MAZE_HEIGHT, MAZE_WIDTH } from './maze'

export const ARENA = {
    // Display
    width: MAZE_WIDTH,
    height: MAZE_HEIGHT,
    playerRadius: 12,         // smaller than half a tile so pacmen fit corridors

    // Movement
    speed: 180,               // pacman pixels / second
    ghostSpeed: 140,          // ghost speed in chase mode
    ghostScaredSpeed: 90,     // ghost speed when fleeing energized pacman
    ghostCount: 3,
    ghostHomeTx: 10,          // tile column ghosts spawn / respawn at
    ghostHomeTy: 7,           // tile row    ghosts spawn / respawn at

    // Server tick
    tickHz: 30,               // server simulation rate

    // Pickup / contact
    energizedMs: 8000,        // how long a power pellet lasts
    eatDistance: 24,          // contact distance for any chomp
    pelletPickupDistance: 12, // tile-center tolerance for eating a pellet

    // Scoring
    ghostEatScore: 50,        // pacman eats ghost
    chompScore: 10,           // pacman eats pacman
    deathPenalty: 5           // points lost when caught / chomped
} as const
