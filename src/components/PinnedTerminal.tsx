import React from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { useGameState } from '../context/GameStateContext';
import { useDraggable } from '../hooks/useDraggable';
import { useSound } from '../hooks/useSound';
import { Terminal } from 'lucide-react';

const PinnedTerminal: React.FC = () => {
    const { 
        isTerminalPinned, pinnedPositions, updatePinnedPosition 
    } = useGameState();
    
    const { 
        history, inputVal, setInputVal, handleCommand, endRef,
        hackingGame, hackingLogs, handleHacking 
    } = useTerminal();
    
    const { playSound } = useSound();

    const initialPos = pinnedPositions?.terminal || { x: 100, y: 100 };
    const { pos, onMouseDown, isDragging } = useDraggable('terminal', initialPos, updatePinnedPosition);

    if (!isTerminalPinned) return null;

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cmd = inputVal.trim();
        if (!cmd) return;

        if (hackingGame) {
            handleHacking(cmd);
        } else {
            handleCommand(cmd);
        }
        setInputVal('');
    };

    return (
        <div 
            onMouseDown={onMouseDown}
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: '400px',
                height: '300px',
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
                <div style={{ display: 'flex', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff5f56' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#27c93f' }} />
                </div>
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
                {!hackingGame && history.map((entry, i) => (
                    <div key={i} style={{
                        marginBottom: '4px',
                        color: entry.type === 'error' ? 'var(--color-alert)' :
                            entry.type === 'system' ? 'var(--color-accent)' :
                                entry.type === 'input' ? 'var(--color-text)' : 'var(--color-primary)'
                    }}>
                        {typeof entry.content === 'string' ? 
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                                {entry.type === 'input' ? `> ${entry.content}` : entry.content}
                            </pre> 
                            : entry.content
                        }
                    </div>
                ))}
                
                {hackingGame && (
                    <div style={{ color: 'var(--color-accent)' }}>
                        <div>[HACK_MODE_ACTIVE]</div>
                        {hackingLogs.map((log, i) => (
                            <div key={i}>&gt; {log}</div>
                        ))}
                    </div>
                )}
                
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
        </div>
    );
};

export default PinnedTerminal;
