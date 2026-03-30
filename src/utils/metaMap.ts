import { generateDungeon, type Enemy, type Loot, type Position } from './dungeonGenerator';

export interface Room {
    x: number;
    y: number;
    grid: string[][];
    playerSpawn: Position;
    stairsPos: Position;
    loot: Loot[];
    enemies: Enemy[];
    isDiscovered: boolean;
    isBoss: boolean;
    isCleared: boolean;
    specialType?: 'K1' | 'K2' | 'K3' | 'L1' | 'L2' | 'L3' | 'mining_boost';
}

const MAP_SIZE = 10;
const DUNGEON_W = 30;
const DUNGEON_H = 20;
export const MAX_SEED_FLOORS = 250;

// Boss rooms at strategic positions around the map
const BOSS_POSITIONS = new Set([
    '0,0', '9,0', '0,9', '9,9',  // corners
    '5,0', '0,5', '9,5', '5,9',  // edge midpoints
    '5,5',                         // center
]);

export const generateRoom = (rx: number, ry: number, floorOffset: number = 0): Room => {
    const floor = 1 + rx + ry + floorOffset;
    const isBoss = BOSS_POSITIONS.has(`${rx},${ry}`);
    
    // Detect adjacent rooms in 10x10 grid
    const exits = {
        n: ry > 0,
        s: ry < MAP_SIZE - 1,
        e: rx < MAP_SIZE - 1,
        w: rx > 0
    };

    const result = generateDungeon(DUNGEON_W, DUNGEON_H, floor, isBoss, exits);

    return {
        x: rx,
        y: ry,
        grid: result.grid,
        playerSpawn: result.playerPos,
        stairsPos: result.stairsPos,
        loot: result.loot.map(l => ({ ...l, id: `loot-${rx}-${ry}-${l.id}` })),
        enemies: result.enemies.map(e => ({ ...e, id: `enemy-${rx}-${ry}-${e.id}` })),
        isDiscovered: false,
        isBoss,
        isCleared: false
    };
};

export const generateMetaMap = (floor: number = 1): Room[][] => {
    const metaMap: Room[][] = [];
    const floorOffset = (floor - 1) * 20;

    for (let y = 0; y < MAP_SIZE; y++) {
        metaMap[y] = [];
        for (let x = 0; x < MAP_SIZE; x++) {
            metaMap[y][x] = generateRoom(x, y, floorOffset);
        }
    }

    // Place special rooms (K1-K3, L1-L3)
    const specials: Room['specialType'][] = ['K1', 'K2', 'K3', 'L1', 'L2', 'L3'];
    const used = new Set<string>();
    
    // Add some mining boost rooms
    for (let i = 0; i < 5; i++) specials.push('mining_boost');

    specials.forEach(type => {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 100) {
            const rx = Math.floor(Math.random() * MAP_SIZE);
            const ry = Math.floor(Math.random() * MAP_SIZE);
            const key = `${rx},${ry}`;
            const isCentralSpawn = rx >= 4 && rx <= 5 && ry >= 4 && ry <= 5;
            // Avoid central spawn sectors and boss rooms if possible
            if (!used.has(key) && !isCentralSpawn && !BOSS_POSITIONS.has(key)) {
                metaMap[ry][rx].specialType = type;
                used.add(key);
                placed = true;
            }
            attempts++;
        }
    });

    return metaMap;
};
