import React from 'react';
import { useGameState } from '../context/GameStateContext';
import { storyData } from '../data/story';
import { FileText, Lock } from 'lucide-react';

const Archive: React.FC = () => {
    const { unlockedFiles } = useGameState();

    return (
        <div>
            <h2>Document Archive</h2>
            <p style={{ opacity: 0.8, marginBottom: '2rem' }}>
                Total Files: {storyData.length}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {storyData.map((doc) => {
                    const isUnlocked = doc.unlockedByDefault || unlockedFiles.includes(doc.id);

                    let icon = <FileText size={20} />;
                    if (!isUnlocked) {
                        if (doc.type === 'locked') icon = <Lock size={20} style={{ color: 'var(--color-alert)' }} />;
                        if (doc.type === 'cipher') icon = <Lock size={20} style={{ color: 'var(--color-primary)' }} />;
                    }

                    return (
                        <div
                            key={doc.id}
                            style={{
                                border: `1px solid ${isUnlocked ? 'var(--color-primary)' : 'var(--color-primary-dim)'}`,
                                padding: '1rem',
                                backgroundColor: isUnlocked ? 'rgba(56, 163, 160, 0.05)' : 'transparent',
                                opacity: isUnlocked ? 1 : 0.6
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--color-primary-dim)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                                {icon}
                                <strong style={{ fontFamily: 'var(--font-mono)' }}>{doc.name}</strong>
                            </div>
                            <div style={{ fontSize: '0.85rem' }}>
                                <strong>Status:</strong> {isUnlocked ? 'CLEARED' : 'ENCRYPTED'}
                                <br />
                                {isUnlocked ? (
                                    <span style={{ color: 'var(--color-primary)' }}>AVAILABLE IN TERMINAL</span>
                                ) : (
                                    <span style={{ color: 'var(--color-alert)' }}>ACCESS RESTRICTED</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Archive;
