import React, { useEffect, useMemo, useState } from 'react';

interface StartupSplashProps {
    onComplete: () => void;
}

const SPLASH_LINES = ['MR. PLANET', 'SOFTWARE PLANNING'] as const;
const MIN_SKIP_DELAY_MS = 900;
const AUTO_ADVANCE_MS = 2800;

const StartupSplash: React.FC<StartupSplashProps> = ({ onComplete }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [canSkip, setCanSkip] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const titleGlyphs = useMemo(() => SPLASH_LINES[0].split(''), []);

    useEffect(() => {
        const revealTimer = setTimeout(() => setIsVisible(true), 30);
        const skipTimer = setTimeout(() => setCanSkip(true), MIN_SKIP_DELAY_MS);
        const autoAdvanceTimer = setTimeout(() => {
            setIsClosing(true);
        }, AUTO_ADVANCE_MS);
        const finishTimer = setTimeout(() => {
            onComplete();
        }, AUTO_ADVANCE_MS + 320);

        const handleSkip = (event?: KeyboardEvent | MouseEvent) => {
            if (!canSkip) return;
            if (event instanceof KeyboardEvent) {
                const allowedKeys = ['Enter', ' ', 'Spacebar', 'Escape'];
                if (!allowedKeys.includes(event.key)) return;
            }
            setIsClosing(true);
            setTimeout(onComplete, 220);
        };

        window.addEventListener('keydown', handleSkip);
        window.addEventListener('mousedown', handleSkip);

        return () => {
            clearTimeout(revealTimer);
            clearTimeout(skipTimer);
            clearTimeout(autoAdvanceTimer);
            clearTimeout(finishTimer);
            window.removeEventListener('keydown', handleSkip);
            window.removeEventListener('mousedown', handleSkip);
        };
    }, [canSkip, onComplete]);

    return (
        <div
            style={{
                height: '100vh',
                width: '100vw',
                backgroundColor: '#050512',
                color: 'var(--color-primary)',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'absolute',
                inset: 0,
                zIndex: 10000,
                opacity: isClosing ? 0 : 1,
                transition: 'opacity 260ms ease'
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'radial-gradient(circle at 50% 34%, rgba(33, 230, 142, 0.08) 0%, rgba(33, 230, 142, 0.02) 10%, transparent 24%)',
                    opacity: isVisible ? 1 : 0,
                    transition: 'opacity 500ms ease'
                }}
            />

            <div
                style={{
                    position: 'relative',
                    zIndex: 2,
                    width: 'min(720px, 88vw)',
                    textAlign: 'center',
                    transform: isVisible && !isClosing ? 'translateY(0px)' : 'translateY(8px)',
                    transition: 'transform 420ms ease, opacity 420ms ease',
                    opacity: isVisible ? 1 : 0
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: '0.1em',
                        fontSize: 'clamp(2rem, 4vw, 4.1rem)',
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        lineHeight: 1.2,
                        color: '#2ce68e',
                        textShadow: '0 0 16px rgba(44, 230, 142, 0.22), 0 0 6px rgba(44, 230, 142, 0.26)'
                    }}
                >
                    {titleGlyphs.map((glyph, index) => (
                        <span
                            key={`${glyph}-${index}`}
                            style={{
                                whiteSpace: glyph === ' ' ? 'pre' : 'normal',
                                minWidth: glyph === ' ' ? '0.48em' : undefined,
                                opacity: isVisible ? 1 : 0,
                                transform: isVisible ? 'translateY(0px)' : 'translateY(6px)',
                                transition: `opacity 180ms ease ${index * 18}ms, transform 280ms ease ${index * 18}ms`,
                                color: glyph === ' ' ? 'transparent' : '#2ce68e'
                            }}
                        >
                            {glyph === ' ' ? '\u00A0' : glyph}
                        </span>
                    ))}
                </div>

                <div
                    style={{
                        marginTop: '1rem',
                        fontSize: 'clamp(0.8rem, 1.1vw, 1.15rem)',
                        letterSpacing: '0.22em',
                        color: 'rgba(73, 169, 132, 0.82)',
                        textShadow: '0 0 8px rgba(44, 230, 142, 0.08)',
                        opacity: isVisible ? 1 : 0,
                        transition: 'opacity 260ms ease 180ms'
                    }}
                >
                    {SPLASH_LINES[1]}
                </div>
            </div>
        </div>
    );
};

export default StartupSplash;
