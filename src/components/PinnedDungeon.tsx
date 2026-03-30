import React from 'react';
import { useDungeon } from '../context/DungeonContext';
import { useNavigate } from 'react-router-dom';
import { useGameState } from '../context/GameStateContext';
import BirdMascot from './BirdMascot';
import { useDraggable } from '../hooks/useDraggable';
import { formatComputeUnits } from '../utils/numberFormat';

const PinnedDungeon: React.FC = () => {
    const { breaches, activeBreachId, togglePin } = useDungeon();
    const { computeUnits, pinnedPositions, updatePinnedPosition } = useGameState();
    const navigate = useNavigate();

    const initialPos = pinnedPositions?.breach || { x: window.innerWidth - 200, y: 20 };
    const { pos, onMouseDown, isDragging } = useDraggable('breach', initialPos, updatePinnedPosition);

    const activeBreach = breaches.find(b => b.id === activeBreachId) || breaches[0];
    
    if (!activeBreach || !activeBreach.isPinned) return null;

    const { grid, playerPos, enemies, loot, hp, maxHp, floor, logs, isAutoPlaying, mascotMessage } = activeBreach;

    const renderMiniMap = () => {
        if (!grid.length) return '';
        
        // Render a cropped version around the player for the mini-view
        const VIEW_SIZE = 7;
        const startX = Math.max(0, Math.min(grid[0].length - VIEW_SIZE, playerPos.x - Math.floor(VIEW_SIZE / 2)));
        const startY = Math.max(0, Math.min(grid.length - VIEW_SIZE, playerPos.y - Math.floor(VIEW_SIZE / 2)));

        const miniGrid: string[][] = [];
        for (let y = startY; y < startY + VIEW_SIZE; y++) {
            const row = grid[y]?.slice(startX, startX + VIEW_SIZE) || [];
            miniGrid.push([...row]);
        }

        loot.forEach(l => {
            if (l.pos.y >= startY && l.pos.y < startY + VIEW_SIZE && l.pos.x >= startX && l.pos.x < startX + VIEW_SIZE) {
                miniGrid[l.pos.y - startY][l.pos.x - startX] = '$';
            }
        });

        enemies.forEach(e => {
            if (e.pos.y >= startY && e.pos.y < startY + VIEW_SIZE && e.pos.x >= startX && e.pos.x < startX + VIEW_SIZE) {
                miniGrid[e.pos.y - startY][e.pos.x - startX] = e.type;
            }
        });

        if (playerPos.y >= startY && playerPos.y < startY + VIEW_SIZE && playerPos.x >= startX && playerPos.x < startX + VIEW_SIZE) {
            miniGrid[playerPos.y - startY][playerPos.x - startX] = isAutoPlaying ? 'P' : '@';
        }

        return miniGrid.map(row => row.join('')).join('\n');
    };

    return (
        <div 
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: '185px',
                backgroundColor: 'rgba(5, 8, 10, 0.95)',
                border: '1px solid var(--color-accent)',
                boxShadow: '0 0 20px rgba(56, 163, 160, 0.2)',
                zIndex: 9999,
                padding: '0.8rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 0.8 : 1,
                transition: isDragging ? 'none' : 'opacity 0.3s ease'
            }}
            onMouseDown={onMouseDown}
            onClick={() => {
                if (!isDragging) navigate('/dungeon');
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-accent)', paddingBottom: '0.3rem', marginBottom: '0.2rem' }}>
                <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>BREACH_PIN</span>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        togglePin(activeBreach.id);
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-primary-dim)', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}
                >
                    [X]
                </button>
            </div>

            <div style={{ position: 'relative', height: '50px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'visible' }}>
                <BirdMascot message={mascotMessage} size="small" />
            </div>

            <pre style={{ 
                margin: 0, 
                lineHeight: '1.1', 
                textAlign: 'center', 
                color: 'var(--color-primary)',
                letterSpacing: '1px'
            }}>
                {renderMiniMap()}
            </pre>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>SEC: {floor}</span>
                    <span style={{ color: hp < maxHp * 0.3 ? 'var(--color-alert)' : 'var(--color-primary)' }}>
                        HP: {hp}/{maxHp}
                    </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-accent)' }}>
                    <span>CU: {formatComputeUnits(computeUnits)}</span>
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--color-primary-dim)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    &gt; {logs[logs.length - 1]}
                </div>
            </div>

            <div style={{ 
                fontSize: '0.55rem', 
                textAlign: 'center', 
                color: 'var(--color-accent)', 
                marginTop: '0.2rem',
                animation: 'pulse 2s infinite'
            }}>
                {isAutoPlaying ? '[ AUTO-CRAWLING... ]' : '[ MANUAL_OVERRIDE ]'}
            </div>
            
            <style>{`
                @keyframes pulse {
                    0% { opacity: 0.5; }
                    50% { opacity: 1; }
                    100% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
};

export default PinnedDungeon;
