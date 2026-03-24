import React from 'react';
import TerminalApp from '../components/TerminalApp';

const TerminalPage: React.FC = () => {
    return (
        <div>
            <h2 style={{ marginBottom: '0.5rem' }}>Node Interface</h2>
            <p style={{ opacity: 0.6, fontSize: '0.8rem', marginTop: 0, marginBottom: '2rem' }}>
                Awaiting input. Type &apos;help&apos; for available commands.
            </p>

            <div style={{
                backgroundColor: '#000',
                border: '1px solid var(--color-primary)',
                height: '600px',
                boxShadow: '0 0 15px rgba(56, 163, 160, 0.1)',
                position: 'relative'
            }}>
                <TerminalApp />
            </div>
        </div>
    );
};

export default TerminalPage;
