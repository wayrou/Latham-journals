import React from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { useSound } from '../hooks/useSound';

const TerminalApp: React.FC = () => {
    const { history, inputVal, setInputVal, handleCommand, endRef } = useTerminal();
    const { playSound } = useSound();

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cmd = inputVal.trim();
        if (!cmd) return;
        handleCommand(cmd);
        setInputVal('');
    };

    return (
        <div style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
                {history.map((entry, i) => {
                    if (entry.specialType === 'help') {
                        return (
                            <div key={i} style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>{entry.content}</pre>
                            </div>
                        );
                    }
                    if (entry.specialType === 'ascii-grid') {
                        return (
                            <div key={i} style={{ marginBottom: '1rem', color: 'var(--color-text)' }}>
                                <pre style={{ margin: 0, lineHeight: '1', letterSpacing: '2px', fontFamily: 'var(--font-mono)' }}>{entry.content}</pre>
                            </div>
                        );
                    }
                    return (
                        <div key={i} style={{
                            marginBottom: '0.5rem',
                            color: entry.type === 'error' ? 'var(--color-alert)' :
                                entry.type === 'system' ? 'var(--color-accent)' :
                                    entry.type === 'input' ? 'var(--color-text)' : 'var(--color-primary)'
                        }}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                                {entry.type === 'input' ? `> ${entry.content}` : entry.content}
                            </pre>
                        </div>
                    );
                })}
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
