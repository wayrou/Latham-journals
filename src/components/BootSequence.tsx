import React, { useState, useEffect } from 'react';

interface BootSequenceProps {
    onComplete: () => void;
}

const BOOT_LOGS = [
    "INITIALIZING PRGN_OS CORE MODULES...",
    "LOADING VIRTUAL ENVIRONMENT...",
    "[OK] KERNEL v4.2.1 LOADED",
    "[OK] MOUNTING DRIVE /dev/sda1",
    "[OK] CHECKING DISK QUOTAS",
    "DECRYPTING SECTOR COMPUTE UNITS: 0x00A1F...",
    "WARNING: MULTIPLE CORRUPTED NODES DETECTED",
    "[OK] BYPASSING CORRUPTED CACHE",
    "ESTABLISHING HANDSHAKE WITH SOLARIS ARCHIVE...",
    "[OK] SECURE CONNECTION ESTABLISHED",
    "ALLOCATING MEMORY BLOCKS...",
    "MEMORY CHECK [====================] 100%",
    "RUNNING STARTUP DAEMONS...",
    "STARTING INTERFACE SERVICES...",
    "PRGN_OS TERMINAL READY."
];

const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
    const [lines, setLines] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let currentLine = 0;

        // Fast scrolling text effect
        const textInterval = setInterval(() => {
            if (currentLine < BOOT_LOGS.length) {
                setLines(prev => [...prev, BOOT_LOGS[currentLine]]);
                currentLine++;
            }
        }, 300);

        // Progress bar effect
        const progressInterval = setInterval(() => {
            setProgress(prev => {
                const next = prev + Math.floor(Math.random() * 15) + 5;
                if (next >= 100) {
                    clearInterval(progressInterval);
                    return 100;
                }
                return next;
            });
        }, 150);

        const handleKeyDown = () => {
            // Only allow skip if progress is at 100% OR if we want to allow skipping anyway
            // To ensure it never gets stuck, let's allow skipping after progress is 100
            setProgress(p => {
                if (p >= 100) {
                    onComplete();
                }
                return p;
            });
        };

        window.addEventListener('keydown', handleKeyDown);

        // Fail-safe: Always complete after 8 seconds
        const finishTimeout = setTimeout(() => {
            onComplete();
        }, 8000);

        return () => {
            clearInterval(textInterval);
            clearInterval(progressInterval);
            clearTimeout(finishTimeout);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onComplete]);

    // Generate # based progress bar
    const barWidth = 40;
    const filledWidth = Math.floor((progress / 100) * barWidth);
    const emptyWidth = barWidth - filledWidth;
    const progressBar = `[${'#'.repeat(filledWidth)}${'-'.repeat(emptyWidth)}] ${progress}%`;

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-mono)',
            padding: '2rem',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            overflow: 'hidden',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 9999
        }}>
            <div className="scanline" style={{ zIndex: 10 }}></div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', marginBottom: '2rem', zIndex: 5 }}>
                {lines.map((line, idx) => line ? (
                    <div key={idx} style={{
                        color: line.includes('WARNING') ? 'var(--color-alert)' :
                            line.includes('[OK]') ? 'var(--color-primary)' : 'var(--color-text)',
                        textShadow: '0 0 3px currentColor'
                    }}>
                        {line}
                    </div>
                ) : null)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 5 }}>
                <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>SYSTEM LOAD PROGRESS:</div>
                <div style={{ color: 'var(--color-primary)', letterSpacing: '2px', textShadow: '0 0 5px currentColor' }}>
                    {progressBar}
                </div>
                {progress === 100 && (
                    <div className="flicker" style={{ color: 'var(--color-text)', marginTop: '1rem' }}>
                        PRESS ANY KEY TO CONTINUE OR WAIT FOR AUTO-BOOT_
                    </div>
                )}
            </div>
        </div>
    );
};

export default BootSequence;
