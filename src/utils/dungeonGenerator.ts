export interface Position {
    x: number;
    y: number;
}

export interface Enemy {
    id: string;
    pos: Position;
    type: 'E' | 'g' | 'V' | 'B'; // Executioner, glitch, Virus, BOSS
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

export function generateDungeon(
    width: number, 
    height: number, 
    floor: number, 
    isBossFloor: boolean = false,
    exits: { n?: boolean, s?: boolean, e?: boolean, w?: boolean } = {}
): DungeonState {
    const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill('#'));
    const rooms: Rect[] = [];
    let playerPos: Position = { x: 0, y: 0 };
    const enemies: Enemy[] = [];
    const loot: Loot[] = [];
    
    // Helper to find a floor tile near a position for tunnels
    const ensurePathTo = (target: Position) => {
        if (rooms.length === 0) return;
        const closestRoom = rooms[0]; // Connect to first room for simplicity or use a better heuristic
        const center = closestRoom.center();
        if (Math.abs(target.x - center.x) > Math.abs(target.y - center.y)) {
            createHTunnel(grid, target.x, center.x, target.y);
            createVTunnel(grid, target.y, center.y, center.x);
        } else {
            createVTunnel(grid, target.y, center.y, target.x);
            createHTunnel(grid, target.x, center.x, center.y);
        }
        grid[target.y][target.x] = '.'; // Clear the target itself
    };

    if (isBossFloor) {
        // Boss Floor: Single large room in center
        const rw = Math.floor(width * 0.6);
        const rh = Math.floor(height * 0.6);
        const rx = Math.floor((width - rw) / 2);
        const ry = Math.floor((height - rh) / 2);
        const bossRoom = new Rect(rx, ry, rw, rh);
        createRoom(grid, bossRoom);
        rooms.push(bossRoom);

        const center = bossRoom.center();
        playerPos = { x: rx + 2, y: ry + 2 };
        const stairsPos = { x: rx + rw - 2, y: ry + rh - 2 };
        grid[stairsPos.y][stairsPos.x] = '>';

        const bHp = floor * 15;
        const bDmg = floor * 5;
        enemies.push({
            id: `boss-${floor}`,
            pos: center,
            type: 'B',
            hp: bHp,
            maxHp: bHp,
            dmg: bDmg
        });

        return { grid, playerPos, stairsPos, enemies, loot };
    }

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

    // Place Cardinal Exits
    if (exits.n) {
        const pos = { x: Math.floor(width / 2), y: 0 };
        ensurePathTo(pos);
        grid[pos.y][pos.x] = '^';
    }
    if (exits.s) {
        const pos = { x: Math.floor(width / 2), y: height - 1 };
        ensurePathTo(pos);
        grid[pos.y][pos.x] = 'v';
    }
    if (exits.e) {
        const pos = { x: width - 1, y: Math.floor(height / 2) };
        ensurePathTo(pos);
        grid[pos.y][pos.x] = '>';
    }
    if (exits.w) {
        const pos = { x: 0, y: Math.floor(height / 2) };
        ensurePathTo(pos);
        grid[pos.y][pos.x] = '<';
    }

    // Default stairs if no cardinal exits
    let stairsPos = { x: -1, y: -1 };
    if (!exits.n && !exits.s && !exits.e && !exits.w) {
        stairsPos = rooms[rooms.length - 1].center();
        grid[stairsPos.y][stairsPos.x] = '>';
    }

    // Avoid stairs/exits overlapping enemy/loot
    enemies.forEach((e, idx) => {
        if (grid[e.pos.y][e.pos.x] !== '.') enemies.splice(idx, 1);
    });
    loot.forEach((l, idx) => {
        if (grid[l.pos.y][l.pos.x] !== '.') loot.splice(idx, 1);
    });

    return { grid, playerPos, stairsPos, enemies, loot };
}
