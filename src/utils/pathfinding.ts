import type { Position } from './dungeonGenerator';

/**
 * Finds the next step towards a target using BFS.
 * Returns { dx: number, dy: number } or null if no path exists.
 */
export function findNextStep(
    grid: string[][],
    start: Position,
    targets: Position[]
): { dx: number; dy: number } | null {
    if (targets.length === 0) return null;

    const width = grid[0].length;
    const height = grid.length;
    const queue: { x: number; y: number; path: { dx: number; dy: number }[] }[] = [
        { x: start.x, y: start.y, path: [] }
    ];
    const visited = new Set<string>();
    visited.add(`${start.x},${start.y}`);

    const moves = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
    ];

    while (queue.length > 0) {
        const { x, y, path } = queue.shift()!;

        // Check if current position is any of the targets
        if (targets.some(t => t.x === x && t.y === y)) {
            return path.length > 0 ? path[0] : null;
        }

        for (const move of moves) {
            const nx = x + move.dx;
            const ny = y + move.dy;

            if (
                nx >= 0 && nx < width && ny >= 0 && ny < height &&
                grid[ny][nx] !== '#' &&
                !visited.has(`${nx},${ny}`)
            ) {
                visited.add(`${nx},${ny}`);
                queue.push({
                    x: nx,
                    y: ny,
                    path: [...path, move]
                });
            }
        }
    }

    return null;
}
