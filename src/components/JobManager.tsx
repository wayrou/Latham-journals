import React, { useEffect, useState } from 'react';
import { useGameState } from '../context/GameStateContext';
import { jobsData } from '../data/jobs';

const JobManager: React.FC = () => {
    const {
        startJob,
        getJobProgress, isJobActive, isJobCompleted
    } = useGameState();

    const [, setTick] = useState(0);

    // Force re-render every second to update progress bars
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    const availableJobs = jobsData.filter(j => !isJobActive(j.id) && !isJobCompleted(j.id));
    const runningJobs = jobsData.filter(j => isJobActive(j.id));
    const finishedJobs = jobsData.filter(j => isJobCompleted(j.id));

    return (
        <div style={{
            border: '1px solid var(--color-primary-dim)',
            backgroundColor: 'rgba(56, 163, 160, 0.05)',
            padding: '1rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text)'
        }}>
            <h3 style={{
                margin: '0 0 1rem 0',
                color: 'var(--color-primary)',
                borderBottom: '1px solid var(--color-primary-dim)',
                paddingBottom: '0.5rem',
                fontSize: '0.7rem',
                letterSpacing: '0.5px',
                lineHeight: '1.2',
                textAlign: 'center'
            }}>
                BACKGROUND_OPERATIONS_MANAGER
            </h3>

            {/* RUNNING JOBS */}
            {runningJobs.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem' }}>ACTIVE_PROCESSES:</div>
                    {runningJobs.map(job => {
                        const progress = getJobProgress(job.id);
                        return (
                            <div key={job.id} style={{ marginBottom: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                                    <span>{job.name}</span>
                                    <span>{progress}%</span>
                                </div>
                                <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(56, 163, 160, 0.2)', position: 'relative' }}>
                                    <div style={{
                                        width: `${progress}%`,
                                        height: '100%',
                                        backgroundColor: 'var(--color-primary)',
                                        transition: 'width 1s linear',
                                        boxShadow: '0 0 5px var(--color-primary)'
                                    }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* AVAILABLE JOBS */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem' }}>AVAILABLE_PROTOCOLS:</div>
                {availableJobs.length === 0 && runningJobs.length === 0 && finishedJobs.length === jobsData.length ? (
                    <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>[ALL_PROTOCOLS_DECODED]</div>
                ) : availableJobs.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>[NO_PENDING_OPERATIONS]</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {availableJobs.map(job => (
                            <div key={job.id} style={{
                                border: '1px solid var(--color-primary-dim)',
                                padding: '0.5rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{job.name}</div>
                                    <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{job.description}</div>
                                </div>
                                <button
                                    onClick={() => startJob(job.id)}
                                    style={{
                                        padding: '0.3rem 0.6rem',
                                        fontSize: '0.7rem',
                                        backgroundColor: 'transparent',
                                        border: '1px solid var(--color-primary)',
                                        color: 'var(--color-primary)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    INITIATE
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* COMPLETED JOBS */}
            {finishedJobs.length > 0 && (
                <div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.5rem' }}>COMPLETED_ARCHIVE:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {finishedJobs.map(job => (
                            <div key={job.id} style={{ fontSize: '0.8rem', color: 'var(--color-primary-dim)' }}>
                                [COMPLETED] {job.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobManager;
