import React, { useState } from 'react';
import { useGameState } from '../context/GameStateContext';
import { inboxData } from '../data/inbox';

const Inbox: React.FC = () => {
    const { archiveRestoration } = useGameState();
    const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);

    const availableMessages = inboxData.filter(msg => {
        if (msg.unlockCondition.type === 'default') return true;
        if (msg.unlockCondition.type === 'restoration' && archiveRestoration >= msg.unlockCondition.threshold) return true;
        return false;
    });

    const unreadCount = availableMessages.length; // Can add a persistent 'read messages' array if needed, but for now we just show all unlocked

    const selectedMsg = availableMessages.find(m => m.id === selectedMsgId);

    return (
        <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 200px)', padding: '1rem', fontFamily: 'var(--font-mono)' }}>

            {/* INBOX LIST DIRECTORY */}
            <div style={{ flex: '0 0 300px', borderRight: '1px solid var(--color-primary-dim)', paddingRight: '1rem', overflowY: 'auto' }}>
                <h2 style={{ borderBottom: '1px solid var(--color-primary-dim)', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '1.2rem', color: 'var(--color-text)' }}>
                    INBOX ({unreadCount})
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {availableMessages.map(msg => (
                        <div
                            key={msg.id}
                            onClick={() => setSelectedMsgId(msg.id)}
                            style={{
                                padding: '0.8rem',
                                border: '1px solid',
                                borderColor: selectedMsgId === msg.id ? 'var(--color-accent)' : 'var(--color-primary-dim)',
                                backgroundColor: selectedMsgId === msg.id ? 'rgba(238, 235, 226, 0.1)' : 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                color: selectedMsgId === msg.id ? 'var(--color-accent)' : 'var(--color-text)'
                            }}
                        >
                            <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.2rem' }}>{msg.date}</div>
                            <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.sender}</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--color-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.subject}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* MESSAGE VIEW PANEL */}
            <div style={{ flex: '1', display: 'flex', flexDirection: 'column', padding: '1rem', backgroundColor: 'rgba(56, 163, 160, 0.05)', border: '1px solid var(--color-primary-dim)' }}>
                {selectedMsg ? (
                    <>
                        <div style={{ borderBottom: '1px solid var(--color-primary-dim)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-primary-dim)' }}>FROM</div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>{selectedMsg.sender}</div>

                            <div style={{ fontSize: '0.8rem', color: 'var(--color-primary-dim)' }}>SUBJECT</div>
                            <div style={{ color: 'var(--color-accent)', fontSize: '1.2rem' }}>{selectedMsg.subject}</div>

                            <div style={{ fontSize: '0.8rem', color: 'var(--color-primary-dim)', marginTop: '0.5rem' }}>DATE: {selectedMsg.date}</div>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '0.95rem' }}>
                            {selectedMsg.content}
                        </div>
                    </>
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-dim)', fontStyle: 'italic' }}>
                        SELECT A MESSAGE TO VIEW CONTENTS
                    </div>
                )}
            </div>

        </div>
    );
};

export default Inbox;
