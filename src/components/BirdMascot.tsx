import React, { useState, useEffect } from 'react';

interface BirdMascotProps {
    message: string | null;
    onClick?: () => void;
    size?: 'small' | 'normal';
}

const BirdMascot: React.FC<BirdMascotProps> = ({ message, onClick, size = 'normal' }) => {
    const [birdBlink, setBirdBlink] = useState(false);

    useEffect(() => {
        const blinkInterval = setInterval(() => {
            setBirdBlink(true);
            setTimeout(() => setBirdBlink(false), 150);
        }, 3500); // Blink every 3.5 seconds

        return () => clearInterval(blinkInterval);
    }, []);

    const birdIdle = `  /\\  
 (o.o) 
(  _  )
-"-"-"-`;

    const birdBlinking = `  /\\  
 (-.-) 
(  _  )
-"-"-"-`;

    const birdActiveBody = `  /\\  
 (>O<) 
(  _  )
-"-"-"-`;

    const currentMascotBody = message ? birdActiveBody : (birdBlink ? birdBlinking : birdIdle);

    return (
        <div
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: onClick ? 'pointer' : 'default',
                fontFamily: 'var(--font-mono)',
                fontSize: size === 'small' ? '0.45rem' : undefined,
                lineHeight: size === 'small' ? '1.1' : '1.2',
                color: message ? 'var(--color-accent)' : 'var(--color-primary)',
                transition: 'color 0.2s',
                userSelect: 'none',
            }}
        >
            <div style={{ 
                whiteSpace: 'pre',
                lineHeight: 1,
                width: size === 'small' ? '40px' : '65px',
                textAlign: 'center',
                flexShrink: 0
            }}>{currentMascotBody}</div>
            {message && (
                <div style={{ 
                    fontStyle: 'italic', 
                    fontSize: size === 'small' ? '0.4rem' : '0.8rem',
                    opacity: 0.9,
                    animation: 'blink 1.5s infinite'
                }}>
                    *{message}*
                </div>
            )}
        </div>
    );
};

export default BirdMascot;
