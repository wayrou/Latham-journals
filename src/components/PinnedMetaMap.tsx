import React, { useEffect, useState } from 'react';
import { useGameState } from '../context/GameStateContext';
import { useDungeon } from '../context/DungeonContext';
import { Map } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';
import type { FloorInfrastructure } from '../context/DungeonContext';

const getInfrastructureVisual = (type: FloorInfrastructure['type']) => {
    switch (type) {
        case 'mining-rig':
            return { label: 'R', backgroundColor: 'rgba(196, 138, 76, 0.35)', color: '#000', boxShadow: '0 0 6px rgba(196, 138, 76, 0.6)' };
        case 'relay-uplink':
            return { label: 'U', backgroundColor: 'rgba(56, 163, 160, 0.35)', color: '#000', boxShadow: '0 0 6px rgba(56, 163, 160, 0.45)' };
        case 'scanner-tower':
            return { label: 'S', backgroundColor: 'rgba(255, 255, 255, 0.25)', color: '#000', boxShadow: '0 0 6px rgba(255, 255, 255, 0.35)' };
        case 'repair-dock':
            return { label: 'D', backgroundColor: 'rgba(120, 210, 120, 0.28)', color: '#000', boxShadow: '0 0 6px rgba(120, 210, 120, 0.35)' };
        case 'quarantine-node':
            return { label: 'Q', backgroundColor: 'rgba(255, 90, 90, 0.25)', color: '#000', boxShadow: '0 0 6px rgba(255, 90, 90, 0.35)' };
        case 'dispatch-beacon':
            return { label: 'B', backgroundColor: 'rgba(255, 210, 80, 0.28)', color: '#000', boxShadow: '0 0 6px rgba(255, 210, 80, 0.35)' };
        case 'token-mint':
            return { label: 'T', backgroundColor: 'rgba(160, 120, 255, 0.3)', color: '#000', boxShadow: '0 0 6px rgba(160, 120, 255, 0.4)' };
        default:
            return { label: 'I', backgroundColor: 'rgba(0, 255, 255, 0.2)', color: '#000', boxShadow: 'none' };
    }
};

const getInfrastructureTooltip = (
    infrastructure: FloorInfrastructure,
    floor: number,
    sameTypeCount: number
) => {
    if (infrastructure.type === 'mining-rig') {
        const perRigOutput = 5 + floor * 2;
        return [
            `MINING-RIG // FLOOR ${floor}`,
            `Passive output: ${perRigOutput} CU per tick`,
            'Tick interval: 5s',
            `Floor total from rigs: ${perRigOutput * sameTypeCount} CU per tick`
        ].join('\n');
    }

    if (infrastructure.type === 'relay-uplink') {
        return [
            `RELAY-UPLINK // FLOOR ${floor}`,
            `Auto-crawler bonus: +${Math.min(2, sameTypeCount)} extra move pass${Math.min(2, sameTypeCount) === 1 ? '' : 'es'}`,
            'Applies to active auto-crawlers on this floor'
        ].join('\n');
    }

    if (infrastructure.type === 'scanner-tower') {
        return [
            `SCANNER-TOWER // FLOOR ${floor}`,
            `Reveal rate: ${sameTypeCount} room${sameTypeCount === 1 ? '' : 's'} per scan cycle`,
            'Scan interval: 4.5s',
            'Targets undiscovered rooms first'
        ].join('\n');
    }

    if (infrastructure.type === 'repair-dock') {
        return [
            `REPAIR-DOCK // FLOOR ${floor}`,
            'Restart hub for breached crawlers',
            `Passive repair: +${sameTypeCount * 4} HP every 4s`,
            'Restarts prefer the highest claimed dock floor'
        ].join('\n');
    }

    if (infrastructure.type === 'quarantine-node') {
        return [
            `QUARANTINE-NODE // FLOOR ${floor}`,
            `Containment sweep: -${(sameTypeCount * (0.8 + (floor * 0.05))).toFixed(1)} clutter per cycle`,
            'Acts globally while the floor remains claimed'
        ].join('\n');
    }

    if (infrastructure.type === 'token-mint') {
        return [
            `TOKEN-MINT // FLOOR ${floor}`,
            'Conversion rate: 10m CU -> 1 TOK',
            'Cycle interval: 15s',
            'Requires at least one QUARANTINE-NODE on the same floor'
        ].join('\n');
    }

    return [
        `DISPATCH-BEACON // FLOOR ${floor}`,
        'Redeploys and restarts land on beacon sectors first',
        'Makes claimed floors stronger as logistics hubs'
    ].join('\n');
};

