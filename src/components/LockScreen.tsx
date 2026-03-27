import React, { useState } from 'react';
import { useGameState } from '../context/GameStateContext';
import { Lock } from 'lucide-react';

const LockScreen: React.FC = () => {
    const { unlockSystem } = useGameState();
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const success = unlockSystem(password);
        if (!success) {
            setError(true);
            setTimeout(() => setError(false), 2000); // clear error after 2s
            setPassword('');
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}>
            <div style={{ padding: '3rem', border: '1px solid var(--color-primary-dim)', backgroundColor: 'rgba(56, 163, 160, 0.05)', width: '300px', textAlign: 'center' }}>
                <Lock size={48} style={{ marginBottom: '1rem', color: error ? 'var(--color-alert)' : 'var(--color-primary)' }} />
                <h2 style={{ margin: '0 0 2rem 0', fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: 'var(--color-text)' }}>PRGN_OS SECURE BOOT</h2>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter Passcode..."
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                background: 'transparent',
                                border: '1px solid var(--color-primary)',
                                color: 'var(--color-primary)',
                                fontFamily: 'var(--font-mono)',
                                textAlign: 'center',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    {error && <div style={{ color: 'var(--color-alert)', fontSize: '0.8rem', marginBottom: '1rem' }}>ACCESS DENIED.</div>}
                    <button type="submit" style={{ width: '100%', letterSpacing: '2px' }}>AUTHORIZE</button>
                </form>
            </div>
            <div style={{ marginTop: '2rem', fontSize: '0.8rem', opacity: 0.5 }}>
                PEREGRINE OS v1.0.4 &copy; 3555
            </div>
        </div>
    );
};

export default LockScreen;
