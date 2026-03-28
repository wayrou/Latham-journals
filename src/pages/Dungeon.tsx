import React, { useState, useEffect, useRef } from 'react';
import { useDungeon, type BreachInstance } from '../context/DungeonContext';
import { useGameState } from '../context/GameStateContext';
import BirdMascot from '../components/BirdMascot';

const Dungeon: React.FC = () => {
    const { crawlerStats } = useGameState();
    const { 
        breaches, metaMap, activeBreachId, setActiveBreachId,
        movePlayer, togglePause, toggleMinimize, togglePin, terminateBreach,
        initNewBreach, restartBreach, setBreachSpec
    } = useDungeon();

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMegaView, setIsMegaView] = useState(false);
    const lastMoveRec = useRef<number>(0);
    const MOVE_COOLDOWN = 150;

    // Handle Keyboard Input for Active Breach
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!activeBreachId) return;
            const b = breaches.find(x => x.id === activeBreachId);
            if (!b || b.isPaused || b.hp <= 0) return;

            const now = Date.now();
            if (now - lastMoveRec.current < MOVE_COOLDOWN) return;

            const isMovementKey = ['ArrowUp', 'w', 'W', 'ArrowDown', 's', 'S', 'ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'].includes(e.key);
            if (!isMovementKey) return;

            lastMoveRec.current = now;
            if (['ArrowUp', 'w', 'W'].includes(e.key)) movePlayer(activeBreachId, 0, -1, true);
            if (['ArrowDown', 's', 'S'].includes(e.key)) movePlayer(activeBreachId, 0, 1, true);
            if (['ArrowLeft', 'a', 'A'].includes(e.key)) movePlayer(activeBreachId, -1, 0, true);
            if (['ArrowRight', 'd', 'D'].includes(e.key)) movePlayer(activeBreachId, 1, 0, true);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [movePlayer, activeBreachId, breaches]);

    const renderMapAt = (rx: number, ry: number, b?: BreachInstance) => {
        if (rx < 0 || rx >= 10 || ry < 0 || ry >= 10) return ' '.repeat(144);
        const room = metaMap[ry][rx];
        const displayGrid = room.grid.map(row => [...row]);

        // Use the breach's live entity arrays for its current room so that
        // collected loot and killed enemies immediately disappear from the display.
        const isBreachRoom = b && b.roomX === rx && b.roomY === ry;
        const displayLoot  = isBreachRoom ? b.loot    : room.loot;
        const displayEnemies = isBreachRoom ? b.enemies : room.enemies;

        displayLoot.forEach(l => {
            if (displayGrid[l.pos.y] && displayGrid[l.pos.y][l.pos.x] !== undefined) {
                displayGrid[l.pos.y][l.pos.x] = '$';
            }
        });
        displayEnemies.forEach(e => {
            if (displayGrid[e.pos.y] && displayGrid[e.pos.y][e.pos.x] !== undefined) {
                displayGrid[e.pos.y][e.pos.x] = e.type;
            }
        });

        // Draw the player
        if (isBreachRoom) {
            // Draw daemons first (behind player)
            if (b.daemons) {
                b.daemons.forEach(d => {
                    if (displayGrid[d.pos.y] && displayGrid[d.pos.y][d.pos.x] !== undefined) {
                        displayGrid[d.pos.y][d.pos.x] = 'd';
                    }
                });
            }

            if (displayGrid[b.playerPos.y] && displayGrid[b.playerPos.y][b.playerPos.x] !== undefined) {
                displayGrid[b.playerPos.y][b.playerPos.x] = b.isAutoPlaying ? 'P' : '@';
            }
        }

        return displayGrid.map(row => row.join('')).join('\n');
    };

    const renderMap = (b: BreachInstance) => {
        return renderMapAt(b.roomX, b.roomY, b);
    };

    return (
        <div style={{
            padding: isFullscreen ? '2rem 4rem' : '1rem',
            fontFamily: 'var(--font-mono)',
            height: isFullscreen ? '100vh' : 'calc(100vh - 80px)',
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
            {/* Unified Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-primary-dim)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ margin: 0 }}>PRGN_OS // MULTI-BREACH PROTOCOL</h2>
                    <div style={{ color: 'var(--color-accent)', fontSize: '0.9rem', padding: '2px 8px', border: '1px solid var(--color-accent)' }}>
                        CAPACITY: {breaches.length} / {crawlerStats.maxBreachWindows}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {breaches.length < crawlerStats.maxBreachWindows && (
                        <button
                            onClick={() => initNewBreach()}
                            style={{ padding: '0.2rem 1rem', fontSize: '0.8rem', backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            [ + INITIATE NEW BREACH ]
                        </button>
                    )}
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: 'transparent', border: '1px solid var(--color-primary-dim)', color: 'var(--color-primary)', cursor: 'pointer' }}
                    >
                        {isFullscreen ? '[ EXIT FULLSCREEN ]' : '[ FULLSCREEN ]'}
                    </button>
                    <button
                        onClick={() => setIsMegaView(!isMegaView)}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: isMegaView ? 'var(--color-accent)' : 'transparent', border: '1px solid var(--color-accent)', color: isMegaView ? 'var(--color-bg)' : 'var(--color-accent)', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {isMegaView ? '[ CLOSE MEGA-BREACH ]' : '[ OPEN MEGA-BREACH ]'}
                    </button>
                </div>
            </div>

            {isMegaView && activeBreachId && (() => {
                const activeBreach = breaches.find(b => b.id === activeBreachId);
                if (!activeBreach) return null;
                return (
                    <div style={{
                        marginBottom: '2rem',
                        border: '2px solid var(--color-accent)',
                        padding: '1rem',
                        backgroundColor: 'rgba(56, 163, 160, 0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-accent)', paddingBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--color-accent)' }}>
                                ◈ MEGA-BREACH_INTERFACE &nbsp;// &nbsp;{activeBreach.callsign} &nbsp;@ [{activeBreach.roomX},{activeBreach.roomY}]
                            </span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>3×3 SECTOR VIEW — WASD / ARROWS TO NAVIGATE</span>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '6px',
                            width: '100%',
                        }}>
                            {[-1, 0, 1].map(dy => (
                                <React.Fragment key={dy}>
                                    {[-1, 0, 1].map(dx => {
                                        const rx = activeBreach.roomX + dx;
                                        const ry = activeBreach.roomY + dy;
                                        const isCenter = dx === 0 && dy === 0;
                                        const isOutOfBounds = rx < 0 || rx >= 10 || ry < 0 || ry >= 10;
                                        return (
                                            <div key={dx} style={{
                                                border: isCenter
                                                    ? '2px solid var(--color-accent)'
                                                    : '1px solid rgba(56,163,160,0.2)',
                                                backgroundColor: isCenter ? 'rgba(56,163,160,0.08)' : '#05080a',
                                                padding: '6px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px',
                                                boxShadow: isCenter ? '0 0 12px rgba(56,163,160,0.25)' : 'none',
                                            }}>
                                                <div style={{ fontSize: '0.65rem', opacity: 0.5, color: isCenter ? 'var(--color-accent)' : 'inherit' }}>
                                                    {isOutOfBounds ? '[ OUT OF BOUNDS ]' : `[${rx},${ry}]${isCenter ? ' ◈ YOU ARE HERE' : ''}`}
                                                </div>
                                                <pre style={{
                                                    fontSize: isCenter ? '0.75rem' : '0.3rem',
                                                    lineHeight: isCenter ? '1.2' : '1.1',
                                                    margin: 0,
                                                    color: isCenter ? 'var(--color-primary)' : 'rgba(56,163,160,0.35)',
                                                    overflow: 'hidden',
                                                    letterSpacing: isCenter ? '1px' : '0',
                                                }}>
                                                    {isOutOfBounds ? '[ FIREWALL — ACCESS DENIED ]' : renderMapAt(rx, ry, activeBreach)}
                                                </pre>
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Scrollable Breach List */}
            <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(650px, 1fr))', 
                gap: '1.5rem', 
                paddingRight: '1rem',
                alignContent: 'start'
            }}>
                {breaches.map(b => (
                    <div 
                        key={b.id} 
                        style={{ 
                            border: `1px solid ${b.id === activeBreachId ? 'var(--color-accent)' : 'var(--color-primary-dim)'}`,
                            backgroundColor: b.id === activeBreachId ? 'rgba(56, 163, 160, 0.05)' : 'rgba(56, 163, 160, 0.02)',
                            padding: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            minHeight: b.isMinimized ? 'auto' : '400px',
                            boxShadow: b.id === activeBreachId ? '0 0 15px rgba(56, 163, 160, 0.2)' : 'none',
                            transition: 'all 0.3s ease',
                            height: 'fit-content'
                        }}
                    >
                        {/* Instance Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-primary-dim)', paddingBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ color: b.id === activeBreachId ? 'var(--color-accent)' : 'var(--color-primary)', fontWeight: 'bold' }}>
                                    {b.id === activeBreachId ? '> ' : ''}{b.callsign}
                                </span>
                                <span style={{ fontSize: '0.7rem', padding: '1px 4px', border: '1px solid currentColor', opacity: 0.8 }}>
                                    {b.spec?.toUpperCase() || 'FIGHTER'}
                                </span>
                                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>LOC: [{b.roomX},{b.roomY}]</span>
                                <span style={{ fontSize: '0.8rem', color: b.hp < b.maxHp * 0.3 ? 'var(--color-alert)' : 'var(--color-primary)' }}>
                                    HP: {b.hp}/{b.maxHp}
                                </span>
                                {b.isPaused && <span style={{ color: 'var(--color-alert)', fontSize: '0.8rem' }}>[ PAUSED ]</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <select 
                                    value={b.spec} 
                                    onChange={(e) => setBreachSpec(b.id, e.target.value as any)}
                                    style={{ 
                                        padding: '0.1rem 0.2rem', 
                                        fontSize: '0.7rem', 
                                        backgroundColor: '#05080a', 
                                        color: 'var(--color-accent)', 
                                        border: '1px solid var(--color-accent)',
                                        cursor: 'pointer',
                                        height: '20px'
                                    }}
                                >
                                    <option value="fighter">FIGHTER</option>
                                    <option value="rogue">ROGUE</option>
                                    <option value="miner">MINER</option>
                                    <option value="summoner">SUMMONER</option>
                                </select>
                                <button
                                    onClick={() => setActiveBreachId(b.id)}
                                    disabled={b.id === activeBreachId}
                                    style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', backgroundColor: b.id === activeBreachId ? 'var(--color-accent)' : 'transparent', color: b.id === activeBreachId ? 'var(--color-bg)' : 'var(--color-accent)', border: '1px solid var(--color-accent)', cursor: 'pointer' }}
                                >
                                    {b.id === activeBreachId ? 'ACTIVE' : 'TAKE OVER'}
                                </button>
                                <button onClick={() => togglePause(b.id)} style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>{b.isPaused ? 'RESUME' : 'PAUSE'}</button>
                                <button onClick={() => toggleMinimize(b.id)} style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>{b.isMinimized ? 'EXPAND' : 'MINIMIZE'}</button>
                                <button onClick={() => togglePin(b.id)} style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', backgroundColor: b.isPinned ? 'var(--color-accent)' : 'transparent' }}>PIN</button>
                                {b.hp <= 0 && (
                                    <button onClick={() => restartBreach(b.id)} style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', backgroundColor: 'var(--color-alert)', color: 'white' }}>RESTART</button>
                                )}
                                <button onClick={() => terminateBreach(b.id)} style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', color: 'var(--color-alert)' }}>TERMINATE</button>
                            </div>
                        </div>

                        {!b.isMinimized && (
                            <div style={{ display: 'flex', gap: '1.5rem', flex: 1 }}>
                                {/* Map */}
                                <div style={{ flex: 1, backgroundColor: '#05080a', border: '1px solid rgba(56,163,160,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: '10px', height: '30px' }}>
                                        <BirdMascot message={b.mascotMessage} size="small" />
                                    </div>
                                    <pre style={{ fontSize: '0.8rem', lineHeight: '1', letterSpacing: '2px', color: 'var(--color-primary)' }}>
                                        {renderMap(b)}
                                    </pre>
                                </div>

                                {/* Dash & Logs */}
                                <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.8, borderBottom: '1px solid rgba(56,163,160,0.1)', paddingBottom: '0.5rem' }}>
                                        <div style={{ color: 'var(--color-accent)', marginBottom: '4px' }}>UNIT STATS</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>DMG_OUTPUT</span><span>{crawlerStats.baseDmg}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>PROCESS_SPD</span><span>{crawlerStats.speedBoost}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>MAX_HP_BSR</span><span>+{crawlerStats.maxHpBoost}</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.8, flex: 1, overflow: 'hidden' }}>
                                        <div style={{ color: 'var(--color-accent)', marginBottom: '4px' }}>EVENT LOG</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                                            {b.logs.map((L, i) => <div key={i} style={{ opacity: 1 - (b.logs.length - 1 - i) * 0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>&gt; {L}</div>)}
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 'auto', fontSize: '0.7rem', color: 'var(--color-primary-dim)' }}>
                                        {b.spec === 'summoner' && b.daemons && b.daemons.length > 0 && (
                                            <div style={{ color: 'var(--color-accent)', marginBottom: '4px' }}>DAEMONS ACTIVE: {b.daemons.length}</div>
                                        )}
                                        {b.isAutoPlaying ? '[ PEREGRINE_AUTO_CRAWL: ACTIVE ]' : '[ MANUAL_OVERRIDE: STANDBY ]'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {breaches.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                        <h3>NO ACTIVE BREACH PROTOCOLS</h3>
                        <button onClick={() => initNewBreach()} style={{ padding: '0.5rem 2rem', backgroundColor: 'var(--color-accent)', border: 'none', color: 'var(--color-bg)', cursor: 'pointer' }}>
                            [ INITIATE CONNECTION ]
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dungeon;
