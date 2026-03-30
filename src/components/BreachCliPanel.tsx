import React from 'react';
import { useBreachCli } from '../hooks/useBreachCli';

interface BreachCliPanelProps {
    variant?: 'page' | 'pin';
    isFullscreen?: boolean;
}

const BreachCliPanel: React.FC<BreachCliPanelProps> = ({ variant = 'page', isFullscreen = false }) => {
    const { history, inputVal, setInputVal, executeCommand, placeholder } = useBreachCli();
    const isPinnedVariant = variant === 'pin';
    const stopDragMouseDown = isPinnedVariant ? (e: React.MouseEvent) => e.stopPropagation() : undefined;

    return (
        <div
            onMouseDown={stopDragMouseDown}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
                minHeight: 0,
                height: isPinnedVariant ? '100%' : 'auto'
            }}
        >
            <div
                style={{
                    flex: isPinnedVariant ? 1 : '0 0 auto',
                    minHeight: isPinnedVariant ? 0 : 'unset',
                    maxHeight: isPinnedVariant ? 'none' : (isFullscreen ? '120px' : '88px'),
                    overflowY: 'auto',
                    border: '1px solid rgba(56, 163, 160, 0.15)',
                    padding: '0.5rem',
                    backgroundColor: '#05080a',
                    fontSize: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                }}
            >
                {history.map((line, index) => (
                    <div key={`${line}-${index}`} style={{ color: line.startsWith('>') ? 'var(--color-primary)' : 'var(--color-primary-dim)' }}>
                        {line}
                    </div>
                ))}
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    executeCommand();
                }}
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
                <span style={{ color: 'var(--color-accent)' }}>&gt;</span>
                <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder={placeholder}
                    style={{
                        flex: 1,
                        padding: '0.3rem 0.4rem',
                        backgroundColor: '#05080a',
                        color: 'var(--color-primary)',
                        border: '1px solid var(--color-primary-dim)',
                        fontFamily: 'var(--font-mono)'
                    }}
                />
                <button
                    type="submit"
                    style={{
                        padding: '0.3rem 0.7rem',
                        backgroundColor: 'transparent',
                        color: 'var(--color-accent)',
                        border: '1px solid var(--color-accent)',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    RUN
                </button>
            </form>
        </div>
    );
};

export default BreachCliPanel;
