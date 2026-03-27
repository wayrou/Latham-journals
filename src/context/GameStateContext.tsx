import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { jobsData } from '../data/jobs';

interface GameState {
    unlockedFiles: string[];
    readFiles: string[];
    clearanceLevel: number;
    isSystemUnlocked: boolean;
    archiveRestoration: number;
    activeJobs: { id: string; startTime: number }[];
    completedJobs: string[];
    compiledNodes: string[];
    fragments: number;
    crawlerStats: { baseDmg: number; maxHpBoost: number };
    activeAlert: { id: string; title: string; message: string; type: 'info' | 'warning' | 'critical' } | null;
}

interface GameStateContextType extends GameState {
    unlockFile: (fileId: string) => void;
    markFileAsRead: (fileId: string) => void;
    setClearance: (level: number) => void;
    resetGame: () => void;
    unlockSystem: (password: string) => boolean;
    addRestoration: (amount: number) => void;
    startJob: (jobId: string) => boolean;
    compileNode: (nodeId: string) => void;
    addFragments: (amount: number) => void;
    spendFragments: (amount: number) => boolean;
    upgradeCrawler: (stat: 'baseDmg' | 'maxHpBoost') => void;
    triggerAlert: (title: string, message: string, type?: 'info' | 'warning' | 'critical') => void;
    dismissAlert: () => void;
    getJobProgress: (jobId: string) => number;
    isJobActive: (jobId: string) => boolean;
    isJobCompleted: (jobId: string) => boolean;
}

const defaultState: GameState = {
    unlockedFiles: [],
    readFiles: [],
    clearanceLevel: 1,
    isSystemUnlocked: false,
    archiveRestoration: 0,
    activeJobs: [],
    completedJobs: [],
    compiledNodes: [],
    fragments: 0,
    crawlerStats: { baseDmg: 3, maxHpBoost: 0 },
    activeAlert: null,
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
                    fragments: Number(parsed.fragments) || 0,
                    archiveRestoration: Number(parsed.archiveRestoration) || 0,
                    clearanceLevel: Number(parsed.clearanceLevel) || 1,
                    crawlerStats: parsed.crawlerStats && typeof parsed.crawlerStats.baseDmg === 'number'
                        ? parsed.crawlerStats
                        : { baseDmg: 3, maxHpBoost: 0 },
                    activeAlert: null
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

                    // Auto-Clearance Upgrades
                    let newClearance = prev.clearanceLevel;
                    if (newRestoration >= 30 && newClearance < 2) newClearance = 2;
                    if (newRestoration >= 75 && newClearance < 3) newClearance = 3;

                    return {
                        ...prev,
                        activeJobs: newActiveJobs,
                        completedJobs: newCompletedJobs,
                        archiveRestoration: newRestoration,
                        clearanceLevel: newClearance,
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

    const unlockFile = (fileId: string) => {
        setGameState(prev => {
            const current = prev.unlockedFiles || [];
            if (current.includes(fileId)) return prev;
            return {
                ...prev,
                unlockedFiles: [...current, fileId],
            };
        });
    };

    const markFileAsRead = (fileId: string) => {
        setGameState(prev => {
            const current = prev.readFiles || [];
            if (current.includes(fileId)) return prev;
            return {
                ...prev,
                readFiles: [...current, fileId],
            };
        });
    };

    const setClearance = (level: number) => {
        setGameState(prev => ({ ...prev, clearanceLevel: level }));
    };

    const resetGame = () => {
        setGameState(defaultState);
    };

    const unlockSystem = (password: string) => {
        if (password === '00000') {
            setGameState(prev => ({ ...prev, isSystemUnlocked: true }));
            return true;
        }
        return false;
    };

    const addRestoration = (amount: number) => {
        setGameState(prev => {
            let newRestoration = prev.archiveRestoration + amount;
            if (newRestoration > 100) newRestoration = 100;

            let newClearance = prev.clearanceLevel;
            if (newRestoration >= 30 && newClearance < 2) newClearance = 2;
            if (newRestoration >= 75 && newClearance < 3) newClearance = 3;

            return { ...prev, archiveRestoration: newRestoration, clearanceLevel: newClearance };
        });
    };

    const startJob = (jobId: string) => {
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
    };

    const compileNode = (nodeId: string) => {
        setGameState(prev => {
            if (prev.compiledNodes.includes(nodeId)) return prev;

            let newRestoration = prev.archiveRestoration + 25; // Tactile matches give massive restoration
            if (newRestoration > 100) newRestoration = 100;

            let newClearance = prev.clearanceLevel;
            if (newRestoration >= 30 && newClearance < 2) newClearance = 2;
            if (newRestoration >= 75 && newClearance < 3) newClearance = 3;

            return {
                ...prev,
                archiveRestoration: newRestoration,
                clearanceLevel: newClearance,
                compiledNodes: [...prev.compiledNodes, nodeId]
            };
        });
    };

    const addFragments = (amount: number) => {
        setGameState(prev => ({ ...prev, fragments: prev.fragments + amount }));
    };

    const spendFragments = (amount: number) => {
        let success = false;
        setGameState(prev => {
            if (prev.fragments >= amount) {
                success = true;
                return { ...prev, fragments: prev.fragments - amount };
            }
            return prev;
        });
        return success;
    };

    const upgradeCrawler = (stat: 'baseDmg' | 'maxHpBoost') => {
        setGameState(prev => {
            const currentStats = { ...prev.crawlerStats };
            if (stat === 'baseDmg') currentStats.baseDmg += 1;
            if (stat === 'maxHpBoost') currentStats.maxHpBoost += 5;

            return {
                ...prev,
                crawlerStats: currentStats
            };
        });
    };

    const triggerAlert = (title: string, message: string, type: 'info' | 'warning' | 'critical' = 'info') => {
        setGameState(prev => ({
            ...prev,
            activeAlert: { id: `alert-${Date.now()}`, title, message, type }
        }));
    };

    const dismissAlert = () => {
        setGameState(prev => ({ ...prev, activeAlert: null }));
    };

    const getJobProgress = (jobId: string) => {
        const activeJob = gameState.activeJobs.find(j => j.id === jobId);
        if (!activeJob) return gameState.completedJobs.includes(jobId) ? 100 : 0;

        const jobDef = jobsData.find(j => j.id === jobId);
        if (!jobDef) return 0;

        const elapsed = Date.now() - activeJob.startTime;
        return Math.min(100, Math.floor((elapsed / jobDef.durationMS) * 100));
    };

    const isJobActive = (jobId: string) => gameState.activeJobs.some(j => j.id === jobId);
    const isJobCompleted = (jobId: string) => gameState.completedJobs.includes(jobId);

    return (
        <GameStateContext.Provider value={{
            ...gameState,
            unlockFile, markFileAsRead, setClearance, resetGame, unlockSystem,
            addRestoration, startJob, compileNode,
            addFragments, spendFragments, upgradeCrawler, triggerAlert, dismissAlert,
            getJobProgress, isJobActive, isJobCompleted
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