const PinnedMetaMap: React.FC = () => {
    const { isMetaMapPinned, pinnedPositions, pinnedSizes, updatePinnedPosition, updatePinnedSize } = useGameState();
    const { 
        metaMap, breaches, currentFloor, keysFound, locksOpened, roomMarkers, toggleMarker, getMetaMapForFloor, getFloorProgress, getClaimedFloor, availableFloors, isFloorClaimed
    } = useDungeon();

    const initialPos = pinnedPositions?.metamap || { x: window.innerWidth - 260, y: 100 };
    const initialSize = pinnedSizes?.metamap || { width: 240, height: 420 };
    const { pos, onMouseDown, isDragging } = useDraggable('metamap', initialPos, updatePinnedPosition);
    const { size, isResizing, onResizeMouseDown } = useResizable('metamap', initialSize, updatePinnedSize, { width: 220, height: 320 });
    const [viewFloor, setViewFloor] = useState(currentFloor);

    useEffect(() => {
        if (!availableFloors.includes(viewFloor)) {
            setViewFloor(currentFloor);
        }
    }, [availableFloors, currentFloor, viewFloor]);

    const displayedFloor = availableFloors.includes(viewFloor) ? viewFloor : currentFloor;
    const displayedMap = displayedFloor === currentFloor ? metaMap : getMetaMapForFloor(displayedFloor);
    const displayedProgress = displayedFloor === currentFloor ? { keysFound, locksOpened } : getFloorProgress(displayedFloor);
    const displayedClaim = getClaimedFloor(displayedFloor);
    const uniqueKeysFound = [...new Set(displayedProgress.keysFound)];
    const uniqueLocksOpened = [...new Set(displayedProgress.locksOpened)];

    if (!isMetaMapPinned || !displayedMap) return null;

    return (
        <div 
            onMouseDown={onMouseDown}
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                backgroundColor: 'rgba(0, 5, 10, 0.85)',
                border: '1px solid var(--color-primary-dim)',
                padding: '12px',
                zIndex: 100,
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)',
                backdropFilter: 'blur(4px)',
                fontFamily: 'monospace',
                display: 'flex',
                flexDirection: 'column',
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
                    METAMAP_F{displayedFloor}
                </div>
                <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>
                    {isFloorClaimed(displayedFloor) ? 'CLAIMED | ' : ''}K:{Math.min(3, uniqueKeysFound.length)}/3 L:{Math.min(3, uniqueLocksOpened.length)}/3
                </div>
            </div>

            <div style={{
                display: 'flex',
                gap: '4px',
                flexWrap: 'wrap',
                marginBottom: '10px'
            }}>
                {availableFloors.map(floor => (
                    <button
                        key={floor}
                        onClick={(e) => {
                            e.stopPropagation();
                            setViewFloor(floor);
                        }}
                        style={{
                            padding: '2px 6px',
                            fontSize: '0.6rem',
                            border: '1px solid var(--color-primary-dim)',
                            backgroundColor: floor === displayedFloor ? 'var(--color-accent)' : 'transparent',
                            color: floor === displayedFloor ? 'var(--color-bg)' : 'var(--color-primary)',
                            cursor: 'pointer'
                        }}
                    >
                        F{floor}
                    </button>
                ))}
            </div>

            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(10, 1fr)', 
                gap: '2px',
                backgroundColor: 'rgba(0,0,0,0.2)',
                padding: '4px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                flex: '0 0 auto'
            }}>
                {displayedMap.flat().map((room, i) => {
                    const x = i % 10;
                    const y = Math.floor(i / 10);
                    const hasBreach = breaches.some(b => b.floor === displayedFloor && b.roomX === x && b.roomY === y);
                    const marker = roomMarkers[`${x},${y}`];
                    const infrastructure = displayedClaim?.infrastructure.find(item => item.roomX === x && item.roomY === y);
                    const sameTypeCount = infrastructure
                        ? displayedClaim?.infrastructure.filter(item => item.type === infrastructure.type).length ?? 0
                        : 0;
                    
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
                        if (infrastructure) {
                            const visual = getInfrastructureVisual(infrastructure.type);
                            backgroundColor = visual.backgroundColor;
                            content = visual.label;
                            color = visual.color;
                            boxShadow = visual.boxShadow;
                        } else 
                        if (room.isBoss) {
                            backgroundColor = room.isCleared ? 'rgba(255, 75, 75, 0.2)' : 'var(--color-alert)';
                            if (!room.isCleared) boxShadow = '0 0 6px var(--color-alert)';
                            content = 'B';
                            color = '#000';
                        } else if (room.specialType) {
                            if (room.specialType.startsWith('K')) {
                                const found = uniqueKeysFound.includes(room.specialType);
                                backgroundColor = found ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 215, 0, 0.4)';
                                content = room.specialType;
                                color = found ? 'var(--color-primary-dim)' : '#ffd700';
                            } else if (room.specialType.startsWith('L')) {
                                const opened = uniqueLocksOpened.includes(room.specialType);
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
                        (() => {
                            const baseTitle = `Sector ${x},${y}${marker ? ` // MARK: ${marker}` : ''}`;
                            const infrastructureTitle = infrastructure
                                ? `\n${getInfrastructureTooltip(infrastructure, displayedFloor, sameTypeCount)}`
                                : '';
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
                            title={`${baseTitle}${infrastructureTitle}`}
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
                        })()
                    );
                })}
            </div>

            <div style={{ 
                marginTop: '10px', 
                fontSize: '0.55rem', 
                color: 'var(--color-primary-dim)', 
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                overflowY: 'auto',
                minHeight: 0
            }}>
                <div style={{
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    paddingTop: '8px',
                    marginBottom: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px'
                }}>
                    <div style={{ color: 'var(--color-accent)', fontSize: '0.6rem', letterSpacing: '1px' }}>
                        CRAWLER FLOORS
                    </div>
                    {breaches.map(b => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ opacity: b.floor === displayedFloor ? 1 : 0.75 }}>
                                {b.callsign}
                            </span>
                            <span style={{ color: b.floor === displayedFloor ? 'var(--color-accent)' : 'var(--color-primary-dim)' }}>
                                F{b.floor}
                            </span>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <span>[@] BREACH</span>
                    <span>[B] BOSS</span>
                    <span>[K] KEY</span>
                    <span>[L] LOCK</span>
                    <span>[M] BOOST</span>
                    <span>[R] RIG</span>
                    <span>[U] UPLINK</span>
                    <span>[S] SCANNER</span>
                    <span>[D] DOCK</span>
                    <span>[Q] QUAR</span>
                    <span>[B] BEACON</span>
                </div>
                <div style={{ textAlign: 'right', fontStyle: 'italic', marginTop: '4px', opacity: 0.7 }}>
                    -- CLICK ROOM TO MARK --
                </div>
            </div>

            <div
                onMouseDown={onResizeMouseDown}
                style={{
                    position: 'absolute',
                    right: '4px',
                    bottom: '4px',
                    width: '14px',
                    height: '14px',
                    cursor: 'nwse-resize',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'flex-end',
                    color: isResizing ? 'var(--color-accent)' : 'var(--color-primary-dim)',
                    fontSize: '10px',
                    lineHeight: 1,
                    userSelect: 'none'
                }}
                title="Resize metamap"
            >
                //
            </div>
        </div>
    );
};

export default PinnedMetaMap;
