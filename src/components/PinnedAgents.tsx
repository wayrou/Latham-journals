import React from 'react';
import { useGameState } from '../context/GameStateContext';
import { Cpu, Activity } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

const PinnedAgents: React.FC = () => {
    const { codexAgents, isAgentsPinned, pinnedPositions, updatePinnedPosition } = useGameState();

    const initialPos = pinnedPositions?.agents || { x: window.innerWidth - 300, y: window.innerHeight - 300 };
    const { pos, onMouseDown, isDragging } = useDraggable('agents', initialPos, updatePinnedPosition);

    if (!isAgentsPinned || codexAgents.length === 0) return null;

    return (
        <div 
            onMouseDown={onMouseDown}
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: '280px',
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
                {codexAgents.map((agent) => (
                    <div key={agent.id} style={{ borderLeft: '2px solid var(--color-primary-dim)', paddingLeft: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                AGENT_{agent.id.slice(-4)}
                            </span>
                            <span style={{ color: 'var(--color-primary-dim)', fontSize: '0.65rem' }}>
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
                    </div>
                ))}
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
