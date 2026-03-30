import React, { useState } from 'react';
import { useGameState } from '../context/GameStateContext';
import { Cpu, Activity } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

const PinnedAgents: React.FC = () => {
    const { codexAgents, isAgentsPinned, pinnedPositions, updatePinnedPosition, setAgentNickname } = useGameState();
    const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
    const [draftNickname, setDraftNickname] = useState('');

    const initialPos = pinnedPositions?.agents || { x: window.innerWidth - 320, y: window.innerHeight - 340 };
    const { pos, onMouseDown, isDragging } = useDraggable('agents', initialPos, updatePinnedPosition);

    if (!isAgentsPinned || codexAgents.length === 0) return null;

    const startRename = (agentId: string, currentNickname?: string) => {
        setEditingAgentId(agentId);
        setDraftNickname(currentNickname || '');
    };

    const saveRename = (agentId: string) => {
        setAgentNickname(agentId, draftNickname);
        setEditingAgentId(null);
        setDraftNickname('');
    };

    const cancelRename = () => {
        setEditingAgentId(null);
        setDraftNickname('');
    };

    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: '320px',
                backgroundColor: 'rgba(0, 5, 10, 0.85)',
                border: '1px solid var(--color-primary-dim)',
                padding: '12px',
                zIndex: 100,
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)',
                backdropFilter: 'blur(4px)',
                fontFamily: 'monospace',
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 0.8 : 1,
                transition: isDragging ? 'none' : 'opacity 0.3s ease'
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
                <Cpu size={14} />
                CODEX_AGENTS_LOG // ACTIVE
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {codexAgents.map((agent) => {
                    const isEditing = editingAgentId === agent.id;
                    const displayName = agent.nickname?.trim() ? `${agent.nickname} // ${agent.name}` : agent.name;

                    return (
                        <div key={agent.id} style={{ borderLeft: '2px solid var(--color-primary-dim)', paddingLeft: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                    <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                        {displayName}
                                    </span>
                                    <span style={{ color: 'var(--color-primary-dim)', fontSize: '0.62rem' }}>
                                        ID: {agent.name}
                                    </span>
                                </div>
                                <span style={{ color: 'var(--color-primary-dim)', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                                    ({agent.strategy.toUpperCase()})
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem' }}>
                                <span style={{
                                    color: agent.strategy === 'disabled' ? 'var(--color-primary-dim)' : 'var(--color-accent)',
                                    textTransform: 'uppercase',
                                    opacity: 0.8
                                }}>
                                    {agent.strategy}
                                </span>
                                <span style={{ color: 'var(--color-primary-dim)' }}>|</span>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: agent.lastAction?.includes('UPGRADING') ? 'var(--color-accent)' :
                                        agent.lastAction?.includes('DEFRAGGING') ? 'var(--color-alert)' :
                                            'var(--color-primary)',
                                    fontWeight: agent.lastAction?.includes('IDLE') ? 'normal' : 'bold'
                                }}>
                                    <Activity size={10} style={{ opacity: 0.6 }} />
                                    {agent.lastAction || 'INITIALIZING...'}
                                </div>
                            </div>

                            <div
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}
                            >
                                {isEditing ? (
                                    <>
                                        <input
                                            type="text"
                                            value={draftNickname}
                                            onChange={(e) => setDraftNickname(e.target.value)}
                                            placeholder="Nickname (optional)"
                                            maxLength={24}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                background: 'rgba(0, 255, 255, 0.05)',
                                                border: '1px solid var(--color-primary-dim)',
                                                color: 'var(--color-text)',
                                                padding: '4px 6px',
                                                fontFamily: 'inherit',
                                                fontSize: '0.7rem',
                                                outline: 'none'
                                            }}
                                        />
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                type="button"
                                                onClick={() => saveRename(agent.id)}
                                                style={{
                                                    background: 'rgba(56, 163, 160, 0.15)',
                                                    border: '1px solid var(--color-accent)',
                                                    color: 'var(--color-accent)',
                                                    padding: '3px 8px',
                                                    fontFamily: 'inherit',
                                                    fontSize: '0.65rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                SAVE
                                            </button>
                                            <button
                                                type="button"
                                                onClick={cancelRename}
                                                style={{
                                                    background: 'transparent',
                                                    border: '1px solid var(--color-primary-dim)',
                                                    color: 'var(--color-primary-dim)',
                                                    padding: '3px 8px',
                                                    fontFamily: 'inherit',
                                                    fontSize: '0.65rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                CANCEL
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => startRename(agent.id, agent.nickname)}
                                        style={{
                                            alignSelf: 'flex-start',
                                            background: 'transparent',
                                            border: '1px solid var(--color-primary-dim)',
                                            color: 'var(--color-primary-dim)',
                                            padding: '3px 8px',
                                            fontFamily: 'inherit',
                                            fontSize: '0.65rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {agent.nickname?.trim() ? 'RENAME' : 'ADD NAME'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{
                marginTop: '12px',
                fontSize: '0.6rem',
                color: 'var(--color-primary-dim)',
                textAlign: 'right',
                fontStyle: 'italic'
            }}>
                -- RUN 'agents --pin' TO HIDE --
            </div>
        </div>
    );
};

export default PinnedAgents;
