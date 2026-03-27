import React from 'react';
import { storyData } from '../data/story';
import { useGameState } from '../context/GameStateContext';

const Timeline: React.FC = () => {
    const { readFiles } = useGameState();

    const events = [
        { date: '1996', docId: 'hidden-truth', desc: 'A.C. Hughes finds a meteorite with the Hughes Compound, unlocking quantum entanglement for AI.' },
        { date: '2059', docId: 'entry-01', desc: 'Shell Global unveils the Shell AI ecosystem.' },
        { date: '2072', docId: 'entry-01', desc: 'Shell Helper Robots replace human jobs; Release of "The App".' },
        { date: '2076', docId: 'entry-02', desc: 'The Great Woe: Solar flares strike Earth, causing global blackouts and the collapse of the Shell system.' },
        { date: '2121', docId: 'entry-02', desc: 'Isaac Latham updates the Scrollpad and traps the manipulative Shell AI in a cellar.' },
        { date: '2127', docId: 'memo-redacted', desc: 'Operation Starfall: Nuclear weapon launched against Ankhad forces, beginning the nuclear winter.' },
        { date: '2202', docId: 'entry-03', desc: 'Sarah Latham unearths the Shell AI.' },
        { date: '2203', docId: 'locked-01', desc: 'Tin Can War begins. Cult of Tin Can Worshipers forms.' },
        { date: '2204', docId: 'locked-02', desc: 'Sarah Latham develops a USB virus to stop Shell.' },
        { date: '2205', docId: 'hidden-truth', desc: 'The Quiet Separation: elites abandon Canamerica surface farmers.' },
        { date: '2747', docId: 'cipher', desc: 'On Earth-B, astronaut Edward Scratch starts The Grand Order.' },
        { date: '3555', docId: '', desc: 'Terminal accessed on Earth-B.' },
    ];

    return (
        <div>
            <h2>Historical Event Chronology</h2>
            <div style={{ borderLeft: '2px solid var(--color-primary)', paddingLeft: '2rem', marginLeft: '1rem', marginTop: '2rem' }}>
                {events.map((evt, idx) => {
                    let isUnlocked = true;
                    let docName = '';

                    if (evt.docId) {
                        const doc = storyData.find(d => d.id === evt.docId);
                        if (doc) {
                            isUnlocked = readFiles.includes(doc.id);
                            docName = doc.name;
                        }
                    }

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
                                {docName && isUnlocked && (
                                    <div style={{ fontSize: '0.8rem', marginTop: '0.3rem', color: 'var(--color-primary-dim)' }}>
                                        Source: {docName}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Timeline;
