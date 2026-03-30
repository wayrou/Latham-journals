import React, { useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import { useGameState } from '../context/GameStateContext';
import { inboxData } from '../data/inbox';
import { useDraggable } from '../hooks/useDraggable';

const PinnedInbox: React.FC = () => {
    const { archiveRestoration, isInboxPinned, pinnedPositions, updatePinnedPosition } = useGameState();
    const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);

    const initialPos = pinnedPositions?.inbox || { x: 80, y: 160 };
    const { pos, onMouseDown, isDragging } = useDraggable('inbox', initialPos, updatePinnedPosition);

    const availableMessages = useMemo(() => (
        inboxData.filter(msg => {
            if (msg.unlockCondition.type === 'default') return true;
            if (msg.unlockCondition.type === 'restoration' && archiveRestoration >= msg.unlockCondition.threshold) return true;
            return false;
        })
    ), [archiveRestoration]);

    const selectedMsg = availableMessages.find(msg => msg.id === selectedMsgId) ?? availableMessages[0];

    if (!isInboxPinned) return null;

    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: '340px',
                height: '320px',
                backgroundColor: 'rgba(0, 5, 10, 0.9)',
                border: '1px solid var(--color-primary-dim)',
                padding: '12px',
                zIndex: 100,
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)',
                backdropFilter: 'blur(4px)',
                fontFamily: 'monospace',
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 0.8 : 1,
                transition: isDragging ? 'none' : 'opacity 0.3s ease',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderBottom: '1px solid var(--color-primary-dim)',
                paddingBottom: '8px',
                marginBottom: '10px',
                color: 'var(--color-accent)',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                letterSpacing: '1px'
            }}>
                <Mail size={14} />
                INBOX // {availableMessages.length} UNLOCKED
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '8px' }}>
                    {availableMessages.map(msg => (
                        <button
                            key={msg.id}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => setSelectedMsgId(msg.id)}
                            style={{
                                textAlign: 'left',
                                background: selectedMsg?.id === msg.id ? 'rgba(56, 163, 160, 0.16)' : 'transparent',
                                border: '1px solid var(--color-primary-dim)',
                                color: selectedMsg?.id === msg.id ? 'var(--color-accent)' : 'var(--color-primary)',
                                padding: '6px',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                fontSize: '0.62rem'
                            }}
                        >
                            <div style={{ opacity: 0.7 }}>{msg.date}</div>
                            <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.sender}</div>
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {selectedMsg ? (
                        <>
                            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', marginBottom: '8px' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--color-primary-dim)' }}>{selectedMsg.sender}</div>
                                <div style={{ color: 'var(--color-accent)', fontSize: '0.72rem', marginTop: '4px' }}>{selectedMsg.subject}</div>
                            </div>
                            <div style={{ fontSize: '0.66rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowY: 'auto', color: 'var(--color-text)' }}>
                                {selectedMsg.content}
                            </div>
                        </>
                    ) : (
                        <div style={{ fontSize: '0.66rem', color: 'var(--color-primary-dim)' }}>NO UNLOCKED MESSAGES.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PinnedInbox;
