import React from 'react';
import { useGameState } from '../context/GameStateContext';
import { useDungeon } from '../context/DungeonContext';
import { Map } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

const PinnedMetaMap: React.FC = () => {
    const { isMetaMapPinned, pinnedPositions, updatePinnedPosition } = useGameState();
    const { 
        metaMap, breaches, currentFloor, keysFound, locksOpened, roomMarkers, toggleMarker 
    } = useDungeon();

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
                transition: isDragging ? 'none' : 'opacity 0.3s ease',
                userSelect: 'none'
            }}
        >
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--color-primary-dim)', 
                paddingBottom: '8px', 
                marginBottom: '10px',
                color: 'var(--color-accent)',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                letterSpacing: '1px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Map size={14} />
                    METAMAP_F{currentFloor}
                </div>
                <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>
                    K:{keysFound.length}/3 L:{locksOpened.length}/3
                </div>
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
                    const marker = roomMarkers[`${x},${y}`];
                    
                    let backgroundColor = 'rgba(0, 255, 255, 0.03)';
                    let boxShadow = 'none';
                    let content: React.ReactNode = '';
                    let color = 'var(--color-primary)';

                    if (hasBreach) {
                        backgroundColor = 'var(--color-accent)';
                        boxShadow = '0 0 8px var(--color-accent)';
                        content = '@';
                        color = '#000';
                    } else if (room.isDiscovered) {
                        if (room.isBoss) {
                            backgroundColor = room.isCleared ? 'rgba(255, 75, 75, 0.2)' : 'var(--color-alert)';
                            if (!room.isCleared) boxShadow = '0 0 6px var(--color-alert)';
                            content = 'B';
                            color = '#000';
                        } else if (room.specialType) {
                            if (room.specialType.startsWith('K')) {
                                const found = keysFound.includes(room.specialType);
                                backgroundColor = found ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 215, 0, 0.4)';
                                content = room.specialType;
                                color = found ? 'var(--color-primary-dim)' : '#ffd700';
                            } else if (room.specialType.startsWith('L')) {
                                const opened = locksOpened.includes(room.specialType);
                                backgroundColor = opened ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.2)';
                                content = room.specialType;
                                color = opened ? '#00ff00' : '#ff0000';
                            } else if (room.specialType === 'mining_boost') {
                                backgroundColor = 'rgba(255, 0, 255, 0.15)';
                                content = 'M';
                                color = '#ff00ff';
                            }
                        } else {
                            backgroundColor = room.isCleared ? 'rgba(0, 255, 255, 0.08)' : 'rgba(0, 255, 255, 0.25)';
                        }
                    }

                    return (
                        <div 
                            key={`${x}-${y}`} 
                            onMouseDown={(e) => { e.stopPropagation(); toggleMarker(x, y); }}
                            style={{
                                aspectRatio: '1',
                                backgroundColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.6rem',
                                color,
                                fontWeight: 'bold',
                                boxShadow,
                                transition: 'all 0.3s ease',
                                cursor: 'pointer',
                                position: 'relative'
                            }}
                            title={`Sector ${x},${y}${marker ? `: ${marker}` : ''}`}
                        >
                            {content}
                            {marker && (
                                <div style={{
                                    position: 'absolute',
                                    top: '-2px',
                                    right: '-2px',
                                    width: '4px',
                                    height: '4px',
                                    backgroundColor: 'var(--color-accent)',
                                    borderRadius: '50%',
                                    boxShadow: '0 0 4px var(--color-accent)'
                                }} />
                            )}
                        </div>
                    );
                })}
            </div>

            <div style={{ 
                marginTop: '10px', 
                fontSize: '0.55rem', 
                color: 'var(--color-primary-dim)', 
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
            }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <span>[@] BREACH</span>
                    <span>[B] BOSS</span>
                    <span>[K] KEY</span>
                    <span>[L] LOCK</span>
                    <span>[M] BOOST</span>
                </div>
                <div style={{ textAlign: 'right', fontStyle: 'italic', marginTop: '4px', opacity: 0.7 }}>
                    -- CLICK ROOM TO MARK --
                </div>
            </div>
        </div>
    );
};

export default PinnedMetaMap;
