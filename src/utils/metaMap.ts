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
}

const MAP_SIZE = 10;
const DUNGEON_W = 30;
const DUNGEON_H = 20;

// Boss rooms at strategic positions around the map
const BOSS_POSITIONS = new Set([
    '0,0', '9,0', '0,9', '9,9',  // corners
    '5,0', '0,5', '9,5', '5,9',  // edge midpoints
    '5,5',                         // center
]);

export const generateRoom = (rx: number, ry: number): Room => {
    const floor = 1 + rx + ry;
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
        isBoss
    };
};

export const generateMetaMap = (): Room[][] => {
    const metaMap: Room[][] = [];
    for (let y = 0; y < MAP_SIZE; y++) {
        metaMap[y] = [];
        for (let x = 0; x < MAP_SIZE; x++) {
            metaMap[y][x] = generateRoom(x, y);
        }
    }
    return metaMap;
};
