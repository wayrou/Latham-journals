import React from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { useGameState } from '../context/GameStateContext';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';
import { useSound } from '../hooks/useSound';
import { Terminal } from 'lucide-react';

const PinnedTerminal: React.FC = () => {
    const { 
        isTerminalPinned, pinnedPositions, pinnedSizes, updatePinnedPosition, updatePinnedSize 
    } = useGameState();
    
    const { 
        history, inputVal, setInputVal, handleCommand, endRef
    } = useTerminal();
    
    const { playSound } = useSound();

    const initialPos = pinnedPositions?.terminal || { x: 100, y: 100 };
    const initialSize = pinnedSizes?.terminal || { width: 400, height: 300 };
    const { pos, onMouseDown, isDragging } = useDraggable('terminal', initialPos, updatePinnedPosition);
    const { size, isResizing, onResizeMouseDown } = useResizable('terminal', initialSize, updatePinnedSize, { width: 320, height: 220 });

    if (!isTerminalPinned) return null;

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cmd = inputVal.trim();
        if (!cmd) return;
        handleCommand(cmd);
        setInputVal('');
    };

    return (
        <div 
            onMouseDown={onMouseDown}
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                backgroundColor: 'rgba(0, 5, 10, 0.9)',
                border: '1px solid var(--color-primary-dim)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1000,
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)',
                backdropFilter: 'blur(8px)',
                cursor: isDragging ? 'grabbing' : 'auto',
                opacity: isDragging ? 0.8 : 1
            }}
        >
            {/* Header / Drag Handle */}
            <div style={{
                padding: '6px 10px',
                backgroundColor: 'rgba(0, 255, 255, 0.1)',
                borderBottom: '1px solid var(--color-primary-dim)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.75rem',
                color: 'var(--color-primary)',
                fontWeight: 'bold',
                cursor: isDragging ? 'grabbing' : 'grab'
            }}>
                <Terminal size={14} />
                <span style={{ flex: 1 }}>SECURE_TERMINAL_V4_REMOTE</span>
            </div>

            {/* Content Area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-mono)',
                userSelect: 'text'
            }}>
                {history.map((entry, i) => {
                    if (entry.specialType === 'help') {
                         return (
                            <div key={i} style={{ marginBottom: '0.8rem', color: 'var(--color-primary)' }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{entry.content}</pre>
                            </div>
                        );
                    }
                    if (entry.specialType === 'ascii-grid') {
                         return (
                            <div key={i} style={{ marginBottom: '0.8rem', color: 'var(--color-text)' }}>
                                <pre style={{ margin: 0, lineHeight: '1', letterSpacing: '2px', fontFamily: 'inherit' }}>{entry.content}</pre>
                            </div>
                        );
                    }
                    return (
                        <div key={i} style={{
                            marginBottom: '4px',
                            color: entry.type === 'error' ? 'var(--color-alert)' :
                                entry.type === 'system' ? 'var(--color-accent)' :
                                    entry.type === 'input' ? 'var(--color-text)' : 'var(--color-primary)'
                        }}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                                {entry.type === 'input' ? `> ${entry.content}` : entry.content}
                            </pre>
                        </div>
                    );
                })}
                
                <div ref={endRef} />
            </div>

            {/* Input Line */}
            <form onSubmit={onSubmit} style={{
                padding: '8px 10px',
                borderTop: '1px solid rgba(0, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                <span style={{ color: 'var(--color-text)', fontSize: '0.85rem' }}>{'>'}</span>
                <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => {
                        setInputVal(e.target.value);
                        playSound('click');
                    }}
                    onMouseDown={(e) => e.stopPropagation()} // Allow selecting text/focusing
                    spellCheck={false}
                    autoComplete="off"
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem',
                        outline: 'none'
                    }}
                />
            </form>

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
                title="Resize terminal"
            >
                //
            </div>
        </div>
    );
};

export default PinnedTerminal;
