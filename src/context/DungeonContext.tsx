import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useGameState } from './GameStateContext';
import { generateDungeon, type Position, type Enemy, type Loot } from '../utils/dungeonGenerator';
import { useSound } from '../hooks/useSound';

const DUNGEON_WIDTH = 40;
const DUNGEON_HEIGHT = 15;

interface DungeonContextType {
    floor: number;
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
    setIsPinned: (pinned: boolean) => void;
    movePlayer: (dx: number, dy: number) => void;
    initFloor: (level: number) => void;
    resetDungeon: () => void;
    mascotSay: (msg: string) => void;
    lastInputTime: React.MutableRefObject<number>;
}

const DungeonContext = createContext<DungeonContextType | undefined>(undefined);

export const DungeonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { addRestoration, addFragments, crawlerStats } = useGameState();
    const { playSound } = useSound();

    const [floor, setFloor] = useState(1);
    const [grid, setGrid] = useState<string[][]>([]);
    const [playerPos, setPlayerPos] = useState<Position>({ x: 0, y: 0 });
    const [stairsPos, setStairsPos] = useState<Position>({ x: 0, y: 0 });
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [loot, setLoot] = useState<Loot[]>([]);
    const [hp, setHp] = useState(20);
    const [maxHp, setMaxHp] = useState(20);
    const [logs, setLogs] = useState<string[]>(['[BREACH PROTOCOL INITIATED]']);
    const [mascotMessage, setMascotMessage] = useState<string | null>(null);
    const [isAutoPlayingState, setIsAutoPlayingState] = useState(false);
    const [isPinned, setIsPinned] = useState(false);

    const mascotTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastInputTime = useRef<number>(Date.now());
    const isAutoPlaying = useRef<boolean>(false);

    const logMsg = useCallback((msg: string) => {
        setLogs(prev => [...prev.slice(-4), msg]);
    }, []);

    const mascotSay = useCallback((msg: string) => {
        setMascotMessage(msg);
        if (mascotTimeout.current) clearTimeout(mascotTimeout.current);
        mascotTimeout.current = setTimeout(() => setMascotMessage(null), 2000);
    }, []);

    const initFloor = useCallback((level: number) => {
        const { grid: newGrid, playerPos: newPlayerPos, stairsPos: newStairsPos, enemies: newEnemies, loot: newLoot } = generateDungeon(DUNGEON_WIDTH, DUNGEON_HEIGHT, level);
        setGrid(newGrid);
        setPlayerPos(newPlayerPos);
        setStairsPos(newStairsPos);
        setEnemies(newEnemies);
        setLoot(newLoot);
        setFloor(level);
        logMsg(`ADVANCED TO SECTOR ${level}`);
        mascotSay(`SECTOR ${level}`);
    }, [logMsg, mascotSay]);

    const resetDungeon = useCallback(() => {
        const initialHp = 20 + crawlerStats.maxHpBoost;
        setHp(initialHp);
        setMaxHp(initialHp);
        initFloor(1);
    }, [crawlerStats.maxHpBoost, initFloor]);

    const movePlayer = useCallback((dx: number, dy: number) => {
        if (hp <= 0) return;

        setPlayerPos(prev => {
            const nx = prev.x + dx;
            const ny = prev.y + dy;

            if (nx < 0 || nx >= DUNGEON_WIDTH || ny < 0 || ny >= DUNGEON_HEIGHT) return prev;
            if (grid[ny][nx] === '#') return prev;

            // Combat
            const enemyIdx = enemies.findIndex(e => e.pos.x === nx && e.pos.y === ny);
            if (enemyIdx !== -1) {
                const playerDmg = crawlerStats.baseDmg;
                
                setEnemies(prevEnemies => {
                    const target = prevEnemies[enemyIdx];
                    const newHp = target.hp - playerDmg;
                    
                    if (newHp <= 0) {
                        logMsg(`${target.type} DELETED.`);
                        mascotSay("TARGET DELETED!");
                        return prevEnemies.filter((_, i) => i !== enemyIdx);
                    } else {
                        logMsg(`Attacked ${target.type} for ${playerDmg} DMG!`);
                        mascotSay("ENGAGING.");
                        playSound('click');
                        
                        // Counter-attack
                        setHp(h => {
                            const counterHp = h - target.dmg;
                            logMsg(`${target.type} countered for ${target.dmg} DMG!`);
                            if (counterHp <= 0) {
                                mascotSay("CRITICAL FAILURE!");
                                logMsg('[SYSTEM ERROR: CRAWLER DESTROYED]');
                                playSound('error');
                                setTimeout(() => {
                                    resetDungeon();
                                }, 2000);
                            } else if (counterHp < maxHp * 0.3) {
                                mascotSay("SHIELDS CRITICAL!");
                            }
                            return counterHp;
                        });

                        return prevEnemies.map((e, i) => i === enemyIdx ? { ...e, hp: newHp } : e);
                    }
                });
                return prev;
            }

            // Loot
            const lootIdx = loot.findIndex(l => l.pos.x === nx && l.pos.y === ny);
            if (lootIdx !== -1) {
                const l = loot[lootIdx];
                addFragments(l.amount);
                playSound('success');

                setHp(h => {
                    const heal = 2;
                    const newHp = Math.min(maxHp, h + heal);
                    if (newHp > h) {
                        logMsg(`Recovered data (+${heal} HP / +${l.amount} FRAG)`);
                        mascotSay("SHINY!");
                    } else {
                        logMsg(`Recovered ${l.amount} fragments.`);
                        mascotSay("SHINY!");
                    }
                    return newHp;
                });

                if (Math.random() > 0.8) {
                    addRestoration(5);
                    logMsg('++ GLOBAL RESTORATION BOOST ++');
                    mascotSay("ARCHIVE EXPANDED!");
                }
                
                setLoot(prevLoot => prevLoot.filter((_, i) => i !== lootIdx));
            }

            // Stairs
            if (nx === stairsPos.x && ny === stairsPos.y) {
                initFloor(floor + 1);
                setMaxHp(m => m + 5);
                setHp(h => h + 5);
                return prev; 
            }

            return { x: nx, y: ny };
        });
    }, [grid, floor, initFloor, addRestoration, stairsPos, maxHp, addFragments, crawlerStats, enemies, loot, hp, playSound, resetDungeon, logMsg]);

    // Initial floor setup
    useEffect(() => {
        if (grid.length === 0) {
            initFloor(1);
        }
    }, [initFloor, grid.length]);

    // Auto-Play AI Loop
    useEffect(() => {
        const aiInterval = setInterval(() => {
            if (Date.now() - lastInputTime.current < 4000) {
                if (isAutoPlaying.current) {
                    isAutoPlaying.current = false;
                    setIsAutoPlayingState(false);
                    logMsg('[PEREGRINE OVERRIDE DISENGAGED]');
                }
                return; // Player is active
            }
            
            if (!isAutoPlaying.current) {
                logMsg('[PEREGRINE OVERRIDE ENGAGED]');
                mascotSay("I'LL TAKE IT FROM HERE!");
                isAutoPlaying.current = true;
                setIsAutoPlayingState(true);
            }

            if (hp <= 0) return;

            setPlayerPos(currentPos => {
                const adjEnemy = enemies.find(e => Math.abs(e.pos.x - currentPos.x) + Math.abs(e.pos.y - currentPos.y) === 1);
                if (adjEnemy) {
                    movePlayer(adjEnemy.pos.x - currentPos.x, adjEnemy.pos.y - currentPos.y);
                    return currentPos;
                }

                const adjLoot = loot.find(l => Math.abs(l.pos.x - currentPos.x) + Math.abs(l.pos.y - currentPos.y) === 1);
                if (adjLoot) {
                    movePlayer(adjLoot.pos.x - currentPos.x, adjLoot.pos.y - currentPos.y);
                    return currentPos;
                }

                const moves = [
                    { dx: 0, dy: -1 },
                    { dx: 0, dy: 1 },
                    { dx: -1, dy: 0 },
                    { dx: 1, dy: 0 }
                ];

                let bestMove = null;
                let bestDist = Infinity;

                for (const m of moves) {
                    const nx = currentPos.x + m.dx;
                    const ny = currentPos.y + m.dy;
                    if (grid[ny] && grid[ny][nx] && grid[ny][nx] !== '#') {
                        const dist = Math.abs(nx - stairsPos.x) + Math.abs(ny - stairsPos.y);
                        const randDist = dist + (Math.random() * 0.5);
                        if (randDist < bestDist) {
                            bestDist = randDist;
                            bestMove = m;
                        }
                    }
                }

                if (bestMove) {
                    movePlayer(bestMove.dx, bestMove.dy);
                }
                
                return currentPos;
            });

        }, 500); 

        return () => clearInterval(aiInterval);
    }, [enemies, loot, movePlayer, stairsPos, grid, hp, logMsg]);

    return (
        <DungeonContext.Provider value={{
            floor, grid, playerPos, stairsPos, enemies, loot, hp, maxHp, logs,
            mascotMessage,
            isAutoPlaying: isAutoPlayingState,
            isPinned, setIsPinned,
            movePlayer, initFloor, resetDungeon, mascotSay,
            lastInputTime
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
