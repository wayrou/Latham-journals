import React from 'react';
import { ScrollText } from 'lucide-react';
import { useGameState } from '../context/GameStateContext';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

const PinnedLedger: React.FC = () => {
    const { isLedgerPinned, opsLedger, pinnedPositions, pinnedSizes, updatePinnedPosition, updatePinnedSize } = useGameState();

    const initialPos = pinnedPositions?.ledger || { x: window.innerWidth - 430, y: 120 };
    const initialSize = pinnedSizes?.ledger || { width: 410, height: 320 };
    const { pos, onMouseDown, isDragging } = useDraggable('ledger', initialPos, updatePinnedPosition);
    const { size, isResizing, onResizeMouseDown } = useResizable('ledger', initialSize, updatePinnedSize, { width: 320, height: 220 });

    if (!isLedgerPinned) return null;

    const visibleEntries = [...opsLedger].slice(-18).reverse();

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
                    <ScrollText size={14} />
                    OPS_LEDGER
                </div>
                <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                    EVENTS: {opsLedger.length}
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
                {visibleEntries.length === 0 ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-primary-dim)', opacity: 0.8 }}>
                        No ledger events yet.
                    </div>
                ) : visibleEntries.map(entry => (
                    <div
                        key={entry.id}
                        style={{
                            border: '1px solid rgba(56, 163, 160, 0.16)',
                            backgroundColor: 'rgba(56, 163, 160, 0.03)',
                            padding: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.64rem', color: 'var(--color-primary-dim)' }}>
                            <span>{entry.type.toUpperCase()}</span>
                            <span>{formatTime(entry.timestamp)}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-primary)' }}>
                            {entry.message}
                        </div>
                        {(entry.floor !== undefined || entry.amountCU !== undefined || entry.amountTokens !== undefined) && (
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '0.64rem', color: 'var(--color-primary-dim)' }}>
                                {entry.floor !== undefined && <span>F{entry.floor}</span>}
                                {entry.amountCU !== undefined && <span>CU {entry.amountCU > 0 ? '+' : ''}{entry.amountCU}</span>}
                                {entry.amountTokens !== undefined && <span>TOK {entry.amountTokens > 0 ? '+' : ''}{entry.amountTokens}</span>}
                            </div>
                        )}
                    </div>
                ))}
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
                title="Resize ledger"
            >
                //
            </div>
        </div>
    );
};

export default PinnedLedger;
