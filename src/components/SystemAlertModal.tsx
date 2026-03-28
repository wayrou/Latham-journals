import { useGameState } from '../context/GameStateContext';
import { useSound } from '../hooks/useSound';
import { useEffect, useState } from 'react';

const AUTO_DISMISS_MS = 5000;

const SystemAlertModal: React.FC = () => {
    const { activeAlert, dismissAlert } = useGameState();
    const { playSound } = useSound();
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (activeAlert) {
            playSound('alert');
            setProgress(100);

            const startTime = Date.now();
            const interval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
                setProgress(remaining);

                if (elapsed >= AUTO_DISMISS_MS) {
                    dismissAlert();
                    clearInterval(interval);
                }
            }, 50);

            return () => clearInterval(interval);
        }
    }, [activeAlert, playSound, dismissAlert]);

    if (!activeAlert) return null;

    const getColor = (type: string) => {
        switch (type) {
            case 'warning': return '#ffaa00';
            case 'critical': return 'var(--color-alert)';
            case 'info':
            default: return 'var(--color-accent)';
        }
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '320px',
            backgroundColor: 'var(--color-bg)',
            border: `2px solid ${getColor(activeAlert.type)}`,
            boxShadow: `0 0 15px ${getColor(activeAlert.type)}55`,
            zIndex: 10000,
            fontFamily: 'var(--font-mono)',
            animation: 'slideIn 0.3s ease-out',
            overflow: 'hidden'
        }}>
            <style>
                {`
                @keyframes slideIn {
                    from { transform: translateX(110%); }
                    to { transform: translateX(0); }
                }
                @keyframes blinkBorder {
                    0% { border-color: ${getColor(activeAlert.type)}; }
                    50% { border-color: transparent; }
                    100% { border-color: ${getColor(activeAlert.type)}; }
                }
                `}
            </style>

            <div style={{
                backgroundColor: getColor(activeAlert.type),
                color: 'var(--color-bg)',
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span>{activeAlert.title}</span>
                <span className="flicker">!</span>
            </div>

            <div style={{ padding: '1rem', color: 'var(--color-text)', fontSize: '0.9rem' }}>
                <p style={{ margin: 0 }}>{activeAlert.message}</p>
                <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                    <button
                        onClick={dismissAlert}
                        style={{
                            background: 'transparent',
                            border: `1px solid ${getColor(activeAlert.type)}`,
                            color: getColor(activeAlert.type),
                            padding: '0.3rem 0.6rem',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = getColor(activeAlert.type);
                            e.currentTarget.style.color = 'var(--color-bg)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = getColor(activeAlert.type);
                        }}
                    >
                        [ ACKNOWLEDGE ]
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div style={{
                height: '4px',
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                position: 'relative'
            }}>
                <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    backgroundColor: getColor(activeAlert.type),
                    transition: 'width 0.05s linear'
                }} />
            </div>
        </div>
    );
};

export default SystemAlertModal;
