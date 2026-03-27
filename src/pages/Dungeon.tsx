import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameState } from '../context/GameStateContext';
import { generateDungeon, type Position, type Enemy, type Loot } from '../utils/dungeonGenerator';
import BirdMascot from '../components/BirdMascot';
import { useSound } from '../hooks/useSound';

const DUNGEON_WIDTH = 40;
const DUNGEON_HEIGHT = 15;

let cachedDungeonState: {
    floor: number;
    grid: string[][];
    playerPos: Position;
    stairsPos: Position;
    enemies: Enemy[];
    loot: Loot[];
    hp: number;
    maxHp: number;
    logs: string[];
} | null = null;

const Dungeon: React.FC = () => {
    const { addRestoration, addFragments, crawlerStats, fragments } = useGameState();
    const { playSound } = useSound();
    const [floor, setFloor] = useState(cachedDungeonState?.floor ?? 1);
    const [grid, setGrid] = useState<string[][]>(cachedDungeonState?.grid ?? []);
    const [playerPos, setPlayerPos] = useState<Position>(cachedDungeonState?.playerPos ?? { x: 0, y: 0 });
    const [stairsPos, setStairsPos] = useState<Position>(cachedDungeonState?.stairsPos ?? { x: 0, y: 0 });
    const [enemies, setEnemies] = useState<Enemy[]>(cachedDungeonState?.enemies ?? []);
    const [loot, setLoot] = useState<Loot[]>(cachedDungeonState?.loot ?? []);
    const [hp, setHp] = useState(cachedDungeonState?.hp ?? 20);
    const [maxHp, setMaxHp] = useState(cachedDungeonState?.maxHp ?? 20);
    const [logs, setLogs] = useState<string[]>(cachedDungeonState?.logs ?? ['[BREACH PROTOCOL INITIATED]']);
    const [mascotMessage, setMascotMessage] = useState<string | null>(null);

    useEffect(() => {
        cachedDungeonState = { floor, grid, playerPos, stairsPos, enemies, loot, hp, maxHp, logs };
    }, [floor, grid, playerPos, stairsPos, enemies, loot, hp, maxHp, logs]);

    // Auto-play refs
    const lastInputTime = useRef<number>(Date.now());
    const isAutoPlaying = useRef<boolean>(false);
    const mascotTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const logMsg = (msg: string) => {
        setLogs(prev => [...prev.slice(-4), msg]);
    };

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
    }, [mascotSay]);

    useEffect(() => {
        if (!cachedDungeonState || cachedDungeonState.grid.length === 0) {
            initFloor(1);
        }
    }, [initFloor]);

    const movePlayer = useCallback((dx: number, dy: number) => {
        setHp(currentHp => {
            if (currentHp <= 0) return currentHp;

            setPlayerPos(prev => {
                const nx = prev.x + dx;
                const ny = prev.y + dy;

                if (nx < 0 || nx >= DUNGEON_WIDTH || ny < 0 || ny >= DUNGEON_HEIGHT) return prev;
                if (grid[ny][nx] === '#') return prev;

                // Combat
                let combatOccurred = false;
                setEnemies(prevEnemies => {
                    const enemyIdx = prevEnemies.findIndex(e => e.pos.x === nx && e.pos.y === ny);
                    if (enemyIdx !== -1) {
                        combatOccurred = true;
                        const e = prevEnemies[enemyIdx];
                        const playerDmg = crawlerStats.baseDmg;
                        e.hp -= playerDmg;
                        logMsg(`Attacked ${e.type} for ${playerDmg} DMG!`);
                        mascotSay("ENGAGING.");
                        playSound('click');

                        if (e.hp <= 0) {
                            logMsg(`${e.type} DELETED.`);
                            mascotSay("TARGET DELETED!");
                            return prevEnemies.filter((_, i) => i !== enemyIdx);
                        } else {
                            // ENEMY SURVIVES AND COUNTER-ATTACKS
                            setHp(h => {
                                const newHp = h - e.dmg;
                                logMsg(`${e.type} countered for ${e.dmg} DMG!`);
                                if (newHp <= 0) {
                                    mascotSay("CRITICAL FAILURE!");
                                    logMsg('[SYSTEM ERROR: CRAWLER DESTROYED]');
                                    playSound('error');
                                    setTimeout(() => {
                                        setHp(20 + crawlerStats.maxHpBoost);
                                        setMaxHp(20 + crawlerStats.maxHpBoost);
                                        initFloor(1);
                                    }, 2000);
                                } else if (newHp < maxHp * 0.3) {
                                    mascotSay("SHIELDS CRITICAL!");
                                }
                                return newHp;
                            });
                        }
                        return [...prevEnemies];
                    }
                    return prevEnemies;
                });

                if (combatOccurred) return prev;

                // Loot
                setLoot(prevLoot => {
                    const idx = prevLoot.findIndex(l => l.pos.x === nx && l.pos.y === ny);
                    if (idx !== -1) {
                        const l = prevLoot[idx];
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
                            addRestoration(5); // Add global restoration randomly
                            logMsg('++ GLOBAL RESTORATION BOOST ++');
                            mascotSay("ARCHIVE EXPANDED!");
                        }
                        return prevLoot.filter((_, i) => i !== idx);
                    }
                    return prevLoot;
                });

                // Stairs
                if (nx === stairsPos.x && ny === stairsPos.y) {
                    initFloor(floor + 1);
                    setMaxHp(m => m + 5);
                    setHp(h => h + 5);
                    return prev; // Let initFloor handle placement
                }

                return { x: nx, y: ny };
            });
            return currentHp;
        });
    }, [grid, floor, initFloor, addRestoration, stairsPos, mascotSay, maxHp, addFragments, crawlerStats]);

    // Handle Input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMovementKey = ['ArrowUp', 'w', 'W', 'ArrowDown', 's', 'S', 'ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'].includes(e.key);

            if (['ArrowUp', 'w', 'W'].includes(e.key)) { movePlayer(0, -1); lastInputTime.current = Date.now(); }
            if (['ArrowDown', 's', 'S'].includes(e.key)) { movePlayer(0, 1); lastInputTime.current = Date.now(); }
            if (['ArrowLeft', 'a', 'A'].includes(e.key)) { movePlayer(-1, 0); lastInputTime.current = Date.now(); }
            if (['ArrowRight', 'd', 'D'].includes(e.key)) { movePlayer(1, 0); lastInputTime.current = Date.now(); }

            if (isMovementKey && isAutoPlaying.current) {
                isAutoPlaying.current = false;
                logMsg('[PEREGRINE OVERRIDE DISENGAGED]');
                mascotSay("MANUAL CONTROL RESTORED.");
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [movePlayer, mascotSay]);

    // Auto-Play AI Loop
    useEffect(() => {
        const aiInterval = setInterval(() => {
            if (Date.now() - lastInputTime.current < 4000) {
                return; // Player is active
            }
            if (!isAutoPlaying.current) {
                logMsg('[PEREGRINE OVERRIDE ENGAGED]');
                mascotSay("I'LL TAKE IT FROM HERE!");
                isAutoPlaying.current = true;
            }

            // Simple Greedy AI
            setPlayerPos(currentPos => {
                // If enemy adjacent, attack it
                const adjEnemy = enemies.find(e => Math.abs(e.pos.x - currentPos.x) + Math.abs(e.pos.y - currentPos.y) === 1);
                if (adjEnemy) {
                    movePlayer(adjEnemy.pos.x - currentPos.x, adjEnemy.pos.y - currentPos.y);
                    return currentPos;
                }

                // If loot adjacent, grab it
                const adjLoot = loot.find(l => Math.abs(l.pos.x - currentPos.x) + Math.abs(l.pos.y - currentPos.y) === 1);
                if (adjLoot) {
                    movePlayer(adjLoot.pos.x - currentPos.x, adjLoot.pos.y - currentPos.y);
                    return currentPos;
                }

                // Move towards stairs via Manhatten heuristic
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
                        // Add some randomness to avoid getting stuck entirely
                        const randDist = dist + (Math.random() * 2);
                        if (randDist < bestDist) {
                            bestDist = randDist;
                            bestMove = m;
                        }
                    }
                }

                if (bestMove) {
                    movePlayer(bestMove.dx, bestMove.dy);
                } else {
                    // Fallback random move
                    const randomMove = moves[Math.floor(Math.random() * moves.length)];
                    movePlayer(randomMove.dx, randomMove.dy);
                }

                return currentPos;
            });

        }, 500); // 500ms per tick for autoplay

        return () => clearInterval(aiInterval);
    }, [enemies, loot, movePlayer, stairsPos, grid]);

    const [isFullscreen, setIsFullscreen] = useState(false);

    // Render logic
    const renderMap = () => {
        if (!grid.length) return '';
        const displayGrid = grid.map(row => [...row]);

        loot.forEach(l => displayGrid[l.pos.y][l.pos.x] = '$');
        enemies.forEach(e => displayGrid[e.pos.y][e.pos.x] = e.type);
        if (displayGrid[playerPos.y] && displayGrid[playerPos.y][playerPos.x] !== undefined) {
            displayGrid[playerPos.y][playerPos.x] = isAutoPlaying.current ? 'P' : '@';
        }

        return displayGrid.map(row => row.join('')).join('\n');
    };

    return (
        <div style={{
            padding: isFullscreen ? '2rem 4rem' : '2rem',
            fontFamily: 'var(--font-mono)',
            height: isFullscreen ? '100vh' : 'calc(100vh - 100px)',
            width: isFullscreen ? '100vw' : 'auto',
            position: isFullscreen ? 'fixed' : 'relative',
            top: 0,
            left: 0,
            zIndex: isFullscreen ? 9999 : 1,
            backgroundColor: 'var(--color-bg)',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-primary-dim)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>
                    PGNOS // BREACH PROTOCOL
                </h2>
                <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: 'transparent', borderColor: 'var(--color-primary-dim)', color: 'var(--color-primary)', cursor: 'pointer' }}
                >
                    {isFullscreen ? '[ EXIT FULLSCREEN ]' : '[ FULLSCREEN ]'}
                </button>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flex: 1 }}>
                {/* 1. Main Render Window */}
                <div style={{ flex: '1', backgroundColor: '#05080a', border: '1px solid var(--color-primary-dim)', padding: '1rem', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <pre style={{ margin: 0, fontSize: '1rem', lineHeight: '1', letterSpacing: '2px', color: 'var(--color-primary)', textShadow: '0 0 2px var(--color-primary-dim)' }}>
                        {renderMap()}
                    </pre>
                </div>

                {/* 2. Side Panel for Stats */}
                <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    {/* Mascot */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '-1rem' }}>
                        <BirdMascot message={mascotMessage} />
                    </div>

                    {/* Status */}
                    <div style={{ border: '1px solid var(--color-primary-dim)', padding: '1rem', backgroundColor: 'rgba(56, 163, 160, 0.05)' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--color-accent)' }}>SYS. STATUS</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div>SECTOR: {floor}</div>
                            <div>HP: {hp} / {maxHp}</div>
                            <div style={{ color: 'var(--color-primary)' }}>FRAGMENTS: {fragments}</div>
                            <div style={{ color: 'var(--color-primary-dim)', fontSize: '0.8rem', marginTop: '1rem' }}>
                                MODE: {isAutoPlaying.current ? 'AUTO-CRAWL' : 'MANUAL OVERRIDE'}
                            </div>
                            <div style={{ color: 'var(--color-primary-dim)', fontSize: '0.7rem' }}>
                                [WAIT 4s FOR AUTO-PILOT]
                            </div>
                        </div>
                    </div>

                    {/* Event Log */}
                    <div style={{ border: '1px solid var(--color-primary-dim)', padding: '1rem', flex: 1, backgroundColor: 'rgba(56, 163, 160, 0.05)', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--color-primary-dim)' }}>EVENT LOG</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', fontSize: '0.85rem' }}>
                            {logs.map((L, i) => (
                                <div key={i} style={{ opacity: 1 - ((logs.length - 1 - i) * 0.2) }}>
                                    &gt; {L}
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Dungeon;
