import React from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { useSound } from '../hooks/useSound';

const TerminalApp: React.FC = () => {
    const { 
        history, inputVal, setInputVal, handleCommand, endRef, 
        hackingGame, hackingLogs, handleHacking 
    } = useTerminal();
    const { playSound } = useSound();

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

    const renderHackingGrid = () => {
        if (!hackingGame) return null;
        return (
            <div style={{ padding: '1rem', border: '1px solid var(--color-accent)', backgroundColor: 'rgba(56, 163, 160, 0.05)' }}>
                <div style={{ color: 'var(--color-accent)', marginBottom: '1rem', borderBottom: '1px solid var(--color-accent)' }}>
                    {hackingGame.attemptsRemaining} ATTEMPT(S) REMAINING
                </div>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <div style={{ flex: 1 }}>
                        {hackingGame.grid.map((row, y) => (
                            <div key={y} style={{ display: 'flex', gap: '8px', lineHeight: '1.2' }}>
                                <span style={{ opacity: 0.5, marginRight: '10px' }}>0x{y.toString(16).toUpperCase()}8F</span>
                                {row.map((char, x) => (
                                    <span key={x} style={{
                                        color: /[A-Z]/.test(char) ? 'var(--color-text)' : 'var(--color-primary-dim)',
                                        fontWeight: /[A-Z]/.test(char) ? 'bold' : 'normal'
                                    }}>
                                        {char}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                    <div style={{ width: '250px', fontSize: '0.8rem', color: 'var(--color-accent)' }}>
                        {hackingLogs.map((log, i) => (
                            <div key={i} style={{ marginBottom: '4px' }}>&gt; {log}</div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
                {hackingGame && renderHackingGrid()}
                {!hackingGame && history.map((entry, i) => (
                    <div key={i} style={{
                        marginBottom: '0.5rem',
                        color: entry.type === 'error' ? 'var(--color-alert)' :
                            entry.type === 'system' ? 'var(--color-accent)' :
                                entry.type === 'input' ? 'var(--color-text)' : 'var(--color-primary)'
                    }}>
                        {typeof entry.content === 'string' ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>{entry.content}</pre> : entry.content}
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            <form onSubmit={onSubmit} style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text)', marginRight: '0.5rem' }}>{'>'}</span>
                <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => {
                        setInputVal(e.target.value);
                        playSound('click');
                    }}
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1rem',
                        outline: 'none'
                    }}
                />
            </form>
        </div>
    );
};

export default TerminalApp;
