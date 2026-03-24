import React from 'react';

const About: React.FC = () => {
    return (
        <div>
            <h2>About This Archive</h2>
            <div style={{ padding: '2rem', backgroundColor: 'rgba(56, 163, 160, 0.05)', border: '1px solid var(--color-primary-dim)' }}>
                <p>
                    The Latham Journals represent the final known correspondence and systemic logs of Isaac Latham, the lead chronodynamic engineer of Project Solaris.
                </p>
                <p>
                    Project Solaris was officially designated as a deep-crust geothermal reactor experiment located in Sector 4. However, the exact nature of the research that took place before the facility was abandoned in 2094 remains highly classified.
                </p>
                <p>
                    In 2095, the Archival Recovery Team successfully restored a partial mirror of Latham's workstation node.
                </p>
                <p style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>
                    By engaging with this system, you acknowledge the psychological risks associated with chronodynamic data reconstruction.
                </p>
            </div>
        </div>
    );
};

export default About;
