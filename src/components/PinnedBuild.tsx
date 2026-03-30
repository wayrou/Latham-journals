import React, { useEffect, useState } from 'react';
import { Hammer } from 'lucide-react';
import { useGameState } from '../context/GameStateContext';
import { useDungeon, type FloorInfrastructureType } from '../context/DungeonContext';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';
import { formatComputeUnits } from '../utils/numberFormat';

const BUILDABLE_TYPES: FloorInfrastructureType[] = ['mining-rig', 'relay-uplink', 'scanner-tower'];

const labelForType = (type: FloorInfrastructureType) => type.toUpperCase();

const descriptionForType: Record<FloorInfrastructureType, string> = {
    'mining-rig': 'Passive CU output every few seconds.',
    'relay-uplink': 'Gives auto-crawlers extra movement passes on this floor.',
    'scanner-tower': 'Reveals undiscovered rooms on this floor over time.',
    'repair-dock': '',
    'quarantine-node': '',
    'dispatch-beacon': ''
};

const PinnedBuild: React.FC = () => {
    const { isBuildPinned, pinnedPositions, pinnedSizes, updatePinnedPosition, updatePinnedSize, protocolTokens, getMaxClaimCount } = useGameState();
    const { availableFloors, claimedFloors, getFloorProgress, getClaimCost, getInfrastructureCost, getClaimedFloor, isFloorClaimed, claimFloor, buildInfrastructure } = useDungeon();

    const initialPos = pinnedPositions?.build || { x: window.innerWidth - 360, y: 180 };
    const initialSize = pinnedSizes?.build || { width: 340, height: 420 };
    const { pos, onMouseDown, isDragging } = useDraggable('build', initialPos, updatePinnedPosition);
    const { size, isResizing, onResizeMouseDown } = useResizable('build', initialSize, updatePinnedSize, { width: 300, height: 320 });
    const [viewFloor, setViewFloor] = useState(availableFloors[0] ?? 1);

    useEffect(() => {
        if (!availableFloors.includes(viewFloor)) {
            setViewFloor(availableFloors[0] ?? 1);
        }
    }, [availableFloors, viewFloor]);

    if (!isBuildPinned) return null;

    const floor = viewFloor;
    const progress = getFloorProgress(floor);
    const claimed = getClaimedFloor(floor);
    const claimCost = getClaimCost(floor);

    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                backgroundColor: 'rgba(0, 5, 10, 0.88)',
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
                    <Hammer size={14} />
                    BUILD_MENU
                </div>
                <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                    TOK: {protocolTokens} | CLAIMS: {claimedFloors.length}/{getMaxClaimCount()}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {availableFloors.map(item => (
                    <button
                        key={item}
                        onClick={(e) => {
                            e.stopPropagation();
                            setViewFloor(item);
                        }}
                        style={{
                            padding: '5px 10px',
                            minWidth: '40px',
                            minHeight: '28px',
                            fontSize: '0.78rem',
                            fontWeight: 'bold',
                            border: '1px solid var(--color-primary-dim)',
                            backgroundColor: item === floor ? 'var(--color-accent)' : 'transparent',
                            color: item === floor ? 'var(--color-bg)' : 'var(--color-primary)',
                            cursor: 'pointer'
                        }}
                    >
                        F{item}
                    </button>
                ))}
            </div>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowY: 'auto',
                minHeight: 0
            }}>
                <div style={{ border: '1px solid rgba(56, 163, 160, 0.2)', padding: '8px', backgroundColor: 'rgba(56, 163, 160, 0.03)' }}>
                    <div style={{ color: 'var(--color-accent)', marginBottom: '6px', fontSize: '0.72rem' }}>
                        FLOOR {floor} STATUS
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-primary-dim)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>LOCKS OPEN: {progress.locksOpened.length}/3</div>
                        <div>CLAIM STATUS: {isFloorClaimed(floor) ? 'CLAIMED' : progress.locksOpened.length >= 3 ? 'CLAIMABLE' : 'LOCKED'}</div>
                        <div>INFRA SLOTS: {claimed?.infrastructure.length || 0}/4</div>
                        <div>CLAIM CAP: {claimedFloors.length}/{getMaxClaimCount()}</div>
                    </div>
                    {!isFloorClaimed(floor) && progress.locksOpened.length >= 3 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                claimFloor(floor);
                            }}
                            disabled={claimedFloors.length >= getMaxClaimCount()}
                            style={{
                                marginTop: '8px',
                                width: '100%',
                                padding: '6px 8px',
                                backgroundColor: 'transparent',
                                color: claimedFloors.length >= getMaxClaimCount() ? 'var(--color-primary-dim)' : 'var(--color-primary)',
                                border: `1px solid ${claimedFloors.length >= getMaxClaimCount() ? 'var(--color-primary-dim)' : 'var(--color-primary)'}`,
                                cursor: claimedFloors.length >= getMaxClaimCount() ? 'not-allowed' : 'pointer',
                                fontSize: '0.72rem'
                            }}
                        >
                            {claimedFloors.length >= getMaxClaimCount()
                                ? `[ CLAIM CAP REACHED ] ${claimedFloors.length}/${getMaxClaimCount()}`
                                : `[ CLAIM FLOOR ] ${formatComputeUnits(claimCost.cu)} CU / ${claimCost.tokens} TOK`}
                        </button>
                    )}
                </div>

                {isFloorClaimed(floor) && (
                    <>
                        <div style={{ border: '1px solid rgba(56, 163, 160, 0.2)', padding: '8px', backgroundColor: 'rgba(56, 163, 160, 0.03)' }}>
                            <div style={{ color: 'var(--color-accent)', marginBottom: '6px', fontSize: '0.72rem' }}>
                                ACTIVE INFRASTRUCTURE
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-primary-dim)' }}>
                                {claimed && claimed.infrastructure.length > 0
                                    ? claimed.infrastructure.map(item => `${labelForType(item.type)}@${item.roomX},${item.roomY}`).join(', ')
                                    : 'NONE'}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {BUILDABLE_TYPES.map(type => {
                                const cost = getInfrastructureCost(floor, type);
                                return (
                                    <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                buildInfrastructure(floor, type);
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '6px 8px',
                                                backgroundColor: 'transparent',
                                                color: type === 'mining-rig' ? 'var(--color-primary)' : 'var(--color-primary-dim)',
                                                border: `1px solid ${type === 'mining-rig' ? 'var(--color-primary)' : 'var(--color-primary-dim)'}`,
                                                cursor: 'pointer',
                                                fontSize: '0.72rem'
                                            }}
                                        >
                                            [ BUILD {labelForType(type)} ] {formatComputeUnits(cost.cu)} CU / {cost.tokens} TOK
                                        </button>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--color-primary-dim)' }}>
                                            {descriptionForType[type]}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
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
                title="Resize build menu"
            >
                //
            </div>
        </div>
    );
};

export default PinnedBuild;
