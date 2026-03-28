import React from 'react';
import { useGameState } from '../context/GameStateContext';
import { useDungeon } from '../context/DungeonContext';
import { Map } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

const PinnedMetaMap: React.FC = () => {
    const { isMetaMapPinned, pinnedPositions, updatePinnedPosition } = useGameState();
    const { metaMap, breaches } = useDungeon();

    const initialPos = pinnedPositions?.metamap || { x: window.innerWidth - 260, y: 100 };
    const { pos, onMouseDown, isDragging } = useDraggable('metamap', initialPos, updatePinnedPosition);

    if (!isMetaMapPinned || !metaMap) return null;

    return (
        <div 
            onMouseDown={onMouseDown}
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: '240px',
                backgroundColor: 'rgba(0, 5, 10, 0.85)',
                border: '1px solid var(--color-primary-dim)',
                padding: '12px',
                zIndex: 100,
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)',
                backdropFilter: 'blur(4px)',
                fontFamily: 'monospace',
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 0.8 : 1,
                transition: isDragging ? 'none' : 'opacity 0.3s ease'
            }}
        >
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                borderBottom: '1px solid var(--color-primary-dim)', 
                paddingBottom: '8px', 
                marginBottom: '10px',
                color: 'var(--color-accent)',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                letterSpacing: '1px'
            }}>
                <Map size={14} />
                SECTOR_METAMAP // LIVE
            </div>

            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(10, 1fr)', 
                gap: '2px',
                backgroundColor: 'rgba(0,0,0,0.2)',
                padding: '4px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
                {metaMap.flat().map((room, i) => {
                    const x = i % 10;
                    const y = Math.floor(i / 10);
                    const hasBreach = breaches.some(b => b.roomX === x && b.roomY === y);
                    
                    let backgroundColor = 'rgba(0, 255, 255, 0.03)';
                    let boxShadow = 'none';
                    let content = '';

                    if (hasBreach) {
                        backgroundColor = 'var(--color-accent)';
                        boxShadow = '0 0 8px var(--color-accent)';
                        content = '@';
                    } else if (room.isDiscovered) {
                        backgroundColor = room.isBoss ? 'var(--color-alert)' : 'rgba(0, 255, 255, 0.2)';
                        content = room.isBoss ? 'B' : (hasBreach ? '@' : '');
                        if (room.isBoss) boxShadow = '0 0 4px var(--color-alert)';
                    }

                    return (
                        <div key={`${x}-${y}`} style={{
                            aspectRatio: '1',
                            backgroundColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.6rem',
                            color: hasBreach || (room.isDiscovered && room.isBoss) ? '#000' : 'var(--color-primary)',
                            fontWeight: 'bold',
                            boxShadow,
                            transition: 'all 0.3s ease'
                        }}>
                            {content}
                        </div>
                    );
                })}
            </div>

            <div style={{ 
                marginTop: '10px', 
                fontSize: '0.6rem', 
                color: 'var(--color-primary-dim)', 
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>[@] BREACH</span>
                    <span>[B] BOSS</span>
                </div>
                <div style={{ textAlign: 'right', fontStyle: 'italic', marginTop: '2px', opacity: 0.7 }}>
                    -- RUN 'metamap --pin' TO HIDE --
                </div>
            </div>
        </div>
    );
};

export default PinnedMetaMap;
