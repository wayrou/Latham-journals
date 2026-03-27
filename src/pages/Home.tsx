import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGameState } from '../context/GameStateContext';

const Home: React.FC = () => {
    const baseText = "SYSTEM BOOT SEQUENCE... ";
    const [typedText, setTypedText] = useState("");
    const [showOk, setShowOk] = useState(false);

    useEffect(() => {
        let typingInterval: ReturnType<typeof setInterval>;
        let resetTimeout: ReturnType<typeof setTimeout>;

        const startSequence = () => {
            setTypedText("");
            setShowOk(false);
            let currentIndex = 0;

            typingInterval = setInterval(() => {
                setTypedText(baseText.slice(0, currentIndex + 1));
                currentIndex++;

                if (currentIndex === baseText.length) {
                    clearInterval(typingInterval);
                    setShowOk(true);

                    // Restart after 5 seconds
                    resetTimeout = setTimeout(() => {
                        startSequence();
                    }, 5000);
                }
            }, 50);
        };

        startSequence();

        return () => {
            clearInterval(typingInterval);
            clearTimeout(resetTimeout);
        };
    }, []);

    const { archiveRestoration, clearanceLevel, activeJobs, completedJobs, compiledNodes } = useGameState();



    return (
        <div style={{ position: 'relative' }}>
            <h2 style={{ borderLeft: '4px solid var(--color-accent)', paddingLeft: '1rem', minHeight: '1.2em', display: 'flex', alignItems: 'center' }}>
                {typedText}
                {showOk && <span className="flicker" style={{ marginLeft: '0.5rem', color: 'var(--color-primary)' }}>OK</span>}
                {!showOk && <span className="flicker">_</span>}
            </h2>

            <div style={{ marginTop: '2rem', border: '1px solid var(--color-primary-dim)', padding: '2rem', backgroundColor: 'rgba(56, 163, 160, 0.05)', position: 'relative' }}>



                {archiveRestoration === 0 ? (
                    <>
                        <p style={{ fontStyle: 'italic', color: 'var(--color-primary-dim)', width: '80%' }}>
                            [SYSTEM] WELCOME TO PGNOS SECURE TERMINAL.<br /><br />
                            NEW MESSAGES DETECTED IN INBOX.<br />
                            PLEASE REVIEW COMMUNICATIONS BEFORE PROCEEDING WITH RESTORATION OPERATIONS.
                        </p>
                    </>
                ) : (
                    <>
                        <h3 style={{ borderBottom: '1px solid var(--color-primary-dim)', paddingBottom: '0.5rem', marginBottom: '1rem', width: '80%' }}>
                            PGNOS ACTIVE SESSION REPORT
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontFamily: 'var(--font-mono)', width: '80%' }}>
                            <div>
                                <div style={{ color: 'var(--color-primary-dim)' }}>GLOBAL RESTORATION</div>
                                <div style={{ fontSize: '1.5rem', color: 'var(--color-accent)' }}>{Math.floor(archiveRestoration)}%</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--color-primary-dim)' }}>CURRENT CLEARANCE</div>
                                <div style={{ fontSize: '1.5rem', color: 'var(--color-text)' }}>LEVEL {clearanceLevel}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--color-primary-dim)' }}>BACKGROUND JOBS</div>
                                <div>{activeJobs.length} Active / {completedJobs.length} Completed</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--color-primary-dim)' }}>NODES COMPILED</div>
                                <div style={{ color: compiledNodes.length > 0 ? 'var(--color-accent)' : 'var(--color-text)' }}>
                                    {compiledNodes.length > 0 ? compiledNodes.length : 'NONE'}
                                </div>
                            </div>
                        </div>
                        <p style={{ marginTop: '2rem', fontStyle: 'italic', opacity: 0.8 }}>
                            [SYSTEM] Resume operations. Avoid unauthorized narrative decryption.
                        </p>
                    </>
                )}

                <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem' }}>
                    <Link to="/terminal">
                        <button>ACCESS TERMINAL</button>
                    </Link>
                    <Link to="/archive">
                        <button style={{ borderColor: 'var(--color-primary-dim)', color: 'var(--color-text)' }}>VIEW ARCHIVE</button>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Home;
