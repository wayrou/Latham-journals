import { useCallback, useEffect, useState } from 'react';

export type SoundType = 'click' | 'alert' | 'hum' | 'boot' | 'error' | 'success';

let sharedAudioCtx: AudioContext | null = null;
let sharedMuted = (() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('prgn_os_muted') === 'true';
})();
const muteListeners = new Set<(value: boolean) => void>();

export const useSound = () => {
    const [isMuted, setIsMuted] = useState(sharedMuted);

    useEffect(() => {
        muteListeners.add(setIsMuted);
        return () => {
            muteListeners.delete(setIsMuted);
        };
    }, []);

    const initCtx = () => {
        if (!sharedAudioCtx) {
            sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (sharedAudioCtx.state === 'suspended') {
            sharedAudioCtx.resume();
        }
    };

    const toggleMute = () => {
        sharedMuted = !sharedMuted;
        localStorage.setItem('prgn_os_muted', String(sharedMuted));
        muteListeners.forEach(listener => listener(sharedMuted));

        if (sharedAudioCtx) {
            if (sharedMuted) {
                sharedAudioCtx.suspend();
            } else if (sharedAudioCtx.state === 'suspended') {
                sharedAudioCtx.resume();
            }
        }
    };

    const playSound = useCallback((type: SoundType) => {
        if (sharedMuted) return;
        initCtx();
        const ctx = sharedAudioCtx!;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        switch (type) {
            case 'click':
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);
                gain.gain.setValueAtTime(0.02, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
                break;
            case 'alert':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.setValueAtTime(440, now + 0.1);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            case 'error':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(110, now);
                osc.frequency.exponentialRampToValueAtTime(55, now + 0.2);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'success':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'boot':
                // Low rumble sweep
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(40, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 2);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.03, now + 0.5);
                gain.gain.linearRampToValueAtTime(0, now + 2);
                osc.start(now);
                osc.stop(now + 2);
                break;
        }
    }, []);

    return { playSound, isMuted, toggleMute };
};
