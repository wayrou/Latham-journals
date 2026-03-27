import React, { useState, useEffect, useRef } from 'react';
import { useDungeon } from '../context/DungeonContext';
import { useGameState } from '../context/GameStateContext';
import BirdMascot from '../components/BirdMascot';

const Dungeon: React.FC = () => {
    const { fragments } = useGameState();
    const { 
        floor, grid, playerPos, enemies, loot, hp, maxHp, logs,
        isAutoPlaying, isPinned, setIsPinned,
        movePlayer, lastInputTime, mascotMessage
    } = useDungeon();

    const [isFullscreen, setIsFullscreen] = useState(false);

    const lastMoveRec = useRef<number>(0);
    const MOVE_COOLDOWN = 150;

    // Handle Input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const now = Date.now();
            if (now - lastMoveRec.current < MOVE_COOLDOWN) return;

            const isMovementKey = ['ArrowUp', 'w', 'W', 'ArrowDown', 's', 'S', 'ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'].includes(e.key);
            if (!isMovementKey) return;

            lastMoveRec.current = now;
            lastInputTime.current = now;

            if (['ArrowUp', 'w', 'W'].includes(e.key)) movePlayer(0, -1);
            if (['ArrowDown', 's', 'S'].includes(e.key)) movePlayer(0, 1);
            if (['ArrowLeft', 'a', 'A'].includes(e.key)) movePlayer(-1, 0);
            if (['ArrowRight', 'd', 'D'].includes(e.key)) movePlayer(1, 0);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [movePlayer, lastInputTime]);

    // Render logic
    const renderMap = () => {
        if (!grid.length) return '';
        const displayGrid = grid.map(row => [...row]);

        loot.forEach(l => displayGrid[l.pos.y][l.pos.x] = '$');
        enemies.forEach(e => displayGrid[e.pos.y][e.pos.x] = e.type);
        if (displayGrid[playerPos.y] && displayGrid[playerPos.y][playerPos.x] !== undefined) {
            displayGrid[playerPos.y][playerPos.x] = isAutoPlaying ? 'P' : '@';
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
                    PRGN_OS // BREACH PROTOCOL
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => setIsPinned(!isPinned)}
                        style={{ 
                            padding: '0.2rem 0.5rem', 
                            fontSize: '0.8rem', 
                            backgroundColor: isPinned ? 'var(--color-accent)' : 'transparent', 
                            borderColor: 'var(--color-accent)', 
                            color: isPinned ? 'var(--color-bg)' : 'var(--color-accent)', 
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {isPinned ? '[ UNPIN ]' : '[ PIN ]'}
                    </button>
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: 'transparent', borderColor: 'var(--color-primary-dim)', color: 'var(--color-primary)', cursor: 'pointer' }}
                    >
                        {isFullscreen ? '[ EXIT FULLSCREEN ]' : '[ FULLSCREEN ]'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flex: 1 }}>
                {/* 1. Main Render Window */}
                <div style={{ flex: '1', backgroundColor: '#05080a', border: '1px solid var(--color-primary-dim)', padding: '1rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', height: '50px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'visible' }}>
                        <BirdMascot message={mascotMessage} size="small" />
                    </div>
                    <pre style={{ margin: 0, fontSize: '1rem', lineHeight: '1', letterSpacing: '2px', color: 'var(--color-primary)', textShadow: '0 0 2px var(--color-primary-dim)' }}>
                        {renderMap()}
                    </pre>
                </div>

                {/* 2. Side Panel for Stats */}
                <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    {/* Status */}
                    <div style={{ border: '1px solid var(--color-primary-dim)', padding: '1rem', backgroundColor: 'rgba(56, 163, 160, 0.05)' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--color-accent)' }}>SYS. STATUS</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div>SECTOR: {floor}</div>
                            <div>HP: {hp} / {maxHp}</div>
                            <div style={{ color: 'var(--color-primary)' }}>FRAGMENTS: {fragments}</div>
                            <div style={{ color: 'var(--color-primary-dim)', fontSize: '0.8rem', marginTop: '1rem' }}>
                                MODE: {isAutoPlaying ? 'AUTO-CRAWL' : 'MANUAL OVERRIDE'}
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
