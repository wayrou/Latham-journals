import React from 'react';
import { useGameState } from '../context/GameStateContext';
import { useDungeon } from '../context/DungeonContext';
import { useDraggable } from '../hooks/useDraggable';
import { Wallet, TrendingUp, Cpu } from 'lucide-react';

const PinnedWallets: React.FC = () => {
    const { computeUnits, crawlerStats, codexAgents, isWalletsPinned, pinnedPositions, updatePinnedPosition } = useGameState();
    const { breaches } = useDungeon();

    const initialPos = pinnedPositions?.wallets || { x: window.innerWidth - 280, y: 80 };
    const { pos, onMouseDown, isDragging } = useDraggable('wallets', initialPos, updatePinnedPosition);

    if (!isWalletsPinned) return null;

    // Calculate CU/sec from active miners
    const activeMiners = breaches.filter(b => b.spec === 'miner' && !b.isPaused && b.hp > 0).length;
    const tickDuration = Math.max(75, 450 - ((crawlerStats.speedBoost || 0) * 75));
    const ticksPerSec = 1000 / tickDuration;
    const cuPerSec = activeMiners * ((crawlerStats.minerYield || 3) / 3) * ticksPerSec;

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
                marginBottom: '12px', 
                padding: '10px', 
                backgroundColor: 'rgba(56, 163, 160, 0.05)', 
                border: '1px solid rgba(56, 163, 160, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary-dim)', fontSize: '0.65rem' }}>
                    <Cpu size={12} />
                    TOTAL_COMPUTE_UNITS
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem', color: 'var(--color-text)', fontWeight: 'bold' }}>
                        {computeUnits.toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-accent)' }}>CU</span>
                    {cuPerSec > 0 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-accent)', marginLeft: 'auto' }}>
                            (+{cuPerSec.toFixed(1)}/s)
                        </span>
                    )}
                </div>
            </div>

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
                <Wallet size={14} />
                AGENT_BUDGET_WALLETS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {codexAgents.map((agent) => (
                    <div key={agent.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem' }}>
                            <span style={{ color: 'var(--color-primary)' }}>AGENT_{agent.id.slice(-4)}</span>
                            <span style={{ color: 'var(--color-accent)' }}>
                                {Math.floor(agent.budget)} / {agent.maxBudget} CU
                            </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#0a1a1a', border: '1px solid var(--color-primary-dim)', position: 'relative' }}>
                            <div style={{ 
                                width: `${agent.maxBudget > 0 ? (agent.budget / agent.maxBudget) * 100 : 0}%`, 
                                height: '100%', 
                                backgroundColor: 'var(--color-accent)',
                                transition: 'width 1s linear'
                            }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '0.65rem', color: 'var(--color-primary-dim)' }}>
                            <TrendingUp size={10} />
                            REFILL: +{agent.refillRate} CU / tick
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
                -- RUN 'wallets --pin' TO HIDE --
            </div>
        </div>
    );
};

export default PinnedWallets;
