export interface Position {
    x: number;
    y: number;
}

export interface Enemy {
    id: string;
    pos: Position;
    type: 'E' | 'g' | 'V'; // Executioner, glitch, Virus
    hp: number;
    maxHp: number;
    dmg: number;
}

export interface Loot {
    id: string;
    pos: Position;
    amount: number;
}

export interface DungeonState {
    grid: string[][];
    playerPos: Position;
    stairsPos: Position;
    enemies: Enemy[];
    loot: Loot[];
}

const ROOM_MAX_SIZE = 8;
const ROOM_MIN_SIZE = 4;
const MAX_ROOMS = 10;

class Rect {
    x1: number;
    y1: number;
    x2: number;
    y2: number;

    constructor(x: number, y: number, w: number, h: number) {
        this.x1 = x;
        this.y1 = y;
        this.x2 = x + w;
        this.y2 = y + h;
    }

    center(): Position {
        return {
            x: Math.floor((this.x1 + this.x2) / 2),
            y: Math.floor((this.y1 + this.y2) / 2)
        };
    }

    intersect(other: Rect): boolean {
        return this.x1 <= other.x2 && this.x2 >= other.x1 &&
            this.y1 <= other.y2 && this.y2 >= other.y1;
    }
}

function createRoom(grid: string[][], room: Rect) {
    for (let x = room.x1 + 1; x < room.x2; x++) {
        for (let y = room.y1 + 1; y < room.y2; y++) {
            grid[y][x] = '.';
        }
    }
}

function createHTunnel(grid: string[][], x1: number, x2: number, y: number) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        grid[y][x] = '.';
    }
}

function createVTunnel(grid: string[][], y1: number, y2: number, x: number) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        grid[y][x] = '.';
    }
}

export function generateDungeon(width: number, height: number, floor: number): DungeonState {
    const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill('#'));
    const rooms: Rect[] = [];
    let playerPos: Position = { x: 0, y: 0 };
    const enemies: Enemy[] = [];
    const loot: Loot[] = [];

    for (let i = 0; i < MAX_ROOMS; i++) {
        const w = Math.floor(Math.random() * (ROOM_MAX_SIZE - ROOM_MIN_SIZE + 1)) + ROOM_MIN_SIZE;
        const h = Math.floor(Math.random() * (ROOM_MAX_SIZE - ROOM_MIN_SIZE + 1)) + ROOM_MIN_SIZE;
        const x = Math.floor(Math.random() * (width - w - 1)) + 1;
        const y = Math.floor(Math.random() * (height - h - 1)) + 1;

        const newRoom = new Rect(x, y, w, h);

        let failed = false;
        for (const otherRoom of rooms) {
            if (newRoom.intersect(otherRoom)) {
                failed = true;
                break;
            }
        }

        if (!failed) {
            createRoom(grid, newRoom);
            const center = newRoom.center();

            if (rooms.length === 0) {
                playerPos = center;
            } else {
                const prevCenter = rooms[rooms.length - 1].center();
                if (Math.random() > 0.5) {
                    createHTunnel(grid, prevCenter.x, center.x, prevCenter.y);
                    createVTunnel(grid, prevCenter.y, center.y, center.x);
                } else {
                    createVTunnel(grid, prevCenter.y, center.y, prevCenter.x);
                    createHTunnel(grid, prevCenter.x, center.x, center.y);
                }

                // Chance to spawn entities
                if (Math.random() < 0.6) {
                    const typeRoll = Math.random();
                    let type: 'E' | 'g' | 'V' = 'g';
                    let eHp = floor * 2;
                    let eDmg = floor * 1;

                    if (typeRoll > 0.8) {
                        type = 'E'; // Executioner
                        eHp = floor * 5;
                        eDmg = floor * 3;
                    } else if (typeRoll > 0.4) {
                        type = 'V'; // Virus
                        eHp = floor * 3;
                        eDmg = floor * 2;
                    }

                    enemies.push({
                        id: `enemy-${i}`, pos: center, type,
                        hp: eHp, maxHp: eHp, dmg: eDmg
                    });
                } else if (Math.random() < 0.4) {
                    loot.push({
                        id: `loot-${i}`, pos: center, amount: Math.floor(Math.random() * 5 * floor) + 1
                    });
                }
            }
            rooms.push(newRoom);
        }
    }

    const stairsPos = rooms[rooms.length - 1].center();
    grid[stairsPos.y][stairsPos.x] = '>';

    // Avoid stairs overlapping enemy/loot
    const enemyIdx = enemies.findIndex(e => e.pos.x === stairsPos.x && e.pos.y === stairsPos.y);
    if (enemyIdx !== -1) enemies.splice(enemyIdx, 1);
    const lootIdx = loot.findIndex(l => l.pos.x === stairsPos.x && l.pos.y === stairsPos.y);
    if (lootIdx !== -1) loot.splice(lootIdx, 1);

    return { grid, playerPos, stairsPos, enemies, loot };
}
