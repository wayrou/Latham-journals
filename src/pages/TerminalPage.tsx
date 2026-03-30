import React, { useState } from 'react';
import TerminalApp from '../components/TerminalApp';
import BirdMascot from '../components/BirdMascot';
import { useGameState } from '../context/GameStateContext';
import { formatComputeUnits } from '../utils/numberFormat';

const TerminalPage: React.FC = () => {
    const { computeUnits, addComputeUnits } = useGameState();
    const [birdSquawk, setBirdSquawk] = useState(false);

    const handleBirdClick = () => {
        addComputeUnits(0.25);
        setBirdSquawk(true);
        setTimeout(() => setBirdSquawk(false), 500);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ marginBottom: '0.5rem' }}>Node Interface</h2>
                    <p style={{ opacity: 0.6, fontSize: '0.8rem', marginTop: 0 }}>
                        Awaiting input. Type &apos;help&apos; for available commands.
                    </p>
                </div>
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ color: 'var(--color-accent)', fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>
                        {formatComputeUnits(computeUnits)} CU
                    </div>
                    <BirdMascot message={birdSquawk ? "SQUAWK!" : null} onClick={handleBirdClick} />
                </div>
            </div>

            <div style={{
                backgroundColor: '#000',
                border: '1px solid var(--color-primary)',
                height: '65vh',
                minHeight: '400px',
                boxShadow: '0 0 15px rgba(56, 163, 160, 0.1)',
                position: 'relative'
            }}>
                <TerminalApp />
            </div>
        </div>
    );
};

export default TerminalPage;
