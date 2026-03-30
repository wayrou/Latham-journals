import React, { useMemo, useRef, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useGameState } from '../context/GameStateContext';
import { Volume2, VolumeX } from 'lucide-react';
import SystemAlertModal from './SystemAlertModal';
import PinnedDungeon from './PinnedDungeon';
import PinnedAgents from './PinnedAgents';
import PinnedWallets from './PinnedWallets';
import PinnedMetaMap from './PinnedMetaMap';
import PinnedDepartments from './PinnedDepartments';
import PinnedBuild from './PinnedBuild';
import PinnedBreachCli from './PinnedBreachCli';
import PinnedLedger from './PinnedLedger';
import PinnedModules from './PinnedModules';
import PinnedTerminal from './PinnedTerminal';
import PinnedInbox from './PinnedInbox';
import PinnedArchive from './PinnedArchive';
import { useSound } from '../hooks/useSound';

const Layout: React.FC = () => {
    const {
        archiveRestoration,
        systemClutter,
        activeBrickedNode,
        menuButtonOrder,
        setMenuButtonOrder,
        isMainContentMinimized,
        toggleMainContentMinimized,
        pinnedPositions,
        pinnedSizes,
        isAgentsPinned,
        isWalletsPinned,
        isMetaMapPinned,
        isDepartmentsPinned,
        isBuildPinned,
        isBreachCliPinned,
        isLedgerPinned,
        isModulesPinned,
        isTerminalPinned,
        isInboxPinned,
        isArchivePinned
    } = useGameState();
    const { isMuted, toggleMute } = useSound();
    const location = useLocation();
    const [draggingNav, setDraggingNav] = useState<string | null>(null);
    const navDidReorderRef = useRef(false);
    const lastNavReorderAtRef = useRef(0);

    const navLinks = [
        { name: 'INBOX', path: '/inbox' },
        { name: 'ARCHIVE', path: '/archive' },
        { name: 'BREACH', path: '/dungeon' },
        { name: 'TERMINAL', path: '/terminal' },
    ];

    const orderedNavLinks = useMemo(() => {
        const byName = new Map(navLinks.map(link => [link.name, link]));
        const ordered = menuButtonOrder
            .map(name => byName.get(name))
            .filter((link): link is { name: string; path: string } => !!link);
        const missing = navLinks.filter(link => !menuButtonOrder.includes(link.name));
        return [...ordered, ...missing];
    }, [menuButtonOrder]);

    const hasVisiblePinnedSurface = useMemo(() => {
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1400;
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
        const pinnedWindows = [
            { id: 'agents', enabled: isAgentsPinned },
            { id: 'wallets', enabled: isWalletsPinned },
            { id: 'metamap', enabled: isMetaMapPinned },
            { id: 'departments', enabled: isDepartmentsPinned },
            { id: 'build', enabled: isBuildPinned },
            { id: 'breachCli', enabled: isBreachCliPinned },
            { id: 'ledger', enabled: isLedgerPinned },
            { id: 'modules', enabled: isModulesPinned },
            { id: 'terminal', enabled: isTerminalPinned },
            { id: 'inbox', enabled: isInboxPinned },
            { id: 'archive', enabled: isArchivePinned }
        ];

        return pinnedWindows.some(windowEntry => {
            if (!windowEntry.enabled) return false;
            const position = pinnedPositions?.[windowEntry.id] || { x: 80, y: 80 };
            const size = pinnedSizes?.[windowEntry.id] || { width: 320, height: 240 };
            const right = position.x + size.width;
            const bottom = position.y + size.height;
            return right > 40 && bottom > 40 && position.x < viewportWidth - 40 && position.y < viewportHeight - 40;
        });
    }, [
        isAgentsPinned,
        isArchivePinned,
        isBreachCliPinned,
        isBuildPinned,
        isDepartmentsPinned,
        isInboxPinned,
        isLedgerPinned,
        isMainContentMinimized,
        isMetaMapPinned,
        isModulesPinned,
        isTerminalPinned,
        isWalletsPinned,
        pinnedPositions,
        pinnedSizes
    ]);

    const shouldShowMainContent = !isMainContentMinimized || !hasVisiblePinnedSurface;

    const moveNavButton = (fromName: string, toName: string) => {
        if (fromName === toName) return;

        const nextOrder = orderedNavLinks.map(link => link.name);
        const fromIndex = nextOrder.indexOf(fromName);
        const toIndex = nextOrder.indexOf(toName);
        if (fromIndex === -1 || toIndex === -1) return;

        const [moved] = nextOrder.splice(fromIndex, 1);
        nextOrder.splice(toIndex, 0, moved);
        setMenuButtonOrder(nextOrder);
    };

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
            <PinnedDepartments />
            <PinnedBuild />
            <PinnedBreachCli />
            <PinnedLedger />
            <PinnedModules />
            <PinnedTerminal />
            <PinnedInbox />
            <PinnedArchive />

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

                    <button
                        onClick={toggleMainContentMinimized}
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--color-primary-dim)',
                            color: isMainContentMinimized ? 'var(--color-accent)' : 'var(--color-primary-dim)',
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            padding: '0.2rem 0.5rem'
                        }}
                    >
                        {isMainContentMinimized ? '[ SHOW_PAGES ]' : '[ PINNED_ONLY ]'}
                    </button>

                    <nav className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        {orderedNavLinks.map((link) => (
                            <div
                                key={link.path}
                                draggable
                                onDragStart={() => {
                                    setDraggingNav(link.name);
                                    navDidReorderRef.current = false;
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    if (draggingNav && draggingNav !== link.name) {
                                        navDidReorderRef.current = true;
                                        moveNavButton(draggingNav, link.name);
                                    }
                                }}
                                onDragEnd={() => {
                                    if (navDidReorderRef.current) {
                                        lastNavReorderAtRef.current = Date.now();
                                        navDidReorderRef.current = false;
                                    }
                                    setDraggingNav(null);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDraggingNav(null);
                                }}
                                style={{
                                    cursor: 'grab',
                                    opacity: draggingNav === link.name ? 0.45 : 1,
                                    borderBottom: draggingNav === link.name ? '1px dashed var(--color-accent)' : '1px solid transparent',
                                    paddingBottom: '2px'
                                }}
                                title="Drag to reorder"
                            >
                                <Link
                                    to={link.path}
                                    onClick={(e) => {
                                        if (Date.now() - lastNavReorderAtRef.current < 250) {
                                            e.preventDefault();
                                            lastNavReorderAtRef.current = 0;
                                        }
                                    }}
                                    draggable={false}
                                    style={{
                                        textDecoration: location.pathname === link.path ? 'underline' : 'none',
                                        color: location.pathname === link.path ? 'var(--color-accent)' : 'var(--color-primary)',
                                        fontWeight: location.pathname === link.path ? 'bold' : 'normal'
                                    }}
                                >
                                    [{link.name}]
                                </Link>
                            </div>
                        ))}
                    </nav>
                </div>
            </header>

            {shouldShowMainContent && (
                <main>
                    <Outlet />
                </main>
            )}

            {isMainContentMinimized && !hasVisiblePinnedSurface && (
                <main style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                        border: '1px solid var(--color-primary-dim)',
                        backgroundColor: 'rgba(0, 5, 10, 0.7)',
                        padding: '1rem 1.2rem',
                        maxWidth: '420px',
                        textAlign: 'center',
                        color: 'var(--color-primary)'
                    }}>
                        <div style={{ fontSize: '0.85rem', marginBottom: '0.6rem', color: 'var(--color-accent)' }}>
                            PINNED_ONLY MODE ACTIVE
                        </div>
                        <div style={{ fontSize: '0.72rem', opacity: 0.85, lineHeight: 1.5, marginBottom: '0.9rem' }}>
                            No pinned windows are visible right now, so the page content has been restored automatically.
                        </div>
                        <button
                            onClick={toggleMainContentMinimized}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--color-primary)',
                                color: 'var(--color-primary)',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                padding: '0.35rem 0.7rem'
                            }}
                        >
                            [ SHOW_PAGES ]
                        </button>
                    </div>
                </main>
            )}

            <SystemAlertModal />

            {shouldShowMainContent && (
                <footer style={{ marginTop: '4rem', paddingTop: '1rem', borderTop: '1px dashed var(--color-primary-dim)', fontSize: '0.8rem', textAlign: 'center', opacity: 0.7 }}>
                    <p>Peregrine Archival Recovery Project &copy; 3555</p>
                    <p>WARNING: UNAUTHORIZED ACCESS ATTEMPTS ARE LOGGED</p>
                </footer>
            )}
        </div>
    );
};

export default Layout;
