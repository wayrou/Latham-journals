import React from 'react';
import { storyData } from '../data/story';
import { useGameState } from '../context/GameStateContext';

const Timeline: React.FC = () => {
    const { unlockedFiles } = useGameState();

    // Simple hardcoded chronology based on our story data logic
    const events = [
        { date: '2094-03-12', docId: 'entry-01', desc: 'Routine System Audit. New security mandates implemented.' },
        { date: '2094-03-15', docId: 'entry-02', desc: 'Jenkins reassigned. Project Solaris stability concerns.' },
        { date: '2094-03-18', docId: 'entry-03', desc: 'Final preparations recorded by Isaac Latham.' },
        { date: 'UNKNOWN', docId: 'locked-01', desc: 'Containment breach in Sector 4.' },
        { date: 'UNKNOWN', docId: 'memo-redacted', desc: 'Critical phase entered. Evacuation ordered.' },
        { date: 'UNKNOWN', docId: 'locked-02', desc: 'Auxiliary relay activated by Latham.' },
        { date: 'FINAL', docId: 'hidden-truth', desc: 'Terminal destroyed. Bridge sealed.' },
    ];

    return (
        <div>
            <h2>Event Chronology</h2>
            <div style={{ borderLeft: '2px solid var(--color-primary)', paddingLeft: '2rem', marginLeft: '1rem', marginTop: '2rem' }}>
                {events.map((evt, idx) => {
                    const doc = storyData.find(d => d.id === evt.docId);
                    const isUnlocked = doc && (doc.unlockedByDefault || unlockedFiles.includes(doc.id));

                    return (
                        <div key={idx} style={{ position: 'relative', marginBottom: '2.5rem' }}>
                            <div style={{
                                position: 'absolute',
                                left: '-2.55rem',
                                top: 0,
                                width: '1rem',
                                height: '1rem',
                                backgroundColor: isUnlocked ? 'var(--color-primary)' : 'var(--color-bg)',
                                border: '2px solid var(--color-primary)',
                                borderRadius: '50%'
                            }} />

                            <div style={{ color: 'var(--color-accent)', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '0.2rem' }}>
                                {evt.date}
                            </div>
                            <div style={{ opacity: isUnlocked ? 1 : 0.4 }}>
                                {isUnlocked ? evt.desc : '[DATA MISSING OR CLASSIFIED]'}
                                <div style={{ fontSize: '0.8rem', marginTop: '0.3rem', color: 'var(--color-primary-dim)' }}>
                                    Source: {doc?.name}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Timeline;
