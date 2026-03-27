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

    const birdIdle = `  //\\
 (o.o)         
(  _  )
-"-"-"-`;

    const birdBlinking = `  //\\
 (-.-)         
(  _  )
-"-"-"-`;

    const birdActive = `  //\\
 (>O<) *${message}*
(  _  )
-"-"-"-`;

    const currentMascot = message ? birdActive : (birdBlink ? birdBlinking : birdIdle);

    return (
        <div
            onClick={onClick}
            style={{
                cursor: onClick ? 'pointer' : 'default',
                whiteSpace: 'pre',
                fontFamily: 'var(--font-mono)',
                fontSize: size === 'small' ? '0.45rem' : undefined,
                lineHeight: size === 'small' ? '1.1' : '1.2',
                color: message ? 'var(--color-accent)' : 'var(--color-primary)',
                transition: 'color 0.2s',
                userSelect: 'none',
            }}
        >
            {currentMascot}
        </div>
    );
};

export default BirdMascot;
