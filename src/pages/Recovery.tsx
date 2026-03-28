import React, { useState, useCallback, useRef } from 'react';
import { useGameState } from '../context/GameStateContext';
import JobManager from '../components/JobManager';
import BirdMascot from '../components/BirdMascot';

interface CodeUnit {
    id: string;
    text: string;
    correctIndex: number;
}

interface CorruptedNode {
    id: string;
    name: string;
    traceLimit: number;
    units: Omit<CodeUnit, 'id'>[];
}

const NODES_DB: CorruptedNode[] = [
    {
        id: 'node-alpha',
        name: 'ANOMALY: J.HARIS_LOG_01',
        traceLimit: 6,
        units: [
            { text: 'I am relegated to being a servant for the elite Tin Can Worshipers.', correctIndex: 0 },
            { text: 'But I found dad\'s old blueprints. I\'m developing a USB virus to disrupt Shell\'s machine cycle.', correctIndex: 1 },
            { text: 'Cross-reference (xref command) the anomaly data (anomaly.dat) with locked-01 to confirm the deployment sequence.', correctIndex: 2 },
            { text: 'The override code for locked-02 is eclipse.', correctIndex: 3 },
        ]
    },
    {
        id: 'node-beta',
        name: 'UNIT: PROJECT_ICARUS',
        traceLimit: 10,
        units: [
            { text: '// SEC_CLEARANCE_REQUIRED: LEVEL_3', correctIndex: 0 },
            { text: 'The Peregrine suits think they can harvest infinite energy.', correctIndex: 1 },
            { text: 'They don\'t realize the sphere is feeding on the structural integrity of Earth-B.', correctIndex: 2 },
            { text: 'Every time they spool up the reactor, a city block falls into the void.', correctIndex: 3 },
            { text: 'I am taking the core offline. God help us all.', correctIndex: 4 },
        ]
    },
    {
        id: 'node-gamma',
        name: 'SYS: CORE_DUMP_0x8A',
        traceLimit: 14,
        units: [
            { text: 'Warning: Mainframe synchronization failed.', correctIndex: 0 },
            { text: 'Attempting to reroute power from auxiliary life support.', correctIndex: 1 },
            { text: 'System override denied by user: ALAN_T.', correctIndex: 2 },
            { text: 'Initiating emergency lockdown of Sector 4.', correctIndex: 3 },
            { text: 'All personnel must evacuate immediately.', correctIndex: 4 },
            { text: 'The anomaly is expanding. Containment breached.', correctIndex: 5 },
        ]
    }
];

