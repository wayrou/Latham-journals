import React from 'react';
import { useGameState } from '../context/GameStateContext';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';
import BreachCliPanel from './BreachCliPanel';

const PinnedBreachCli: React.FC = () => {
    const { isBreachCliPinned, pinnedPositions, pinnedSizes, updatePinnedPosition, updatePinnedSize } = useGameState();

    const initialPos = pinnedPositions?.breachCli || { x: window.innerWidth - 470, y: 320 };
    const initialSize = pinnedSizes?.breachCli || { width: 440, height: 240 };
    const { pos, onMouseDown, isDragging } = useDraggable('breachCli', initialPos, updatePinnedPosition);
    const { size, isResizing, onResizeMouseDown } = useResizable('breachCli', initialSize, updatePinnedSize, { width: 340, height: 190 });

    if (!isBreachCliPinned) return null;

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
                <div>BREACH_CLI</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                    FLEET COMMANDS
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <BreachCliPanel variant="pin" />
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
                title="Resize breach CLI"
            >
                //
            </div>
        </div>
    );
};

export default PinnedBreachCli;
