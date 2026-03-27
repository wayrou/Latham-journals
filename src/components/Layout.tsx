import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useGameState } from '../context/GameStateContext';
import { Volume2, VolumeX } from 'lucide-react';
import SystemAlertModal from './SystemAlertModal';
import { useSound } from '../hooks/useSound';

const Layout: React.FC = () => {
    const { archiveRestoration } = useGameState();
    const { isMuted, toggleMute } = useSound();
    const location = useLocation();


    const navLinks = [
        { name: 'INBOX', path: '/inbox' },
        { name: 'ARCHIVE', path: '/archive' },
        { name: 'TIMELINE', path: '/timeline' },
        { name: 'BREACH', path: '/dungeon' },
        { name: 'TERMINAL', path: '/terminal' },
    ];

    return (
        <div className="container" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: '0.7rem', color: 'var(--color-primary-dim)', pointerEvents: 'none', zIndex: 10 }}>ARCHIVE_V2_ACTIVE</div>

            <div style={{ position: 'absolute', top: 10, left: 10, fontSize: '0.7rem', color: 'var(--color-primary)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>ARCHIVE RESTORATION: {Math.floor(archiveRestoration)}%</div>
                <div style={{ width: '150px', height: '4px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-primary-dim)' }}>
                    <div style={{ width: `${Math.floor(archiveRestoration)}%`, height: '100%', backgroundColor: 'var(--color-primary)', transition: 'width 0.5s ease' }}></div>
                </div>
            </div>

            <header className="layout-header" style={{ marginTop: '3rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.25rem' }}>
                        <img src="/logo.png" alt="PGNOS" style={{
                            width: '42px',
                            height: '42px',
                            mixBlendMode: 'screen',
                        }} />
                        <span style={{ fontSize: '1.8rem', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--color-primary)', textShadow: '0 0 10px var(--color-primary-dim)' }}>
                            PGNOS
                        </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-alert)', fontWeight: 'bold' }}>
                        [SOLARIS_NODE_ACTIVE]
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
