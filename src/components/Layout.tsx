import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Terminal } from 'lucide-react';

const Layout: React.FC = () => {
    const location = useLocation();

    const navLinks = [
        { name: 'HOME', path: '/' },
        { name: 'ARCHIVE', path: '/archive' },
        { name: 'TIMELINE', path: '/timeline' },
        { name: 'ABOUT', path: '/about' },
        { name: 'TERMINAL', path: '/terminal' },
    ];

    return (
        <div className="container">
            <header style={{ borderBottom: '1px solid var(--color-primary)', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="flicker" style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Terminal size={24} /> PEREGRINE_TERMINAL //
                    </h1>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-alert)', marginTop: '0.2rem', fontWeight: 'bold' }}>
                        [SOLARIS_NODE_ACTIVE]
                    </div>
                </div>
                <nav style={{ display: 'flex', gap: '1rem' }}>
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
            </header>

            <main>
                <Outlet />
            </main>

            <footer style={{ marginTop: '4rem', paddingTop: '1rem', borderTop: '1px dashed var(--color-primary-dim)', fontSize: '0.8rem', textAlign: 'center', opacity: 0.7 }}>
                <p>Latham Archival Recovery Project &copy; 2095</p>
                <p>WARNING: UNAUTHORIZED ACCESS ATTEMPTS ARE LOGGED</p>
            </footer>
        </div>
    );
};

export default Layout;
