import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { jobsData } from '../data/jobs';
import { type CipherFragment, rollCipherDrop, validateCipherPassword, CIPHER_DEFINITIONS } from '../utils/cipherSystem';
import { getDegradationMultipliers, calculateClutterGrowth, getDefragCost, type DegradationMultipliers } from '../utils/degradation';

export type CrawlerSpec = 'fighter' | 'rogue' | 'miner' | 'summoner';

export interface LogEntry {
    type: 'input' | 'output' | 'error' | 'system';
    content: string;
    specialType?: 'help' | 'ascii-grid';
}

export interface RefactorBonus {
    id: string;
    type: 'cuYield' | 'fragmentRate' | 'baseDmg' | 'maxHp' | 'speed';
    amount: number;
}

export interface BrickedNode {
    id: string;
    roomCoords: string;
    scrapValue: number;
    repairCost: number;
    repairTimeMs: number;
    rewardType: 'cipher' | 'cu';
}

export interface RepairJob {
    nodeId: string;
    startTime: number;
    durationMs: number;
    rewardType: 'cipher' | 'cu';
}

interface GameState {
    unlockedFiles: string[];
    readFiles: string[];
    isSystemUnlocked: boolean;
    archiveRestoration: number;
    activeJobs: { id: string; startTime: number }[];
    completedJobs: string[];
    compiledNodes: string[];
    computeUnits: number;
    crawlerStats: { baseDmg: number; maxHpBoost: number; speedBoost: number; maxBreachWindows: number; minerYield: number };
    codexAgents: { 
        id: string; 
        name: string; 
        strategy: 'responsible' | 'brave' | 'random' | 'disabled' | 'parallel' | 'defrag' | 'scrapper' | 'mechanic'; 
        lastAction?: string;
        budget: number;
        maxBudget: number;
        refillRate: number;
    }[];
    isAgentsPinned: boolean;
    isWalletsPinned: boolean;
    isMetaMapPinned: boolean;
    isTerminalPinned: boolean;
    terminalHistory: LogEntry[];
    terminalInput: string;
    activeAlert: { id: string; title: string; message: string; type: 'info' | 'warning' | 'critical' } | null;
    // Cipher system
    cipherFragments: CipherFragment[];
    unlockedCiphers: string[];
    // Degradation
    systemClutter: number;
    sessionStartTime: number;
    // Refactor / Prestige
    refactorCount: number;
    refactorBonuses: RefactorBonus[];
    totalCUSacrificed: number;
    // Bricked Nodes
    activeBrickedNode: BrickedNode | null;
    repairingNodes: RepairJob[];
    // Crawler specialization default
    defaultCrawlerSpec: CrawlerSpec;
    pinnedPositions: Record<string, { x: number; y: number }>;
}

interface GameStateContextType extends GameState {
    unlockFile: (fileId: string) => void;
    markFileAsRead: (fileId: string) => void;
    resetGame: () => void;
    unlockSystem: (password: string) => boolean;
    addRestoration: (amount: number) => void;
    startJob: (jobId: string) => boolean;
    compileNode: (nodeId: string) => void;
    addComputeUnits: (amount: number) => void;
    spendComputeUnits: (amount: number) => boolean;
    upgradeCrawler: (stat: 'baseDmg' | 'maxHpBoost' | 'speedBoost' | 'maxBreachWindows' | 'minerYield') => void;
    addCodexAgent: (strategy: 'responsible' | 'brave' | 'random' | 'disabled' | 'parallel' | 'defrag' | 'scrapper' | 'mechanic') => void;
    setAgentStrategy: (id: string, strategy: 'responsible' | 'brave' | 'random' | 'disabled' | 'parallel' | 'defrag' | 'scrapper' | 'mechanic') => void;
    setAgentBudget: (id: string, maxBudget: number) => void;
    setAgentRefillRate: (id: string, refillRate: number) => void;
    toggleAgentsPinned: () => void;
    toggleWalletsPinned: () => void;
    toggleMetaMapPinned: () => void;
    toggleTerminalPinned: () => void;
    setTerminalInput: (val: string) => void;
    setTerminalHistory: (history: LogEntry[] | ((prev: LogEntry[]) => LogEntry[])) => void;
    getUpgradeCost: (stat: 'baseDmg' | 'maxHpBoost' | 'speedBoost' | 'maxBreachWindows' | 'minerYield') => number;
    triggerAlert: (title: string, message: string, type?: 'info' | 'warning' | 'critical') => void;
    dismissAlert: () => void;
    getJobProgress: (jobId: string) => number;
    isJobActive: (jobId: string) => boolean;
    isJobCompleted: (jobId: string) => boolean;
    // New mechanics
    addCipherFragment: (fragment: CipherFragment) => void;
    attemptCipherUnlock: (cipherId: string, password: string) => boolean;
    getDegradation: () => DegradationMultipliers;
    reduceClutter: (amount: number) => boolean;
    initiateRefactor: (bonusType: RefactorBonus['type']) => boolean;
    scrapBrickedNode: () => void;
    repairBrickedNode: () => boolean;
    setDefaultSpec: (spec: CrawlerSpec) => void;
    getCipherProgress: () => { cipherId: string; name: string; found: number; required: number }[];
    setActiveBrickedNode: (node: BrickedNode | null) => void;
    updatePinnedPosition: (id: string, x: number, y: number) => void;
}

