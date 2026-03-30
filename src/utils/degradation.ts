// System Degradation (Soft Cap) Calculator

export interface DegradationMultipliers {
    enemyHpMult: number;
    enemyDmgMult: number;
    cuYieldMult: number;
    pathfindingJitter: number;  // 0-1, chance AI moves randomly instead of pathfinding
    fragmentDropBonus: number;  // negative modifier as clutter increases
}

/**
 * Calculate degradation multipliers from current system clutter level.
 * Clutter ranges from 0 (fresh) to 100 (fully degraded).
 */
export function getDegradationMultipliers(clutter: number): DegradationMultipliers {
    const c = Math.max(0, Math.min(100, clutter));
    const pct = c / 100;

    return {
        enemyHpMult:       1 + (pct * 1.0),          // 1.0× at 0, 2.0× at 100
        enemyDmgMult:      1 + (pct * 0.75),         // 1.0× at 0, 1.75× at 100
        cuYieldMult:       Math.max(0.25, 1 - (pct * 0.75)),  // 1.0× at 0, 0.25× at 100
        pathfindingJitter: Math.min(0.4, pct * 0.4),  // 0% at 0, 40% at 100
        fragmentDropBonus: -(pct * 0.10)               // 0% at 0, -10% at 100
    };
}

/**
 * Calculate clutter growth since the last update.
 * Increases by ~0.5 per minute (0.00833 per second).
 */
export function calculateClutterGrowth(sessionStartTime: number, now: number): number {
    const elapsedMs = now - sessionStartTime;
    const elapsedMinutes = elapsedMs / 60000;
    return elapsedMinutes * 0.5; // 0.5 clutter per minute
}

/**
 * Cost to defrag (reduce clutter) by a given amount.
 */
export function getDefragCost(amount: number): number {
    return Math.max(0, amount * 10); // No minimum charge; cost scales linearly
}
