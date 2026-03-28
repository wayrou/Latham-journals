import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useGameState, type CrawlerSpec, type BrickedNode } from './GameStateContext';
import { type Position, type Enemy, type Loot } from '../utils/dungeonGenerator';
import { useSound } from '../hooks/useSound';
import { findNextStep } from '../utils/pathfinding';
import { generateMetaMap, type Room } from '../utils/metaMap';
import { rollCipherDrop } from '../utils/cipherSystem';

// Stat multipliers per specialization
const SPEC_MULT: Record<CrawlerSpec, { hp: number; dmg: number; speed: number }> = {
    fighter:  { hp: 1.5, dmg: 2.0, speed: 0.7 },
    rogue:    { hp: 0.8, dmg: 0.5, speed: 1.5 },
    miner:    { hp: 0.5, dmg: 0.3, speed: 0.5 },
    summoner: { hp: 1.0, dmg: 0.5, speed: 1.0 },
};

// Daemon entity for summoners
interface Daemon {
    id: string;
    pos: Position;
    hp: number;
    dmg: number;
}

export interface BreachInstance {
    id: string;
    callsign: string;
    spec: CrawlerSpec;
    floor: number;
    roomX: number;
    roomY: number;
    grid: string[][];
    playerPos: Position;
    stairsPos: Position;
    enemies: Enemy[];
    loot: Loot[];
    hp: number;
    maxHp: number;
    logs: string[];
    mascotMessage: string | null;
    isAutoPlaying: boolean;
    isPinned: boolean;
    isPaused: boolean;
    isMinimized: boolean;
    lastInputTime: number;
    visitedRooms: string[];
    daemons: Daemon[];
    minerTickAccum: number; // Miner passive CU accumulator
}

interface DungeonContextType {
    breaches: BreachInstance[];
    metaMap: Room[][];
    activeBreachId: string | null;
    setActiveBreachId: (id: string | null) => void;
    movePlayer: (id: string, dx: number, dy: number, isManual?: boolean) => void;
    togglePause: (id: string) => void;
    toggleMinimize: (id: string) => void;
    togglePin: (id: string) => void;
    terminateBreach: (id: string) => void;
    initNewBreach: (spec?: CrawlerSpec) => void;
    mascotSay: (id: string, msg: string) => void;
    restartBreach: (id: string) => void;
    setBreachSpec: (id: string, spec: CrawlerSpec) => void;
}

const DungeonContext = createContext<DungeonContextType | undefined>(undefined);

const CALLSIGNS = [
    'NODE_ALPHA', 'NODE_BRAVO', 'NODE_CHARLIE', 'NODE_DELTA', 'NODE_ECHO', 
    'NODE_FOXTROT', 'NODE_GOLF', 'NODE_HOTEL', 'NODE_INDIA', 'NODE_JULIET',
    'NODE_KILO', 'NODE_LIMA', 'NODE_MIKE', 'NODE_NOVEMBER', 'NODE_OSCAR'
];

function pickAdjacentRoom(rx: number, ry: number, visited: string[]): { x: number; y: number } {
    const neighbors = [
        { x: rx, y: ry - 1 }, { x: rx, y: ry + 1 },
        { x: rx - 1, y: ry }, { x: rx + 1, y: ry }
    ].filter(n => n.x >= 0 && n.x < 10 && n.y >= 0 && n.y < 10);
    const unvisited = neighbors.filter(n => !visited.includes(`${n.x},${n.y}`));
    const pool = unvisited.length > 0 ? unvisited : neighbors;
    return pool[Math.floor(Math.random() * pool.length)];
}

