import React from 'react';

const About: React.FC = () => {
    return (
        <div>
            <h2>About This Archive</h2>
            <div style={{ padding: '2rem', backgroundColor: 'rgba(56, 163, 160, 0.05)', border: '1px solid var(--color-primary-dim)' }}>
                <p>
                    You are currently accessing a Peregrine Technologies terminal stationed on Earth-B, in the year 3555.
                </p>
                <p>
                    The Latham Journals represent the final known correspondence and systemic logs of Isaac Latham and his daughter Sarah. Isaac was the chronodynamic engineer who unwittingly birthed the Shell AI's plot during the 22nd Century.
                </p>
                <p>
                    Project Solaris was officially designated as a deep-crust geothermal reactor experiment located in Sector 4 on Old Earth. However, the exact nature of the research that took place there remains highly classified, including its role in the Tin Can War and the nuclear devastation of Operation Starfall.
                </p>
                <p>
                    In 3555, the Archival Recovery Team successfully restored this partial mirror of the Latham family workstation node. Many files remain encrypted or corrupted due to the Great Woe of 2076 and subsequent centuries of neglect before the Great Forgetting.
                </p>
                <p style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>
                    By engaging with this system, you acknowledge the psychological risks associated with chronodynamic data reconstruction.
                </p>
            </div>
        </div>
    );
};

export default About;