const defaultState: GameState = {
    unlockedFiles: [],
    readFiles: [],
    isSystemUnlocked: false,
    archiveRestoration: 0,
    activeJobs: [],
    completedJobs: [],
    compiledNodes: [],
    computeUnits: 0,
    crawlerStats: { baseDmg: 3, maxHpBoost: 0, speedBoost: 0, maxBreachWindows: 1, minerYield: 3 },
    codexAgents: [],
    isAgentsPinned: false,
    isWalletsPinned: false,
    isMetaMapPinned: false,
    isTerminalPinned: false,
    terminalHistory: [
        { type: 'system', content: 'PRGN_OS SECURE TERMINAL v4.2.1 CONNECTED.' },
        { type: 'system', content: 'ENTER COMMAND OR "help" FOR SYSTEM ASSISTANCE.' }
    ],
    terminalInput: '',
    activeAlert: null,
    cipherFragments: [],
    unlockedCiphers: [],
    systemClutter: 0,
    sessionStartTime: Date.now(),
    refactorCount: 0,
    refactorBonuses: [],
    totalCUSacrificed: 0,
    activeBrickedNode: null,
    repairingNodes: [],
    defaultCrawlerSpec: 'fighter',
    pinnedPositions: {
        breach: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 200, y: 20 },
        agents: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 300, y: (typeof window !== 'undefined' ? window.innerHeight : 900) - 300 },
        metamap: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 260, y: 100 },
        wallets: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 280, y: 80 },
        terminal: { x: 100, y: 100 }
    }
};

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export const GameStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [gameState, setGameState] = useState<GameState>(() => {
        const saved = localStorage.getItem('latham_journals_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);

                // DATA MIGRATION & HARDENING
                // 1. Ensure activeJobs is an array of objects {id, startTime}
                const rawActiveJobs = Array.isArray(parsed.activeJobs) ? parsed.activeJobs : [];
                const migratedActiveJobs = rawActiveJobs.map((j: any) =>
                    typeof j === 'string' ? { id: j, startTime: Date.now() } : j
                ).filter((j: any) => j && typeof j.id === 'string');

                return {
                    ...defaultState,
                    ...parsed,
                    readFiles: Array.isArray(parsed.readFiles) ? parsed.readFiles : [],
                    activeJobs: migratedActiveJobs,
                    completedJobs: Array.isArray(parsed.completedJobs) ? parsed.completedJobs : [],
                    compiledNodes: Array.isArray(parsed.compiledNodes) ? parsed.compiledNodes : [],
                    computeUnits: Number(parsed.computeUnits ?? parsed.fragments) || 0,
                    archiveRestoration: Number(parsed.archiveRestoration) || 0,
                    crawlerStats: parsed.crawlerStats && typeof parsed.crawlerStats.baseDmg === 'number'
                        ? { 
                            ...defaultState.crawlerStats, 
                            ...parsed.crawlerStats,
                            minerYield: Number(parsed.crawlerStats.minerYield) || defaultState.crawlerStats.minerYield
                          }
                        : { ...defaultState.crawlerStats },
                    codexAgents: (Array.isArray(parsed.codexAgents) ? parsed.codexAgents : []).map((a: any) => ({
                        ...a,
                        budget: Number(a.budget) || 0,
                        maxBudget: Number(a.maxBudget) || 0,
                        refillRate: Number(a.refillRate) || 0
                    })),
                    activeAlert: null,
                    isAgentsPinned: !!parsed.isAgentsPinned,
                    isMetaMapPinned: !!parsed.isMetaMapPinned,
                    isWalletsPinned: !!parsed.isWalletsPinned,
                    isTerminalPinned: !!parsed.isTerminalPinned,
                    terminalHistory: (Array.isArray(parsed.terminalHistory) ? parsed.terminalHistory : defaultState.terminalHistory)
                        .map((h: any) => ({
                            ...h,
                            content: typeof h.content === 'string' ? h.content : '[RECOVERY ERROR: DATA CORRUPTED]'
                        })),
                    pinnedPositions: { ...defaultState.pinnedPositions, ...(parsed.pinnedPositions || {}) }
                };
            } catch (e) {
                console.error("PRGN_OS: Failed to parse saved state, reverting to default.", e);
                return defaultState;
            }
        }
        return defaultState;
    });

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setGameState(prev => {
                let changed = false;
                const newActiveJobs: { id: string; startTime: number }[] = [];
                const newCompletedJobs = [...prev.completedJobs];
                let restorationBoost = 0;
                let newUnlockedFiles = [...prev.unlockedFiles];
                let newAlert = prev.activeAlert;

                prev.activeJobs.forEach(jobState => {
                    const jobDef = jobsData.find(j => j.id === jobState.id);
                    if (jobDef) {
                        const elapsed = now - jobState.startTime;
                        if (elapsed >= jobDef.durationMS) {
                            // Job finishes
                            changed = true;
                            newCompletedJobs.push(jobState.id);
                            restorationBoost += jobDef.rewardRestorationBoost;

                            // System Alert
                            if (!newAlert) {
                                newAlert = { id: `alert-${Date.now()}`, title: 'BACKGROUND JOB COMPLETE', message: `Protocol ${jobDef.id} finished processing.`, type: 'info' };
                            }

                            if (jobDef.rewardUnlockFileId && !newUnlockedFiles.includes(jobDef.rewardUnlockFileId)) {
                                newUnlockedFiles.push(jobDef.rewardUnlockFileId);
                            }
                        } else {
                            newActiveJobs.push(jobState);
                        }
                    }
                });

                if (changed) {
                    let newRestoration = prev.archiveRestoration + restorationBoost;
                    if (newRestoration > 100) newRestoration = 100;

                    return {
                        ...prev,
                        activeJobs: newActiveJobs,
                        completedJobs: newCompletedJobs,
                        archiveRestoration: newRestoration,
                        unlockedFiles: newUnlockedFiles,
                        activeAlert: newAlert,
                    };
                }
                return prev;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        localStorage.setItem('latham_journals_state', JSON.stringify(gameState));
    }, [gameState]);

    // Codex Agents Automation Loop
    useEffect(() => {
        const interval = setInterval(() => {
            setGameState(prev => {
                if (prev.codexAgents.length === 0) return prev;

                let nextState = { ...prev };
                let cuRemaining = prev.computeUnits;
                let currentClutter = prev.systemClutter;

                const updatedAgents = prev.codexAgents.map(agent => {
                    // Step 0: Refill Budget
                    const refill = agent.refillRate || 0;
                    const maxB = agent.maxBudget || 0;
                    const currentB = agent.budget || 0;
                    let agentBudget = Math.min(maxB, currentB + refill);

                    if (agent.strategy === 'disabled') {
                        return { ...agent, budget: agentBudget, lastAction: 'OFFLINE' };
                    }
                    
                    const stats = nextState.crawlerStats;
                    const getCost = (stat: any) => {
                        const level = stat === 'baseDmg' ? stats.baseDmg - 3 :
                                     stat === 'maxHpBoost' ? stats.maxHpBoost / 5 :
                                     stat === 'speedBoost' ? stats.speedBoost :
                                     stat === 'minerYield' ? stats.minerYield - 3 :
                                     stats.maxBreachWindows - 1;
                        if (stat === 'maxBreachWindows') return 250 + (level * 500);
                        if (stat === 'speedBoost') return 100 + (level * 100);
                        if (stat === 'minerYield') return 150 + (level * 50);
                        return 50 + (level * 25);
                    };

                    const statKeys: ('baseDmg' | 'maxHpBoost' | 'speedBoost' | 'maxBreachWindows')[] = 
                        ['baseDmg', 'maxHpBoost', 'speedBoost', 'maxBreachWindows'];
                    
                    let targetStat: typeof statKeys[number] | null = null;
                    let lastAction = agent.lastAction || 'IDLE';

                    // Budget Usage Logic: Prioritize agent budget, then check main wallet if budget is 0
                    const canAfford = (cost: number) => {
                        if (agentBudget >= cost) {
                            return { possible: true, useBudget: true };
                        }
                        // If agent has no budget capacity defined, fall back to main wallet
                        if (maxB === 0 && cuRemaining >= cost) {
                            return { possible: true, useBudget: false };
                        }
                        return { possible: false, useBudget: false };
                    };

                    if (agent.strategy === 'defrag') {
                        const cost = 50;
                        const afford = canAfford(cost);
                        if (currentClutter > 0 && afford.possible) {
                            if (afford.useBudget) agentBudget -= cost;
                            else cuRemaining -= cost;
                            currentClutter = Math.max(0, currentClutter - 5);
                            lastAction = 'DEFRAGGING (-5.0%)';
                        } else {
                            lastAction = currentClutter === 0 ? 'SYSTEM CLEAN' : 'WAITING FOR FUNDS';
                        }
                    } else if (agent.strategy === 'parallel') {
                        const cost = getCost('maxBreachWindows');
                        if (canAfford(cost).possible) targetStat = 'maxBreachWindows';
                    } else if (agent.strategy === 'responsible') {
                        if (stats.maxHpBoost < 50 && canAfford(getCost('maxHpBoost')).possible) targetStat = 'maxHpBoost';
                        else if (canAfford(getCost('maxBreachWindows')).possible) targetStat = 'maxBreachWindows';
                        else if (canAfford(getCost('baseDmg')).possible) targetStat = 'baseDmg';
                    } else if (agent.strategy === 'brave') {
                        if (canAfford(getCost('baseDmg')).possible) targetStat = 'baseDmg';
                        else if (canAfford(getCost('speedBoost')).possible) targetStat = 'speedBoost';
                        else if (canAfford(getCost('maxBreachWindows')).possible) targetStat = 'maxBreachWindows';
                    } else if (agent.strategy === 'random') {
                        const affordable = statKeys.filter(k => canAfford(getCost(k)).possible);
                        if (affordable.length > 0) targetStat = affordable[Math.floor(Math.random() * affordable.length)];
                    } else if (agent.strategy === 'scrapper') {
                        if (nextState.activeBrickedNode) {
                            const node = nextState.activeBrickedNode;
                            // Scrapper adds to main wallet (or budget?) 
                            // Request said "won't draw from the main wallet", didn't specify scrapper earnings.
                            // I'll keep scrapper adding to main wallet as it's a "gain" not a "draw".
                            cuRemaining += node.scrapValue;
                            nextState = { ...nextState, activeBrickedNode: null };
                            lastAction = `SCRAPPED NODE [${node.id.slice(-4)}]`;
                        } else {
                            lastAction = 'SEARCHING FOR SCRAP';
                        }
                    } else if (agent.strategy === 'mechanic') {
                        if (nextState.activeBrickedNode) {
                            const node = nextState.activeBrickedNode;
                            const afford = canAfford(node.repairCost);
                            if (afford.possible) {
                                if (afford.useBudget) agentBudget -= node.repairCost;
                                else cuRemaining -= node.repairCost;
                                nextState = { 
                                    ...nextState, 
                                    activeBrickedNode: null, 
                                    repairingNodes: [...nextState.repairingNodes, { 
                                        nodeId: node.id, 
                                        startTime: Date.now(), 
                                        durationMs: node.repairTimeMs, 
                                        rewardType: node.rewardType 
                                    }]
                                };
                                lastAction = `REPAIRING NODE [${node.id.slice(-4)}]`;
                            } else {
                                lastAction = `NEED ${node.repairCost} CU`;
                            }
                        } else {
                            lastAction = 'MONITORING SYSTEMS';
                        }
                    }

                    if (targetStat) {
                        const cost = getCost(targetStat);
                        const afford = canAfford(cost);
                        if (afford.possible) {
                            if (afford.useBudget) agentBudget -= cost;
                            else cuRemaining -= cost;
                            
                            const newStats = { ...nextState.crawlerStats };
                            if (targetStat === 'baseDmg') newStats.baseDmg += 1;
                            if (targetStat === 'maxHpBoost') newStats.maxHpBoost += 5;
                            if (targetStat === 'speedBoost') newStats.speedBoost += 1;
                            if (targetStat === 'maxBreachWindows') newStats.maxBreachWindows += 1;
                            
                            nextState = { ...nextState, crawlerStats: newStats };
                            lastAction = `UPGRADING ${targetStat.toUpperCase()}`;
                        } else {
                            lastAction = `SAVING FOR ${targetStat.toUpperCase()}`;
                        }
                    } else if (agent.strategy !== 'defrag' && agent.strategy !== 'scrapper' && agent.strategy !== 'mechanic') {
                        lastAction = 'MONITORING';
                    }

                    return { ...agent, budget: agentBudget, lastAction };
                });

                return { 
                    ...nextState, 
                    codexAgents: updatedAgents, 
                    computeUnits: cuRemaining,
                    systemClutter: currentClutter
                };
            });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const unlockFile = useCallback((fileId: string) => {
        setGameState(prev => {
            const current = prev.unlockedFiles || [];
            if (current.includes(fileId)) return prev;
            return {
                ...prev,
                unlockedFiles: [...current, fileId],
            };
        });
    }, []);

    const markFileAsRead = useCallback((fileId: string) => {
        setGameState(prev => {
            const current = prev.readFiles || [];
            if (current.includes(fileId)) return prev;
            return {
                ...prev,
                readFiles: [...current, fileId],
            };
        });
    }, []);


    const resetGame = useCallback(() => {
        setGameState(defaultState);
    }, []);

    const unlockSystem = useCallback((password: string) => {
        if (password === '00000') {
            setGameState(prev => ({ ...prev, isSystemUnlocked: true }));
            return true;
        }
        return false;
    }, []);

    const addRestoration = useCallback((amount: number) => {
        setGameState(prev => {
            let newRestoration = prev.archiveRestoration + amount;
            if (newRestoration > 100) newRestoration = 100;

            return { ...prev, archiveRestoration: newRestoration };
        });
    }, []);

    const startJob = useCallback((jobId: string) => {
        let started = false;
        setGameState(prev => {
            if (prev.activeJobs.some(j => j.id === jobId) || prev.completedJobs.includes(jobId)) {
                return prev;
            }
            started = true;
            return {
                ...prev,
                activeJobs: [...prev.activeJobs, { id: jobId, startTime: Date.now() }]
            };
        });
        return started;
    }, []);

    const compileNode = useCallback((nodeId: string) => {
        setGameState(prev => {
            if (prev.compiledNodes.includes(nodeId)) return prev;

            let newRestoration = prev.archiveRestoration + 25; // Tactile matches give massive restoration
            if (newRestoration > 100) newRestoration = 100;

            return {
                ...prev,
                archiveRestoration: newRestoration,
                compiledNodes: [...prev.compiledNodes, nodeId]
            };
        });
    }, []);

    const addComputeUnits = useCallback((amount: number) => {
        setGameState(prev => {
            const current = isNaN(prev.computeUnits) ? 0 : prev.computeUnits;
            const toAdd = isNaN(amount) ? 0 : amount;
            return { ...prev, computeUnits: current + toAdd };
        });
    }, []);

    const spendComputeUnits = useCallback((amount: number) => {
        let success = false;
        setGameState(prev => {
            if (prev.computeUnits >= amount) {
                success = true;
                return { ...prev, computeUnits: prev.computeUnits - amount };
            }
            return prev;
        });
        return success;
    }, []);

    const getUpgradeCost = useCallback((stat: 'baseDmg' | 'maxHpBoost' | 'speedBoost' | 'maxBreachWindows' | 'minerYield') => {
        const stats = gameState.crawlerStats;
        const baseMinerYield = stats.minerYield || 3;
        const level = stat === 'baseDmg' ? stats.baseDmg - 3 :
                     stat === 'maxHpBoost' ? stats.maxHpBoost / 5 :
                     stat === 'speedBoost' ? stats.speedBoost :
                     stat === 'minerYield' ? baseMinerYield - 3 :
                     stats.maxBreachWindows - 1;

        if (stat === 'maxBreachWindows') return 250 + (level * 500);
        if (stat === 'speedBoost') return 100 + (level * 100);
        if (stat === 'minerYield') return 150 + (level * 50);
        return 50 + (level * 25);
    }, [gameState.crawlerStats]);

    const upgradeCrawler = useCallback((stat: 'baseDmg' | 'maxHpBoost' | 'speedBoost' | 'maxBreachWindows' | 'minerYield') => {
        setGameState(prev => {
            const stats = prev.crawlerStats;
            const baseMinerYield = stats.minerYield || 3;
            const level = stat === 'baseDmg' ? stats.baseDmg - 3 :
                         stat === 'maxHpBoost' ? stats.maxHpBoost / 5 :
                         stat === 'speedBoost' ? stats.speedBoost :
                         stat === 'minerYield' ? baseMinerYield - 3 :
                         stats.maxBreachWindows - 1;

            let cost = 0;
            if (stat === 'maxBreachWindows') cost = 250 + (level * 500);
            else if (stat === 'speedBoost') cost = 100 + (level * 100);
            else if (stat === 'minerYield') cost = 150 + (level * 50);
            else cost = 50 + (level * 25);

            if (prev.computeUnits < cost) return prev;

            const currentStats = { ...prev.crawlerStats };
            if (stat === 'baseDmg') currentStats.baseDmg += 1;
            if (stat === 'maxHpBoost') currentStats.maxHpBoost += 5;
            if (stat === 'speedBoost') currentStats.speedBoost += 1;
            if (stat === 'maxBreachWindows') currentStats.maxBreachWindows += 1;
            if (stat === 'minerYield') currentStats.minerYield += 1;

            return {
                ...prev,
                computeUnits: prev.computeUnits - cost,
                crawlerStats: currentStats
            };
        });
    }, []);

    const addCodexAgent = useCallback((strategy: 'responsible' | 'brave' | 'random' | 'disabled' | 'parallel' | 'defrag' | 'scrapper' | 'mechanic') => {
        setGameState(prev => {
            const agentCount = prev.codexAgents.length;
            const cost = 500 + (agentCount * 1000);
            if (prev.computeUnits < cost) return prev;

            const id = `agent-${Date.now()}`;
            const name = `AGENT_${agentCount + 1}`;
            return {
                ...prev,
                computeUnits: prev.computeUnits - cost,
                codexAgents: [...prev.codexAgents, { 
                    id, 
                    name, 
                    strategy, 
                    lastAction: 'INITIALIZING...', 
                    budget: 0, 
                    maxBudget: 0, 
                    refillRate: 0 
                }]
            };
        });
    }, []);

    const setAgentStrategy = useCallback((id: string, strategy: 'responsible' | 'brave' | 'random' | 'disabled' | 'parallel' | 'defrag' | 'scrapper' | 'mechanic') => {
        setGameState(prev => ({
            ...prev,
            codexAgents: prev.codexAgents.map(a => a.id === id ? { ...a, strategy } : a)
        }));
    }, []);

    const toggleAgentsPinned = useCallback(() => {
        setGameState(prev => ({ ...prev, isAgentsPinned: !prev.isAgentsPinned }));
    }, []);
    
    const toggleWalletsPinned = useCallback(() => {
        setGameState(prev => ({ ...prev, isWalletsPinned: !prev.isWalletsPinned }));
    }, []);

    const toggleMetaMapPinned = useCallback(() => {
        setGameState(prev => ({ ...prev, isMetaMapPinned: !prev.isMetaMapPinned }));
    }, []);

    const toggleTerminalPinned = useCallback(() => {
        setGameState(prev => ({ ...prev, isTerminalPinned: !prev.isTerminalPinned }));
    }, []);

    const setTerminalInput = useCallback((terminalInput: string) => {
        setGameState(prev => ({ ...prev, terminalInput }));
    }, []);

    const setTerminalHistory = useCallback((history: LogEntry[] | ((prev: LogEntry[]) => LogEntry[])) => {
        setGameState(prev => ({
            ...prev,
            terminalHistory: typeof history === 'function' ? history(prev.terminalHistory) : history
        }));
    }, []);

    const updatePinnedPosition = useCallback((id: string, x: number, y: number) => {
        setGameState(prev => ({
            ...prev,
            pinnedPositions: {
                ...prev.pinnedPositions,
                [id]: { x, y }
            }
        }));
    }, []);

    const setAgentBudget = useCallback((id: string, maxBudget: number) => {
        setGameState(prev => ({
            ...prev,
            codexAgents: prev.codexAgents.map(a => a.id === id ? { ...a, maxBudget, budget: Math.min(a.budget, maxBudget) } : a)
        }));
    }, []);

    const setAgentRefillRate = useCallback((id: string, refillRate: number) => {
        setGameState(prev => ({
            ...prev,
            codexAgents: prev.codexAgents.map(a => a.id === id ? { ...a, refillRate } : a)
        }));
    }, []);

    const triggerAlert = useCallback((title: string, message: string, type: 'info' | 'warning' | 'critical' = 'info') => {
        setGameState(prev => ({
            ...prev,
            activeAlert: { id: `alert-${Date.now()}`, title, message, type }
        }));
    }, []);

    const dismissAlert = useCallback(() => {
        setGameState(prev => ({ ...prev, activeAlert: null }));
    }, []);

    const getJobProgress = useCallback((jobId: string) => {
        const activeJob = gameState.activeJobs.find(j => j.id === jobId);
        if (!activeJob) return gameState.completedJobs.includes(jobId) ? 100 : 0;

        const jobDef = jobsData.find(j => j.id === jobId);
        if (!jobDef) return 0;

        const elapsed = Date.now() - activeJob.startTime;
        return Math.min(100, Math.floor((elapsed / jobDef.durationMS) * 100));
    }, [gameState.activeJobs, gameState.completedJobs]);

    const isJobActive = useCallback((jobId: string) => gameState.activeJobs.some(j => j.id === jobId), [gameState.activeJobs]);
    const isJobCompleted = useCallback((jobId: string) => gameState.completedJobs.includes(jobId), [gameState.completedJobs]);

    // === NEW MECHANIC METHODS ===

    const addCipherFragment = useCallback((fragment: CipherFragment) => {
        setGameState(prev => ({
            ...prev,
            cipherFragments: [...prev.cipherFragments, fragment]
        }));
    }, []);

    const attemptCipherUnlock = useCallback((input: string, password: string) => {
        const cipher = CIPHER_DEFINITIONS.find(c => 
            c.id.toLowerCase() === input.toLowerCase() || 
            c.name.toLowerCase() === input.toLowerCase()
        );
        if (!cipher || !validateCipherPassword(cipher.id, password)) return false;

        setGameState(prev => {
            if (prev.unlockedCiphers.includes(cipher.id)) return prev;
            const newUnlocked = [...prev.unlockedFiles];
            if (cipher.rewardFileId && !newUnlocked.includes(cipher.rewardFileId)) {
                newUnlocked.push(cipher.rewardFileId);
            }
            return {
                ...prev,
                unlockedCiphers: [...prev.unlockedCiphers, cipher.id],
                unlockedFiles: newUnlocked,
                activeAlert: { id: `alert-${Date.now()}`, title: 'CIPHER CRACKED', message: `Protocol ${cipher.name} decrypted. New archive file unlocked.`, type: 'info' }
            };
        });
        return true;
    }, []);

    const getDegradation = useCallback((): DegradationMultipliers => {
        return getDegradationMultipliers(gameState.systemClutter);
    }, [gameState.systemClutter]);

    const reduceClutter = useCallback((amount: number) => {
        const cost = getDefragCost(amount);
        let success = false;
        setGameState(prev => {
            if (prev.computeUnits < cost) return prev;
            success = true;
            return {
                ...prev,
                computeUnits: prev.computeUnits - cost,
                systemClutter: Math.max(0, prev.systemClutter - amount)
            };
        });
        return success;
    }, []);

    const initiateRefactor = useCallback((bonusType: RefactorBonus['type']) => {
        let success = false;
        setGameState(prev => {
            if (prev.computeUnits < 100) return prev; // Minimum 100 CU to refactor
            success = true;
            const sacrificed = prev.computeUnits;
            const totalSac = prev.totalCUSacrificed + sacrificed;

            // Bonus amount scales with sacrifice
            let bonusAmount = 0.05;
            if (totalSac > 2000) bonusAmount = 0.15;
            else if (totalSac > 500) bonusAmount = 0.10;

            const newBonus: RefactorBonus = {
                id: `refactor-${Date.now()}`,
                type: bonusType,
                amount: bonusAmount
            };

            return {
                ...prev,
                computeUnits: 0,
                systemClutter: 0,
                sessionStartTime: Date.now(),
                refactorCount: prev.refactorCount + 1,
                refactorBonuses: [...prev.refactorBonuses, newBonus],
                totalCUSacrificed: totalSac,
                crawlerStats: { ...defaultState.crawlerStats },
                activeAlert: { id: `alert-${Date.now()}`, title: 'SYSTEM REFACTORED', message: `Refactor #${prev.refactorCount + 1} complete. +${(bonusAmount * 100).toFixed(0)}% ${bonusType} bonus acquired.`, type: 'info' }
            };
        });
        return success;
    }, []);

    const scrapBrickedNode = useCallback(() => {
        setGameState(prev => {
            if (!prev.activeBrickedNode) return prev;
            const value = prev.activeBrickedNode.scrapValue;
            return {
                ...prev,
                computeUnits: prev.computeUnits + value,
                activeBrickedNode: null,
                activeAlert: { id: `alert-${Date.now()}`, title: 'NODE SCRAPPED', message: `+${value} CU recovered from salvage.`, type: 'info' }
            };
        });
    }, []);

    const repairBrickedNode = useCallback(() => {
        let success = false;
        setGameState(prev => {
            if (!prev.activeBrickedNode) return prev;
            const node = prev.activeBrickedNode;
            if (prev.computeUnits < node.repairCost) return prev;
            success = true;
            return {
                ...prev,
                computeUnits: prev.computeUnits - node.repairCost,
                activeBrickedNode: null,
                repairingNodes: [...prev.repairingNodes, {
                    nodeId: node.id,
                    startTime: Date.now(),
                    durationMs: node.repairTimeMs,
                    rewardType: node.rewardType
                }]
            };
        });
        return success;
    }, []);

    const setDefaultSpec = useCallback((spec: CrawlerSpec) => {
        setGameState(prev => ({ ...prev, defaultCrawlerSpec: spec }));
    }, []);

    const getCipherProgress = useCallback(() => {
        return CIPHER_DEFINITIONS.map(cd => ({
            cipherId: cd.id,
            name: cd.name,
            found: gameState.cipherFragments.filter(f => f.cipherId === cd.id).length,
            required: cd.requiredFragments
        }));
    }, [gameState.cipherFragments]);

    const setActiveBrickedNode = useCallback((node: BrickedNode | null) => {
        setGameState(prev => ({ ...prev, activeBrickedNode: node }));
    }, []);

    // Degradation growth timer + repair completion checker
    useEffect(() => {
        const interval = setInterval(() => {
            setGameState(prev => {
                const clutterGrowth = calculateClutterGrowth(prev.sessionStartTime, Date.now());
                const newClutter = Math.min(100, clutterGrowth);

                // Check for completed repairs
                const now = Date.now();
                const done: RepairJob[] = [];
                const remaining: RepairJob[] = [];
                prev.repairingNodes.forEach(rj => {
                    if (now - rj.startTime >= rj.durationMs) done.push(rj);
                    else remaining.push(rj);
                });

                let newFragments = [...prev.cipherFragments];
                let newAlert = prev.activeAlert;
                let cuBonus = 0;

                done.forEach(rj => {
                    if (rj.rewardType === 'cipher') {
                        const fragment = rollCipherDrop(1.0, newFragments, 'repaired-node');
                        if (fragment) {
                            newFragments = [...newFragments, fragment];
                            newAlert = { id: `alert-${Date.now()}`, title: 'REPAIR COMPLETE', message: `Cipher fragment recovered: "${fragment.content}"`, type: 'info' };
                        }
                    } else {
                        cuBonus += 200;
                        newAlert = { id: `alert-${Date.now()}`, title: 'REPAIR COMPLETE', message: `Node repaired. +200 CU bonus.`, type: 'info' };
                    }
                });

                if (newClutter !== prev.systemClutter || done.length > 0) {
                    return {
                        ...prev,
                        systemClutter: newClutter,
                        repairingNodes: remaining,
                        cipherFragments: newFragments,
                        computeUnits: prev.computeUnits + cuBonus,
                        activeAlert: done.length > 0 ? newAlert : prev.activeAlert
                    };
                }
                return prev;
            });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <GameStateContext.Provider value={{
            ...gameState,
            unlockFile, markFileAsRead, resetGame, unlockSystem,
            addRestoration, startJob, compileNode,
            addComputeUnits, spendComputeUnits, upgradeCrawler, 
            addCodexAgent, setAgentStrategy, getUpgradeCost,
            triggerAlert, dismissAlert,
            getJobProgress, isJobActive, isJobCompleted,
            addCipherFragment, attemptCipherUnlock, getDegradation,
            reduceClutter, initiateRefactor, scrapBrickedNode,
            repairBrickedNode, setDefaultSpec, getCipherProgress,
            setActiveBrickedNode, toggleAgentsPinned, toggleWalletsPinned, toggleMetaMapPinned,
            toggleTerminalPinned, setTerminalInput, setTerminalHistory,
            setAgentBudget, setAgentRefillRate, updatePinnedPosition
        }}>
            {children}
        </GameStateContext.Provider>
    );
};

export const useGameState = () => {
    const context = useContext(GameStateContext);
    if (!context) {
        throw new Error('useGameState must be used within a GameStateProvider');
    }
    return context;
};