export const DungeonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { addRestoration, addComputeUnits, crawlerStats, getDegradation, 
            addCipherFragment, refactorBonuses, defaultCrawlerSpec, setActiveBrickedNode } = useGameState();
    const { playSound } = useSound();

    const [breaches, setBreaches] = useState<BreachInstance[]>([]);
    const [metaMap, setMetaMap] = useState<Room[][]>(() => generateMetaMap());
    const [activeBreachId, setActiveBreachId] = useState<string | null>(null);
    const mascotTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const gameStateRef = useRef({ getDegradation, addCipherFragment, refactorBonuses, crawlerStats });

    // Keep refs fresh
    useEffect(() => {
        gameStateRef.current = { getDegradation, addCipherFragment, refactorBonuses, crawlerStats };
    }, [getDegradation, addCipherFragment, refactorBonuses, crawlerStats]);

    const mascotSay = useCallback((id: string, msg: string) => {
        setBreaches(prev => prev.map(b => 
            b.id === id ? { ...b, mascotMessage: msg } : b
        ));
        if (mascotTimeouts.current[id]) clearTimeout(mascotTimeouts.current[id]);
        mascotTimeouts.current[id] = setTimeout(() => {
            setBreaches(prev => prev.map(b => 
                b.id === id ? { ...b, mascotMessage: null } : b
            ));
        }, 2000);
    }, []);

    // Enforce max breach capacity (trims excess on capacity reduction/refactor)
    useEffect(() => {
        const capacity = crawlerStats.maxBreachWindows || 1;
        setBreaches(prev => {
            if (prev.length > capacity) {
                const trimmed = prev.slice(0, capacity);
                // If active breach was among those trimmed, reset focus
                if (activeBreachId && !trimmed.some(b => b.id === activeBreachId)) {
                    setActiveBreachId(null);
                }
                return trimmed;
            }
            return prev;
        });
    }, [crawlerStats.maxBreachWindows, activeBreachId]);

    const initNewBreach = useCallback((spec?: CrawlerSpec) => {
        const id = `breach-${Date.now()}`;
        const chosenSpec = spec || defaultCrawlerSpec;
        const mult = SPEC_MULT[chosenSpec];
        const baseHp = 20 + crawlerStats.maxHpBoost;
        const initialHp = Math.floor(baseHp * mult.hp);
        
        const rx = 4 + Math.floor(Math.random() * 2);
        const ry = 4 + Math.floor(Math.random() * 2);
        const room = metaMap[ry][rx];

        setBreaches(prev => {
            if (prev.length >= (crawlerStats.maxBreachWindows || 1)) return prev;

            const usedCallsigns = prev.map(b => b.callsign.split('_')[0] + '_' + b.callsign.split('_')[1]);
            const availableCallsigns = CALLSIGNS.filter(c => !usedCallsigns.some(u => u.startsWith(c)));
            const baseCallsign = availableCallsigns[Math.floor(Math.random() * availableCallsigns.length)] || 'NODE_UNKNOWN';
            const callsign = `${baseCallsign}_${Math.floor(Math.random() * 99).toString().padStart(2, '0')}`;

            const specLabel = chosenSpec.toUpperCase();
            const newBreach: BreachInstance = {
                id,
                callsign,
                spec: chosenSpec,
                floor: 1,
                roomX: rx,
                roomY: ry,
                grid: room.grid,
                playerPos: room.playerSpawn,
                stairsPos: room.stairsPos,
                enemies: [...room.enemies],
                loot: [...room.loot],
                hp: initialHp,
                maxHp: initialHp,
                logs: [`[BREACH PROTOCOL ${callsign} INITIATED]`, `[CLASS: ${specLabel}]`, `[COORDINATES: ${rx},${ry}]`],
                mascotMessage: null,
                isAutoPlaying: false,
                isPinned: false,
                isPaused: false,
                isMinimized: false,
                lastInputTime: Date.now(),
                visitedRooms: [`${rx},${ry}`],
                daemons: [],
                minerTickAccum: 0
            };

            playSound('boot');
            // Mark initial room as discovered
            setMetaMap(prevMap => {
                const newMap = [...prevMap];
                const row = [...newMap[ry]];
                row[rx] = { ...row[rx], isDiscovered: true };
                newMap[ry] = row;
                return newMap;
            });
            return [...prev, newBreach];
        });
    }, [crawlerStats.maxBreachWindows, crawlerStats.maxHpBoost, playSound, metaMap, defaultCrawlerSpec]);

    const terminateBreach = useCallback((id: string) => {
        setBreaches(prev => prev.filter(b => b.id !== id));
        if (activeBreachId === id) setActiveBreachId(null);
        playSound('error');
    }, [activeBreachId, playSound]);

    const togglePause = useCallback((id: string) => {
        setBreaches(prev => prev.map(b => b.id === id ? { ...b, isPaused: !b.isPaused } : b));
    }, []);

    const toggleMinimize = useCallback((id: string) => {
        setBreaches(prev => prev.map(b => b.id === id ? { ...b, isMinimized: !b.isMinimized } : b));
    }, []);

    const togglePin = useCallback((id: string) => {
        setBreaches(prev => prev.map(b => b.id === id ? { ...b, isPinned: !b.isPinned } : b));
    }, []);

    const restartBreach = useCallback((id: string) => {
        const rx = 4 + Math.floor(Math.random() * 2);
        const ry = 4 + Math.floor(Math.random() * 2);
        const room = metaMap[ry][rx];
        
        setBreaches(prev => prev.map(b => {
            if (b.id !== id) return b;
            const mult = SPEC_MULT[b.spec];
            const baseHp = 20 + crawlerStats.maxHpBoost;
            const initialHp = Math.floor(baseHp * mult.hp);
            return {
                ...b,
                floor: 1,
                roomX: rx,
                roomY: ry,
                grid: room.grid,
                playerPos: room.playerSpawn,
                stairsPos: room.stairsPos,
                enemies: [...room.enemies],
                loot: [...room.loot],
                hp: initialHp,
                maxHp: initialHp,
                logs: [...b.logs.slice(-2), '[SYSTEM REBOOTING...]', '[RE-INITIATING BREACH PROTOCOL]'],
                isAutoPlaying: false,
                isPaused: false,
                visitedRooms: [`${rx},${ry}`],
                daemons: [],
                minerTickAccum: 0
            };
        }));
        playSound('boot');
    }, [crawlerStats.maxHpBoost, playSound, metaMap]);

    const setBreachSpec = useCallback((id: string, spec: CrawlerSpec) => {
        setBreaches(prev => prev.map(b => {
            if (b.id !== id) return b;
            const mult = SPEC_MULT[spec];
            const baseHp = 20 + crawlerStats.maxHpBoost;
            const newMaxHp = Math.floor(baseHp * mult.hp);
            
            // Maintain health percentage
            const hpPercent = b.hp / b.maxHp;
            const newHp = Math.max(1, Math.floor(newMaxHp * hpPercent));

            return {
                ...b,
                spec,
                maxHp: newMaxHp,
                hp: newHp,
                logs: [...b.logs.slice(-4), `[SYSTEM] RE-SPECING: ${spec.toUpperCase()}`],
                daemons: spec !== 'summoner' ? [] : b.daemons,
                minerTickAccum: 0
            };
        }));
    }, [crawlerStats.maxHpBoost]);

    const processBreachMove = useCallback((b: BreachInstance, dx: number, dy: number, currentMap: Room[][]): { nextBreach: BreachInstance, cu: number, res: number, sounds: string[], updatedRoom?: Room, spawnBrickedNode?: BrickedNode } | null => {
        if (b.hp <= 0 || b.isPaused) return null;

        const nx = b.playerPos.x + dx;
        const ny = b.playerPos.y + dy;

        if (ny < 0 || ny >= b.grid.length || nx < 0 || nx >= b.grid[0].length) return null;
        if (b.grid[ny][nx] === '#') return null;

        let nextBreach = { ...b, playerPos: { x: nx, y: ny } };

        let cu = 0;
        let res = 0;
        let sounds: string[] = [];
        let updatedRoom: Room | undefined = undefined;

        // Get degradation multipliers
        const deg = gameStateRef.current.getDegradation();
        const mult = SPEC_MULT[b.spec];

        // Calculate CU yield multiplier from refactor bonuses
        const cuBonusMult = 1 + (gameStateRef.current.refactorBonuses || [])
            .filter(rb => rb.type === 'cuYield')
            .reduce((sum, rb) => sum + rb.amount, 0);

        // Transitions
        const tile = b.grid[ny][nx];
        if (['^', 'v', '<', '>', 'stairs'].includes(tile) || (nx === b.stairsPos.x && ny === b.stairsPos.y)) {
            let nextX = b.roomX;
            let nextY = b.roomY;

            if (tile === '^') nextY--;
            else if (tile === 'v') nextY++;
            else if (tile === '<') nextX--;
            else if (tile === '>' && nx === b.grid[0].length - 1) nextX++; // '>' is also stairs, so check position
            else {
                // Default stairs behavior if it's the old 'stairs' tile or position-based
                const next = pickAdjacentRoom(b.roomX, b.roomY, b.visitedRooms || []);
                nextX = next.x;
                nextY = next.y;
            }

            // Boundary check
            nextX = Math.max(0, Math.min(9, nextX));
            nextY = Math.max(0, Math.min(9, nextY));

            const nextRoom = currentMap[nextY][nextX];
            const newVisited = [...(b.visitedRooms || []), `${b.roomX},${b.roomY}`].slice(-12);
            
            nextBreach = {
                ...nextBreach,
                roomX: nextX,
                roomY: nextY,
                grid: nextRoom.grid,
                playerPos: nextRoom.playerSpawn,
                stairsPos: nextRoom.stairsPos,
                enemies: [...nextRoom.enemies],
                loot: [...nextRoom.loot],
                floor: b.floor + 1,
                visitedRooms: newVisited,
                logs: [...b.logs.slice(-2), `[SECTOR TRANSITION: ${nextX},${nextY}]`],
                daemons: [],
                minerTickAccum: 0
            };
            updatedRoom = { ...nextRoom, isDiscovered: true };

            // 8% chance to find a bricked node on transition
            if (Math.random() < 0.08) {
                const node: BrickedNode = {
                    id: `node-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
                    roomCoords: `${nextX},${nextY}`,
                    repairCost: 50 + (b.floor * 10),
                    scrapValue: 20 + (b.floor * 5),
                    repairTimeMs: 30000,
                    rewardType: Math.random() > 0.5 ? 'cipher' : 'cu'
                };
                return { nextBreach, cu: 0, res: 0, sounds: ['success'], updatedRoom, spawnBrickedNode: node };
            }

            return { nextBreach, cu: 0, res: 0, sounds: [], updatedRoom };
        }

        // Combat — apply degradation to enemy stats
        const enemyIdx = nextBreach.enemies.findIndex(e => e.pos.x === nx && e.pos.y === ny);
        if (enemyIdx !== -1) {
            const playerDmg = Math.max(1, Math.floor(crawlerStats.baseDmg * mult.dmg));
            const target = nextBreach.enemies[enemyIdx];
            const newEnemyHp = target.hp - playerDmg; // raw hp tracking
            
            let newEnemies = [...nextBreach.enemies];
            let newLogs = [...nextBreach.logs];
            let newMascot = b.mascotMessage;

            if (newEnemyHp <= 0) {
                cu = Math.floor(10 * deg.cuYieldMult * cuBonusMult);
                newLogs = [...newLogs.slice(-4), `UNIT_${target.type} DELETED. (+${cu} CU)`];
                newMascot = "TARGET DELETED!";
                newEnemies = newEnemies.filter((_, i) => i !== enemyIdx);
                const currentRoom = currentMap[b.roomY][b.roomX];
                updatedRoom = { ...currentRoom, enemies: newEnemies };
            } else {
                newLogs = [...newLogs.slice(-4), `Attacked UNIT_${target.type} for ${playerDmg} DMG!`];
                newMascot = "ENGAGING.";
                sounds.push('click');
                newEnemies[enemyIdx] = { ...target, hp: newEnemyHp };
                const currentRoom = currentMap[b.roomY][b.roomX];
                updatedRoom = { ...currentRoom, enemies: newEnemies };
                
                const counterDmg = Math.max(1, Math.floor((target.dmg || 2) * deg.enemyDmgMult));
                const counterHp = nextBreach.hp - counterDmg;
                newLogs = [...newLogs.slice(-4), `Counter-attack: -${counterDmg} HP`];
                if (counterHp <= 0) {
                    newMascot = "CRITICAL FAILURE!";
                    newLogs = [...newLogs.slice(-4), '[SYSTEM ERROR: CRAWLER DESTROYED]'];
                    sounds.push('error');
                    setTimeout(() => restartBreach(b.id), 2000);
                    nextBreach.hp = 0;
                } else {
                    nextBreach.hp = counterHp;
                }
            }
            nextBreach.enemies = newEnemies;
            nextBreach.logs = newLogs;
            nextBreach.mascotMessage = newMascot;
            nextBreach.playerPos = b.playerPos; 
            return { nextBreach, cu, res, sounds, updatedRoom };
        }

        // Loot — with cipher fragment drop chance
        const lootIdx = nextBreach.loot.findIndex(l => l.pos.x === nx && l.pos.y === ny);
        if (lootIdx !== -1) {
            const l = nextBreach.loot[lootIdx];
            cu = Math.floor(l.amount * deg.cuYieldMult * cuBonusMult);
            sounds.push('success');

            const heal = 2;
            const newHp = Math.min(b.maxHp, b.hp + heal);
            let newLogs = [...nextBreach.logs.slice(-4), `Recovered data (+${heal} HP / +${cu} CU)`];
            let newMascot = "SHINY!";

            if (Math.random() > 0.8) {
                res = 5;
                newLogs = [...newLogs.slice(-4), '++ GLOBAL RESTORATION BOOST ++'];
            }

            // Cipher fragment drop
            const fragBonusMult = (gameStateRef.current.refactorBonuses || [])
                .filter(rb => rb.type === 'fragmentRate')
                .reduce((sum, rb) => sum + rb.amount, 0);
            const baseFragRate = b.spec === 'rogue' ? 0.35 : 0.15;
            const fragRate = baseFragRate + fragBonusMult + deg.fragmentDropBonus;
            // rollCipherDrop needs existing fragments from context — we pass empty and let the caller handle it
            const roomCoords = `${b.roomX},${b.roomY}`;
            const fragment = rollCipherDrop(fragRate, [], roomCoords);
            if (fragment) {
                newLogs = [...newLogs.slice(-4), `>> CIPHER FRAGMENT RECOVERED: "${fragment.content}"`];
                newMascot = "ENCRYPTED DATA FOUND!";
                // Schedule fragment addition (can't call context directly in processBreachMove)
                setTimeout(() => gameStateRef.current.addCipherFragment(fragment), 0);
            }
            
            const newLoot = nextBreach.loot.filter((_, i) => i !== lootIdx);
            const currentRoom = currentMap[b.roomY][b.roomX];
            updatedRoom = { ...currentRoom, loot: newLoot };

            return {
                nextBreach: {
                    ...nextBreach,
                    hp: newHp,
                    loot: newLoot,
                    logs: newLogs,
                    mascotMessage: newMascot
                },
                cu,
                res,
                sounds,
                updatedRoom
            };
        }

        return { nextBreach, cu: 0, res: 0, sounds: [] };
    }, [crawlerStats.baseDmg, restartBreach]);

    const movePlayer = useCallback((id: string, dx: number, dy: number, isManual: boolean = false) => {
        let pendingCU = 0;
        let pendingRes = 0;
        let pendingSounds: string[] = [];
        let updatedRoomData: Room | undefined = undefined;

        setBreaches(prevBreaches => {
            const b = prevBreaches.find(x => x.id === id);
            if (!b) return prevBreaches;

            const result = processBreachMove(b, dx, dy, metaMap);
            if (!result) return prevBreaches;

            const { nextBreach, cu, res, sounds, updatedRoom, spawnBrickedNode } = result;
            pendingCU = cu;
            pendingRes = res;
            pendingSounds = sounds;
            updatedRoomData = updatedRoom;

            if (spawnBrickedNode) {
                setTimeout(() => setActiveBrickedNode(spawnBrickedNode), 0);
            }

            return prevBreaches.map(x => {
                if (x.id !== id) return x;
                const updated = { ...nextBreach };
                if (isManual) updated.lastInputTime = Date.now();
                return updated;
            });
        });

        if (updatedRoomData) {
            const r: Room = updatedRoomData;
            setMetaMap((prev: Room[][]): Room[][] => {
                const newMap = [...prev];
                if (newMap[r.y]) {
                    const row = [...newMap[r.y]];
                    row[r.x] = r;
                    newMap[r.y] = row;
                }
                return newMap;
            });
        }
        if (pendingCU) addComputeUnits(pendingCU);
        if (pendingRes) addRestoration(pendingRes);
        pendingSounds.forEach(s => playSound(s as any));
    }, [processBreachMove, addComputeUnits, addRestoration, playSound, metaMap]);

    // Initial setup
    useEffect(() => {
        if (breaches.length === 0) {
            initNewBreach();
        }
    }, [breaches.length, initNewBreach]);

    // AI Loop
    useEffect(() => {
        const aiInterval = setInterval(() => {
            const effects: { cu: number, res: number, sounds: string[] }[] = [];
            const updatedRooms: Room[] = [];
            const deg = gameStateRef.current.getDegradation();

            setBreaches(currentBreaches => {
                return currentBreaches.map(b => {
                    if (b.isPaused || b.hp <= 0) return b;

                    const isBeingControlled = b.id === activeBreachId && (Date.now() - b.lastInputTime < 4000);
                    
                    if (isBeingControlled) {
                        if (b.isAutoPlaying) {
                            return { ...b, logs: [...b.logs.slice(-4), '[PEREGRINE OVERRIDE DISENGAGED]'], isAutoPlaying: false };
                        }
                        return b;
                    }

                    let updatedB = { ...b };
                    if (!b.isAutoPlaying) {
                        updatedB = { 
                            ...b, 
                            logs: [...b.logs.slice(-4), '[PEREGRINE OVERRIDE ENGAGED]'],
                            mascotMessage: "I'LL TAKE IT FROM HERE!",
                            isAutoPlaying: true 
                        };
                    }

                    // === MINER: stay in cleared rooms, generate passive CU ===
                    if (updatedB.spec === 'miner' && updatedB.enemies.length === 0 && updatedB.loot.length === 0) {
                        const newAccum = (updatedB.minerTickAccum || 0) + 1;
                        const yieldAmt = gameStateRef.current.crawlerStats.minerYield || 3;
                        if (newAccum >= 3) { // Every 3 ticks = passive yield
                            effects.push({ cu: yieldAmt, res: 0, sounds: [] });
                            return { 
                                ...updatedB, 
                                minerTickAccum: 0,
                                logs: [...updatedB.logs.slice(-4), `[MINER: +${yieldAmt} CU passive yield]`],
                                isAutoPlaying: true 
                            };
                        }
                        return { ...updatedB, minerTickAccum: newAccum, isAutoPlaying: true };
                    }

                    // === SUMMONER: spawn daemons on room entry ===
                    if (updatedB.spec === 'summoner' && updatedB.daemons.length < 2 && updatedB.enemies.length > 0) {
                        const newDaemon: Daemon = {
                            id: `daemon-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
                            pos: { ...updatedB.playerPos },
                            hp: 10,
                            dmg: crawlerStats.baseDmg
                        };
                        updatedB = {
                            ...updatedB,
                            daemons: [...updatedB.daemons, newDaemon],
                            logs: [...updatedB.logs.slice(-4), '[SUMMONER: DAEMON SPAWNED]']
                        };
                    }

                    // === Daemon combat phase (summoner) ===
                    if (updatedB.daemons.length > 0 && updatedB.enemies.length > 0) {
                        let newEnemies = [...updatedB.enemies];
                        let newDaemons = [...updatedB.daemons];
                        let daemonCU = 0;

                        newDaemons.forEach(d => {
                            const target = newEnemies.find(e => 
                                Math.abs(e.pos.x - d.pos.x) + Math.abs(e.pos.y - d.pos.y) <= 3
                            );
                            if (target) {
                                const newHp = target.hp - d.dmg;
                                if (newHp <= 0) {
                                    newEnemies = newEnemies.filter(e => e.id !== target.id);
                                    daemonCU += 10;
                                } else {
                                    newEnemies = newEnemies.map(e => 
                                        e.id === target.id ? { ...e, hp: newHp } : e
                                    );
                                }
                            }
                        });

                        if (daemonCU > 0) {
                            effects.push({ cu: daemonCU, res: 0, sounds: [] });
                        }
                        updatedB = { ...updatedB, enemies: newEnemies, daemons: newDaemons };
                    }

                    // Pathfinding jitter from degradation
                    if (Math.random() < deg.pathfindingJitter) {
                        // Random walk instead of pathfinding
                        const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }]
                            .sort(() => Math.random() - 0.5);
                        for (const dir of dirs) {
                            const result = processBreachMove(updatedB, dir.dx, dir.dy, metaMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push(result.updatedRoom);
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                        }
                        return { ...updatedB, isAutoPlaying: true };
                    }

                    const currentPos = updatedB.playerPos;

                    // === ROGUE: evade enemies, prioritize loot/stairs ===
                    if (updatedB.spec === 'rogue') {
                        // Rogue skips enemies, goes for loot then stairs
                        let bestMove = null;
                        if (updatedB.loot.length > 0) {
                            // Check if adjacent loot
                            const adjLoot = updatedB.loot.find(l => Math.abs(l.pos.x - currentPos.x) + Math.abs(l.pos.y - currentPos.y) === 1);
                            if (adjLoot) {
                                const result = processBreachMove(updatedB, adjLoot.pos.x - currentPos.x, adjLoot.pos.y - currentPos.y, metaMap);
                                if (result) {
                                    effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                    if (result.updatedRoom) updatedRooms.push(result.updatedRoom);
                                    if (result.spawnBrickedNode) {
                                        setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                    }
                                    return { ...result.nextBreach, isAutoPlaying: true };
                                }
                            }
                            bestMove = findNextStep(updatedB.grid, currentPos, updatedB.loot.map(l => l.pos));
                        }
                        if (!bestMove && updatedB.stairsPos.x >= 0) {
                            bestMove = findNextStep(updatedB.grid, currentPos, [updatedB.stairsPos]);
                        }
                        if (bestMove) {
                            const result = processBreachMove(updatedB, bestMove.dx, bestMove.dy, metaMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push(result.updatedRoom);
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                        }
                    } else {
                        // === FIGHTER / MINER / SUMMONER: standard priority ===
                        
                        // 1. Attack adjacent enemy
                        const adjEnemy = updatedB.enemies.find(e => Math.abs(e.pos.x - currentPos.x) + Math.abs(e.pos.y - currentPos.y) === 1);
                        if (adjEnemy) {
                            const result = processBreachMove(updatedB, adjEnemy.pos.x - currentPos.x, adjEnemy.pos.y - currentPos.y, metaMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push(result.updatedRoom);
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                            return updatedB;
                        }

                        // 2. Grab adjacent loot
                        const adjLoot = updatedB.loot.find(l => Math.abs(l.pos.x - currentPos.x) + Math.abs(l.pos.y - currentPos.y) === 1);
                        if (adjLoot) {
                            const result = processBreachMove(updatedB, adjLoot.pos.x - currentPos.x, adjLoot.pos.y - currentPos.y, metaMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push(result.updatedRoom);
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                            return updatedB;
                        }

                        // 3. Pathfind: Fighter prioritizes enemies, others do loot→enemies→stairs
                        let bestMove = null;
                        if (updatedB.spec === 'fighter' && updatedB.enemies.length > 0) {
                            bestMove = findNextStep(updatedB.grid, currentPos, updatedB.enemies.map(e => e.pos));
                        }
                        if (!bestMove && updatedB.loot.length > 0) {
                            bestMove = findNextStep(updatedB.grid, currentPos, updatedB.loot.map(l => l.pos));
                        }
                        if (!bestMove && updatedB.enemies.length > 0) {
                            bestMove = findNextStep(updatedB.grid, currentPos, updatedB.enemies.map(e => e.pos));
                        }
                        if (!bestMove && updatedB.stairsPos.x >= 0) {
                            bestMove = findNextStep(updatedB.grid, currentPos, [updatedB.stairsPos]);
                        }

                        if (bestMove) {
                            const result = processBreachMove(updatedB, bestMove.dx, bestMove.dy, metaMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push(result.updatedRoom);
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                        }
                    }

                    // Random walk fallback
                    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }]
                        .sort(() => Math.random() - 0.5);
                    for (const dir of dirs) {
                        const result = processBreachMove(updatedB, dir.dx, dir.dy, metaMap);
                        if (result) {
                            effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                            if (result.updatedRoom) updatedRooms.push(result.updatedRoom);
                            if (result.spawnBrickedNode) {
                                setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                            }
                            return { ...result.nextBreach, isAutoPlaying: true };
                        }
                    }

                    return { ...updatedB, isAutoPlaying: true };
                });
            });

            // Execute buffered effects
            updatedRooms.forEach(r => {
                setMetaMap((prev: Room[][]): Room[][] => {
                    const newMap = [...prev];
                    if (newMap[r.y]) {
                        const row = [...newMap[r.y]];
                        row[r.x] = r;
                        newMap[r.y] = row;
                    }
                    return newMap;
                });
            });

            effects.forEach(e => {
                if (e.cu) addComputeUnits(e.cu);
                if (e.res) addRestoration(e.res);
                e.sounds.forEach(s => playSound(s as any));
            });
        }, Math.max(75, 450 - ((crawlerStats.speedBoost || 0) * 75)));

        return () => clearInterval(aiInterval);
    }, [activeBreachId, crawlerStats.speedBoost, addComputeUnits, addRestoration, playSound, processBreachMove, metaMap]);

    return (
        <DungeonContext.Provider value={{
            breaches, metaMap, activeBreachId, setActiveBreachId,
            movePlayer, togglePause, toggleMinimize, togglePin, terminateBreach,
            initNewBreach, mascotSay, restartBreach, setBreachSpec
        }}>
            {children}
        </DungeonContext.Provider>
    );
};

export const useDungeon = () => {
    const context = useContext(DungeonContext);
    if (!context) throw new Error('useDungeon must be used within a DungeonProvider');
    return context;
};