const shuffleUnits = (source: Omit<CodeUnit, 'id'>[]): CodeUnit[] => {
    let arr = source.map((f, i) => ({ ...f, id: `u-${i}` }));
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const Recovery: React.FC = () => {
    const { compiledNodes, compileNode, archiveRestoration } = useGameState();

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [units, setUnits] = useState<CodeUnit[]>([]);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [traceCount, setTraceCount] = useState(0);
    const [mascotMessage, setMascotMessage] = useState<string | null>(null);
    const mascotTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const mascotSay = useCallback((msg: string) => {
        setMascotMessage(msg);
        if (mascotTimeout.current) clearTimeout(mascotTimeout.current);
        mascotTimeout.current = setTimeout(() => setMascotMessage(null), 2000);
    }, []);

    const activeNode = NODES_DB.find(n => n.id === selectedNodeId);
    const isCompiled = selectedNodeId ? compiledNodes.includes(selectedNodeId) : false;

    const loadNode = (nodeId: string) => {
        const node = NODES_DB.find(n => n.id === nodeId);
        if (!node) return;

        setSelectedNodeId(nodeId);
        setSelectedIdx(null);
        setTraceCount(0);

        if (compiledNodes.includes(nodeId)) {
            setUnits(node.units.map((u, i) => ({ ...u, id: `u-${i}` })));
        } else {
            setUnits(shuffleUnits(node.units));
            mascotSay("BREAK IT DOWN!");
        }
    };

    const handleSelect = (idx: number) => {
        if (isCompiled || !activeNode) return;

        if (selectedIdx === null) {
            setSelectedIdx(idx);
        } else {
            const newUnits = [...units];
            const temp = newUnits[selectedIdx];
            newUnits[selectedIdx] = newUnits[idx];
            newUnits[idx] = temp;

            const newTrace = traceCount + 1;
            setTraceCount(newTrace);
            setUnits(newUnits);
            setSelectedIdx(null);

            const isWin = newUnits.every((u, i) => u.correctIndex === i);
            if (isWin) {
                compileNode(activeNode.id);
                mascotSay("BINGO! NODE COMPILED.");
            } else if (newTrace >= activeNode.traceLimit) {
                mascotSay("TRACE DETECTED! SCRAMBLING!");
                setUnits(shuffleUnits(activeNode.units));
                setTraceCount(0);
            } else {
                mascotSay("SWAPPED.");
            }
        }
    };

    const currentAlignment = units.filter((u, i) => u.correctIndex === i).length;
    const alignPercent = units.length > 0 ? Math.floor((currentAlignment / units.length) * 100) : 0;

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--color-primary)', paddingBottom: '1rem', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ color: 'var(--color-text)', margin: 0 }}>
                        TACTILE COMPILATION SUITE
                    </h2>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.7 }}>
                        Current Global Restoration: {Math.floor(archiveRestoration)}%
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>
                <div style={{ border: '1px solid var(--color-primary-dim)', padding: '1.5rem', backgroundColor: 'rgba(56, 163, 160, 0.02)' }}>
                    {!selectedNodeId ? (
                        <div>
                            <p style={{ color: 'var(--color-primary-dim)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                [SYSTEM] SELECT DETECTED CORRUPTED ANOMALY UNITS FOR PROTOCOL DESCRAMBLING:
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {NODES_DB.map(node => {
                                    const compiled = compiledNodes.includes(node.id);
                                    return (
                                        <div
                                            key={node.id}
                                            onClick={() => loadNode(node.id)}
                                            style={{
                                                padding: '1rem',
                                                border: '1px solid',
                                                borderColor: compiled ? 'var(--color-primary)' : 'var(--color-primary-dim)',
                                                backgroundColor: 'rgba(56, 163, 160, 0.05)',
                                                color: compiled ? 'var(--color-primary)' : 'var(--color-text)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            <span>{node.name}</span>
                                            <span>{compiled ? '[COMPILED]' : '[SCRAMBLED]'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                                <button onClick={() => setSelectedNodeId(null)} style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', backgroundColor: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', cursor: 'pointer' }}>
                                    &lt; BACK TO DIRECTORY
                                </button>
                            </div>

                            <div style={{ position: 'relative', height: '50px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem' }}>
                                <BirdMascot message={mascotMessage} size="small" />
                            </div>
                            <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-primary-dim)', backgroundColor: 'rgba(56, 163, 160, 0.05)', padding: '1rem', border: '1px solid var(--color-primary-dim)' }}>
                                <div>
                                    {isCompiled ? (
                                        <span style={{ color: 'var(--color-primary)' }}>[SYSTEM] NODE COMPILED SUCCESSFULLY. RESTORATION BOOST APPLIED.</span>
                                    ) : (
                                        <span>[SYSTEM] DIRECTIVE: SELECT TWO BLOCKS TO SWAP THEIR POSITIONS UNTIL LOGICAL SEQUENCE IS RESTORED.</span>
                                    )}
                                </div>
                                {activeNode && !isCompiled && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px solid rgba(56, 163, 160, 0.2)', paddingTop: '0.5rem' }}>
                                        <div style={{ color: traceCount >= activeNode.traceLimit - 2 ? 'var(--color-alert)' : 'var(--color-primary)' }}>
                                            TRACE: {traceCount} / {activeNode.traceLimit}
                                        </div>
                                        <div>
                                            ALIGNMENT: <span style={{ color: 'var(--color-accent)' }}>{alignPercent}%</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {units.map((u, idx) => {
                                    const isSelected = selectedIdx === idx;
                                    const isCorrect = isCompiled; 
                                    const isAligned = !isCompiled && u.correctIndex === idx;

                                    return (
                                        <div
                                            key={u.id}
                                            onClick={() => handleSelect(idx)}
                                            style={{
                                                padding: '1rem',
                                                border: '1px solid',
                                                borderColor: isCorrect ? 'var(--color-primary)' : isSelected ? 'var(--color-text)' : isAligned ? 'var(--color-accent)' : 'var(--color-primary-dim)',
                                                backgroundColor: isSelected ? 'rgba(238, 235, 226, 0.1)' : 'rgba(56, 163, 160, 0.05)',
                                                color: isCorrect ? 'var(--color-primary)' : isAligned ? 'var(--color-accent)' : 'var(--color-text)',
                                                cursor: isCompiled ? 'default' : 'pointer',
                                                transition: 'all 0.2s ease',
                                                userSelect: 'none',
                                                fontSize: '0.9rem',
                                                boxShadow: isAligned && !isCompiled ? '0 0 5px rgba(238, 235, 226, 0.3)' : 'none'
                                            }}
                                        >
                                            <span style={{ opacity: 0.5, marginRight: '1rem', fontSize: '0.7rem' }}>BLOCK_{(idx + 1).toString().padStart(2, '0')}</span>
                                            {u.text}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ border: '1px solid var(--color-primary-dim)', padding: '1.5rem', backgroundColor: 'rgba(56, 163, 160, 0.02)' }}>
                    <JobManager />
                    <div style={{ marginTop: '2rem', fontSize: '0.7rem', color: 'var(--color-primary-dim)', lineHeight: '1.4' }}>
                        <p>[INFO] Background recovery jobs run asynchronously. You can navigate away from this page while they process. System alerts will notify you upon completion.</p>
                        <p>[INFO] Manual compilation provides an immediate, large restoration boost but requires high-focus technician time. Yields significant COMPUTE UNITS upon success.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Recovery;
