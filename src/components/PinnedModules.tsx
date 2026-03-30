import React from 'react';
import { Cpu } from 'lucide-react';
import { OS_MODULE_DEFINITIONS, useGameState } from '../context/GameStateContext';
import { useDungeon } from '../context/DungeonContext';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

const PinnedModules: React.FC = () => {
    const {
        isModulesPinned,
        protocolTokens,
        osModules,
        getOSModuleCost,
        unlockOSModule,
        getMaxClaimCount,
        pinnedPositions,
        pinnedSizes,
        updatePinnedPosition,
        updatePinnedSize
    } = useGameState();
    const { claimedFloors } = useDungeon();

    const initialPos = pinnedPositions?.modules || { x: window.innerWidth - 390, y: 150 };
    const initialSize = pinnedSizes?.modules || { width: 360, height: 420 };
    const { pos, onMouseDown, isDragging } = useDraggable('modules', initialPos, updatePinnedPosition);
    const { size, isResizing, onResizeMouseDown } = useResizable('modules', initialSize, updatePinnedSize, { width: 320, height: 320 });

    if (!isModulesPinned) return null;

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
                    <Cpu size={14} />
                    OS_MODULES
                </div>
                <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                    TOK: {protocolTokens} | CLAIMS: {claimedFloors.length}/{getMaxClaimCount()}
                </div>
            </div>

            <div
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    overflowY: 'auto',
                    minHeight: 0
                }}
            >
                {OS_MODULE_DEFINITIONS.map(module => {
                    const level = osModules[module.id] || 0;
                    const isMaxed = level >= module.maxLevel;
                    const cost = getOSModuleCost(module.id);

                    return (
                        <div
                            key={module.id}
                            style={{
                                border: '1px solid rgba(56, 163, 160, 0.16)',
                                backgroundColor: 'rgba(56, 163, 160, 0.03)',
                                padding: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.74rem', color: 'var(--color-accent)' }}>
                                    {module.name}
                                </div>
                                <div style={{ fontSize: '0.66rem', color: 'var(--color-primary-dim)' }}>
                                    LV {level}/{module.maxLevel}
                                </div>
                            </div>

                            <div style={{ fontSize: '0.66rem', color: 'var(--color-primary-dim)', lineHeight: 1.45 }}>
                                {module.description}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.64rem', color: 'var(--color-primary-dim)' }}>
                                    {isMaxed ? 'MAX INSTALLED' : `NEXT COST: ${cost} TOK`}
                                </div>
                                <button
                                    type="button"
                                    disabled={isMaxed || protocolTokens < cost}
                                    onClick={() => unlockOSModule(module.id)}
                                    style={{
                                        padding: '0.25rem 0.5rem',
                                        backgroundColor: 'transparent',
                                        color: isMaxed || protocolTokens < cost ? 'var(--color-primary-dim)' : 'var(--color-primary)',
                                        border: `1px solid ${isMaxed || protocolTokens < cost ? 'var(--color-primary-dim)' : 'var(--color-primary)'}`,
                                        cursor: isMaxed || protocolTokens < cost ? 'not-allowed' : 'pointer',
                                        fontFamily: 'inherit',
                                        fontSize: '0.68rem',
                                        opacity: isMaxed || protocolTokens < cost ? 0.6 : 1
                                    }}
                                >
                                    {isMaxed ? 'MAXED' : '[ UPGRADE ]'}
                                </button>
                            </div>
                        </div>
                    );
                })}
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
                title="Resize modules menu"
            >
                //
            </div>
        </div>
    );
};

export default PinnedModules;
