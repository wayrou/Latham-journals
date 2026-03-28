import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useGameState } from '../context/GameStateContext';
import { Volume2, VolumeX } from 'lucide-react';
import SystemAlertModal from './SystemAlertModal';
import PinnedDungeon from './PinnedDungeon';
import PinnedAgents from './PinnedAgents';
import PinnedWallets from './PinnedWallets';
import PinnedMetaMap from './PinnedMetaMap';
import PinnedTerminal from './PinnedTerminal';
import { useSound } from '../hooks/useSound';

const Layout: React.FC = () => {
    const { archiveRestoration, systemClutter, activeBrickedNode } = useGameState();
    const { isMuted, toggleMute } = useSound();
    const location = useLocation();


    const navLinks = [
        { name: 'INBOX', path: '/inbox' },
        { name: 'ARCHIVE', path: '/archive' },
        { name: 'BREACH', path: '/dungeon' },
        { name: 'TERMINAL', path: '/terminal' },
    ];

    return (
        <div className="container" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-primary-dim)', pointerEvents: 'none' }}>ARCHIVE_V2_ACTIVE</div>
                
                {/* Global System Clutter Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span style={{ fontSize: '0.7rem', opacity: 0.6, color: 'var(--color-primary)' }}>SYS_CLUTTER:</span>
                    <div style={{ width: '120px', height: '8px', border: '1px solid var(--color-primary-dim)', position: 'relative', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                        <div style={{ 
                            width: `${systemClutter}%`, 
                            height: '100%', 
                            backgroundColor: systemClutter > 70 ? 'var(--color-alert)' : 'var(--color-accent)',
                            transition: 'width 1s linear'
                        }} />
                    </div>
                    <span style={{ fontSize: '0.7rem', minWidth: '35px', textAlign: 'right', color: systemClutter > 70 ? 'var(--color-alert)' : 'var(--color-accent)' }}>
                        {systemClutter.toFixed(1)}%
                    </span>
                </div>

                {/* Global Bricked Notification */}
                {activeBrickedNode && (
                    <div style={{ 
                        color: 'var(--color-alert)', 
                        fontSize: '0.7rem', 
                        animation: 'blink 1.5s infinite', 
                        border: '1px solid var(--color-alert)', 
                        padding: '2px 8px',
                        backgroundColor: 'rgba(255, 0, 0, 0.05)',
                        fontWeight: 'bold'
                    }}>
                        [!] BRICKED NODE DETECTED: RUN 'bricked'
                    </div>
                )}
            </div>
            <PinnedDungeon />
            <PinnedAgents />
            <PinnedWallets />
            <PinnedMetaMap />
            <PinnedTerminal />

            <div style={{ position: 'absolute', top: 10, left: 10, fontSize: '0.7rem', color: 'var(--color-primary)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>ARCHIVE RESTORATION: {Math.floor(archiveRestoration)}%</div>
                <div style={{ width: '150px', height: '4px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-primary-dim)' }}>
                    <div style={{ width: `${Math.floor(archiveRestoration)}%`, height: '100%', backgroundColor: 'var(--color-primary)', transition: 'width 0.5s ease' }}></div>
                </div>
            </div>

            <header className="layout-header" style={{ marginTop: '3rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.25rem' }}>
                        <img src="/logo.png" alt="PRGN_OS" style={{
                            width: '42px',
                            height: '42px',
                            mixBlendMode: 'screen',
                        }} />
                        <span style={{ fontSize: '1.8rem', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--color-primary)', textShadow: '0 0 10px var(--color-primary-dim)' }}>
                            PRGN_OS
                        </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-alert)', fontWeight: 'bold' }}>
                        [USER_3939]
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>

                    <button
                        onClick={toggleMute}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-primary-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem' }}
                    >
                        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        {isMuted ? '[ AUDIO_OFF ]' : '[ AUDIO_ON ]'}
                    </button>

                    <nav className="nav-links">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                style={{
                                    textDecoration: location.pathname === link.path ? 'underline' : 'none',
                                    color: location.pathname === link.path ? 'var(--color-accent)' : 'var(--color-primary)',
                                    fontWeight: location.pathname === link.path ? 'bold' : 'normal'
                                }}
                            >
                                [{link.name}]
                            </Link>
                        ))}
                    </nav>
                </div>
            </header>

            <main>
                <Outlet />
            </main>

            <SystemAlertModal />

            <footer style={{ marginTop: '4rem', paddingTop: '1rem', borderTop: '1px dashed var(--color-primary-dim)', fontSize: '0.8rem', textAlign: 'center', opacity: 0.7 }}>
                <p>Peregrine Archival Recovery Project &copy; 3555</p>
                <p>WARNING: UNAUTHORIZED ACCESS ATTEMPTS ARE LOGGED</p>
            </footer>
        </div>
    );
};

export default Layout;
