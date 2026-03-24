import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
    return (
        <div>
            <h2 style={{ borderLeft: '4px solid var(--color-accent)', paddingLeft: '1rem' }}>SYSTEM BOOT SEQUENCE... OK</h2>

            <div style={{ marginTop: '2rem', border: '1px solid var(--color-primary-dim)', padding: '2rem', backgroundColor: 'rgba(56, 163, 160, 0.05)' }}>
                <p>
                    Alright, we’ve granted you access to all the Latham stuff. Your terminal will now have access to all the surviving available remnants of what we’re calling “Project Solaris”- it was all recovered from Separation-era junk. Most of the records are fragmented, redacted or encrypted with some kind of proprietary cipher- what we’re asking you to do is put a full timeline together and try to decrypt everything you can.
                </p>
                <p>
                    Thanks!<br />
                    -Alan
                </p>

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
