import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { jobsData } from '../data/jobs';
import { type CipherFragment, rollCipherDrop, validateCipherPassword, CIPHER_DEFINITIONS } from '../utils/cipherSystem';
import { getDegradationMultipliers, calculateClutterGrowth, getDefragCost, type DegradationMultipliers } from '../utils/degradation';

export type CrawlerSpec = 'fighter' | 'rogue' | 'miner' | 'summoner' | 'explorer';
export type OSModuleId =
    | 'claim-authority'
    | 'scheduler-kernel'
    | 'logistics-mesh'
    | 'memory-compression'
    | 'deep-scan-bus';

export interface OSModuleDefinition {
    id: OSModuleId;
    name: string;
    description: string;
    maxLevel: number;
    baseCost: number;
}

export const OS_MODULE_DEFINITIONS: OSModuleDefinition[] = [
    {
        id: 'claim-authority',
        name: 'CLAIM AUTHORITY',
        description: 'Raises the number of breach floors you can hold as managed territory.',
        maxLevel: 4,
        baseCost: 4
    },
    {
        id: 'scheduler-kernel',
        name: 'SCHEDULER KERNEL',
        description: 'Manager agents coordinate folders and floor advances more efficiently.',
        maxLevel: 5,
        baseCost: 3
    },
    {
        id: 'logistics-mesh',
        name: 'LOGISTICS MESH',
        description: 'Builders and infrastructure installs consume fewer resources.',
        maxLevel: 5,
        baseCost: 4
    },
    {
        id: 'memory-compression',
        name: 'MEMORY COMPRESSION',
        description: 'Slows ongoing clutter growth across the whole operating system.',
        maxLevel: 4,
        baseCost: 5
    },
    {
        id: 'deep-scan-bus',
        name: 'DEEP SCAN BUS',
        description: 'Scanner towers reveal more rooms and relay uplinks accelerate floor activity.',
        maxLevel: 4,
        baseCost: 4
    }
];

const DUNGEON_STATE_STORAGE_KEY = 'latham_dungeon_state';
const DUNGEON_PRESSURE_STORAGE_KEY = 'latham_dungeon_pressure_state';

function getDungeonPressureSnapshot() {
    try {
        const summary = localStorage.getItem(DUNGEON_PRESSURE_STORAGE_KEY);
        if (summary) {
            const parsedSummary = JSON.parse(summary);
            const deepestFloor = Number(parsedSummary?.deepestFloor) || 1;
            const breachCount = Number(parsedSummary?.breachCount) || 0;
            const claimedFloorCount = Number(parsedSummary?.claimedFloorCount) || 0;
            const tokenMintCount = Number(parsedSummary?.tokenMintCount) || 0;
            return {
                deepestFloor,
                breachCount,
                claimedFloorCount,
                tokenMintCount
            };
        }

        const saved = localStorage.getItem(DUNGEON_STATE_STORAGE_KEY);
        if (!saved) {
            return {
                deepestFloor: 1,
                breachCount: 0,
                claimedFloorCount: 0,
                tokenMintCount: 0
            };
        }
        const parsed = JSON.parse(saved);
        const floorMaps = parsed?.floorMaps;
        const breaches = Array.isArray(parsed?.breaches) ? parsed.breaches : [];
        const claimedFloors = Array.isArray(parsed?.claimedFloors) ? parsed.claimedFloors : [];
        const tokenMintCount = claimedFloors.reduce((total: number, floor: any) => {
            const infrastructure = Array.isArray(floor?.infrastructure) ? floor.infrastructure : [];
            return total + infrastructure.filter((item: any) => item?.type === 'token-mint').length;
        }, 0);

        if (!floorMaps || typeof floorMaps !== 'object') {
            return {
                deepestFloor: 1,
                breachCount: breaches.length,
                claimedFloorCount: claimedFloors.length,
                tokenMintCount
            };
        }

        const floors = Object.keys(floorMaps)
            .map(Number)
            .filter(Number.isFinite);

        return {
            deepestFloor: floors.length > 0 ? Math.max(...floors) : 1,
            breachCount: breaches.length,
            claimedFloorCount: claimedFloors.length,
            tokenMintCount
        };
    } catch {
        return {
            deepestFloor: 1,
            breachCount: 0,
            claimedFloorCount: 0,
            tokenMintCount: 0
        };
    }
}

const DEFAULT_OS_MODULES: Record<OSModuleId, number> = {
    'claim-authority': 0,
    'scheduler-kernel': 0,
    'logistics-mesh': 0,
    'memory-compression': 0,
    'deep-scan-bus': 0
};

export const getOSModuleDefinition = (id: OSModuleId) =>
    OS_MODULE_DEFINITIONS.find(module => module.id === id);

export const getOSModuleCostForLevel = (id: OSModuleId, level: number) => {
    const definition = getOSModuleDefinition(id);
    if (!definition) return 0;
    return definition.baseCost * (level + 1);
};

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

export interface OpsLedgerEntry {
    id: string;
    timestamp: number;
    type: 'claim' | 'build' | 'advance' | 'crawler' | 'token' | 'income' | 'system';
    message: string;
    floor?: number;
    amountCU?: number;
    amountTokens?: number;
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
    protocolTokens: number;
    crawlerStats: { baseDmg: number; maxHpBoost: number; speedBoost: number; maxBreachWindows: number; minerYield: number };
    codexAgents: { 
        id: string; 
        name: string; 
        nickname?: string;
        strategy: 'responsible' | 'brave' | 'disabled' | 'parallel' | 'defrag' | 'scrapper' | 'mechanic' | 'manager' | 'builder'; 
        assignedDepartmentId?: string;
        lastAction?: string;
        budget: number;
        maxBudget: number;
        refillRate: number;
    }[];
    isAgentsPinned: boolean;
    isWalletsPinned: boolean;
    isMetaMapPinned: boolean;
    isDepartmentsPinned: boolean;
    isBuildPinned: boolean;
    isBreachCliPinned: boolean;
    isLedgerPinned: boolean;
    isModulesPinned: boolean;
    isTerminalPinned: boolean;
    isInboxPinned: boolean;
    isArchivePinned: boolean;
    isMainContentMinimized: boolean;
    notificationsEnabled: boolean;
    opsLedger: OpsLedgerEntry[];
    osModules: Record<OSModuleId, number>;
    breachCliHistory: string[];
    breachCliInput: string;
    terminalHistory: LogEntry[];
    terminalInput: string;
    activeAlert: { id: string; title: string; message: string; type: 'info' | 'warning' | 'critical' } | null;
    // Cipher system
    cipherFragments: CipherFragment[];
    unlockedCiphers: string[];
    // Degradation
    systemClutter: number;
    runCollapseCount: number;
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
    menuButtonOrder: string[];
    pinnedPositions: Record<string, { x: number; y: number }>;
    pinnedSizes: Record<string, { width: number; height: number }>;
}

interface GameStateContextType extends GameState {
    unlockFile: (fileId: string) => void;
    markFileAsRead: (fileId: string) => void;
    resetGame: () => void;
    unlockSystem: (password: string) => boolean;
    addRestoration: (amount: number) => void;
    setArchiveRestoration: (amount: number) => void;
    startJob: (jobId: string) => boolean;
    compileNode: (nodeId: string) => void;
    addComputeUnits: (amount: number) => void;
    spendComputeUnits: (amount: number) => boolean;
    addProtocolTokens: (amount: number, reason?: string) => void;
    spendProtocolTokens: (amount: number) => boolean;
    upgradeCrawler: (stat: 'baseDmg' | 'maxHpBoost' | 'speedBoost' | 'maxBreachWindows' | 'minerYield') => boolean;
    upgradeCrawlerBulk: (stat: 'baseDmg' | 'maxHpBoost' | 'speedBoost' | 'maxBreachWindows' | 'minerYield', quantity?: number | 'max') => number;
    addCodexAgent: (strategy: 'responsible' | 'brave' | 'disabled' | 'parallel' | 'defrag' | 'scrapper' | 'mechanic' | 'manager' | 'builder') => boolean;
    setAgentStrategy: (id: string, strategy: 'responsible' | 'brave' | 'disabled' | 'parallel' | 'defrag' | 'scrapper' | 'mechanic' | 'manager' | 'builder') => void;
    assignAgentDepartment: (id: string, departmentId?: string) => void;
    setAgentNickname: (id: string, nickname: string) => void;
    setAgentBudget: (id: string, maxBudget: number) => void;
    setAgentRefillRate: (id: string, refillRate: number) => void;
    toggleAgentsPinned: () => void;
    toggleWalletsPinned: () => void;
    toggleMetaMapPinned: () => void;
    toggleDepartmentsPinned: () => void;
    toggleBuildPinned: () => void;
    toggleBreachCliPinned: () => void;
    toggleLedgerPinned: () => void;
    toggleModulesPinned: () => void;
    toggleTerminalPinned: () => void;
    toggleInboxPinned: () => void;
    toggleArchivePinned: () => void;
    toggleMainContentMinimized: () => void;
    toggleNotificationsEnabled: () => void;
    setNotificationsEnabled: (enabled: boolean) => void;
    setBreachCliInput: (val: string) => void;
    appendBreachCliLine: (line: string) => void;
    clearBreachCliHistory: () => void;
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
    stabilizeClutter: (amount: number) => void;
    initiateRefactor: (bonusType: RefactorBonus['type']) => boolean;
    scrapBrickedNode: () => void;
    repairBrickedNode: () => boolean;
    setDefaultSpec: (spec: CrawlerSpec) => void;
    getCipherProgress: () => { cipherId: string; name: string; found: number; required: number }[];
    setActiveBrickedNode: (node: BrickedNode | null) => void;
    refillAgent: (id: string, amount: number) => number;
    spendAgentFunds: (id: string, amount: number) => boolean;
    setMenuButtonOrder: (order: string[]) => void;
    updatePinnedPosition: (id: string, x: number, y: number) => void;
    updatePinnedSize: (id: string, width: number, height: number) => void;
    recordOpsLedgerEvent: (entry: Omit<OpsLedgerEntry, 'id' | 'timestamp'>) => void;
    clearOpsLedger: () => void;
    getOSModuleLevel: (id: OSModuleId) => number;
    getOSModuleCost: (id: OSModuleId) => number;
    unlockOSModule: (id: OSModuleId) => boolean;
    getMaxClaimCount: () => number;
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
    protocolTokens: 0,
    crawlerStats: { baseDmg: 3, maxHpBoost: 0, speedBoost: 0, maxBreachWindows: 1, minerYield: 3 },
    codexAgents: [],
    isAgentsPinned: false,
    isWalletsPinned: false,
    isMetaMapPinned: false,
    isDepartmentsPinned: false,
    isBuildPinned: false,
    isBreachCliPinned: false,
    isLedgerPinned: false,
    isModulesPinned: false,
    isTerminalPinned: false,
    isInboxPinned: false,
    isArchivePinned: false,
    isMainContentMinimized: false,
    notificationsEnabled: true,
    opsLedger: [],
    osModules: { ...DEFAULT_OS_MODULES },
    breachCliHistory: ['Type "help" for breach commands.'],
    breachCliInput: '',
    terminalHistory: [
        { type: 'system', content: 'PRGN_OS SECURE TERMINAL v4.2.1 CONNECTED.' },
        { type: 'system', content: 'ENTER COMMAND OR "help" FOR SYSTEM ASSISTANCE.' }
    ],
    terminalInput: '',
    activeAlert: null,
    cipherFragments: [],
    unlockedCiphers: [],
    systemClutter: 0,
    runCollapseCount: 0,
    sessionStartTime: Date.now(),
    refactorCount: 0,
    refactorBonuses: [],
    totalCUSacrificed: 0,
    activeBrickedNode: null,
    repairingNodes: [],
    defaultCrawlerSpec: 'fighter',
    menuButtonOrder: ['INBOX', 'ARCHIVE', 'BREACH', 'TERMINAL'],
    pinnedPositions: {
        breach: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 200, y: 20 },
        agents: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 300, y: (typeof window !== 'undefined' ? window.innerHeight : 900) - 300 },
        metamap: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 260, y: 100 },
        departments: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 420, y: 220 },
        build: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 360, y: 180 },
        breachCli: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 470, y: 320 },
        ledger: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 430, y: 120 },
        modules: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 390, y: 150 },
        wallets: { x: (typeof window !== 'undefined' ? window.innerWidth : 1400) - 280, y: 80 },
        terminal: { x: 100, y: 100 },
        inbox: { x: 80, y: 160 },
        archive: { x: 460, y: 160 }
    },
    pinnedSizes: {
        terminal: { width: 400, height: 300 },
        metamap: { width: 240, height: 420 },
        departments: { width: 400, height: 460 },
        build: { width: 340, height: 420 },
        breachCli: { width: 440, height: 240 },
        ledger: { width: 410, height: 320 },
        modules: { width: 360, height: 420 },
        wallets: { width: 280, height: 360 },
        archive: { width: 320, height: 320 }
    }
};

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

const getCrawlerUpgradeCost = (
    stats: GameState['crawlerStats'],
    stat: 'baseDmg' | 'maxHpBoost' | 'speedBoost' | 'maxBreachWindows' | 'minerYield'
) => {
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
};

const createAgentName = (existingAgents: Array<{ name: string }>) => {
    const used = new Set(
        existingAgents
            .map(agent => {
                const match = /^AGENT_(\d{4})$/i.exec(agent.name);
                return match?.[1];
            })
            .filter((value): value is string => !!value)
    );

    for (let attempts = 0; attempts < 1000; attempts += 1) {
        const candidate = `${Math.floor(Math.random() * 10000)}`.padStart(4, '0');
        if (!used.has(candidate)) {
            return `AGENT_${candidate}`;
        }
    }

    return `AGENT_${Date.now().toString().slice(-4).padStart(4, '0')}`;
};

const buildCollapsedRunState = (prev: GameState): GameState => ({
    ...prev,
    computeUnits: 0,
    crawlerStats: { ...defaultState.crawlerStats },
    codexAgents: [],
    systemClutter: 0,
    runCollapseCount: prev.runCollapseCount + 1,
    sessionStartTime: Date.now(),
    activeBrickedNode: null,
    repairingNodes: [],
    activeAlert: {
        id: `alert-${Date.now()}`,
        title: 'SYSTEM COLLAPSE',
        message: 'SYS_CLUTTER EXCEEDED 150%. THE CURRENT BREACH RUN HAS BEEN TERMINATED.',
        type: 'critical'
    }
});

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
                    protocolTokens: Number(parsed.protocolTokens) || 0,
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
                        name: typeof a.name === 'string' && /^AGENT_\d{4}$/i.test(a.name)
                            ? a.name.toUpperCase()
                            : `AGENT_${String(a.id ?? '').slice(-4).padStart(4, '0')}`,
                        nickname: typeof a.nickname === 'string' ? a.nickname : '',
                        assignedDepartmentId: typeof a.assignedDepartmentId === 'string' ? a.assignedDepartmentId : undefined,
                        budget: Number(a.budget) || 0,
                        maxBudget: Number(a.maxBudget) || 0,
                        refillRate: Number(a.refillRate) || 0
                    })),
                    activeAlert: null,
                    isAgentsPinned: !!parsed.isAgentsPinned,
                    isMetaMapPinned: !!parsed.isMetaMapPinned,
                    isWalletsPinned: !!parsed.isWalletsPinned,
                    isDepartmentsPinned: !!parsed.isDepartmentsPinned,
                    isBuildPinned: !!parsed.isBuildPinned,
                    isBreachCliPinned: !!parsed.isBreachCliPinned,
                    isLedgerPinned: !!parsed.isLedgerPinned,
                    isModulesPinned: !!parsed.isModulesPinned,
                    isTerminalPinned: !!parsed.isTerminalPinned,
                    isInboxPinned: !!parsed.isInboxPinned,
                    isArchivePinned: !!parsed.isArchivePinned,
                    isMainContentMinimized: !!parsed.isMainContentMinimized,
                    notificationsEnabled: parsed.notificationsEnabled !== false,
                    runCollapseCount: Number(parsed.runCollapseCount) || 0,
                    opsLedger: Array.isArray(parsed.opsLedger)
                        ? parsed.opsLedger
                            .filter((entry: any) => entry && typeof entry.message === 'string')
                            .map((entry: any) => ({
                                id: typeof entry.id === 'string' ? entry.id : `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now(),
                                type: typeof entry.type === 'string' ? entry.type : 'system',
                                message: entry.message,
                                floor: typeof entry.floor === 'number' ? entry.floor : undefined,
                                amountCU: typeof entry.amountCU === 'number' ? entry.amountCU : undefined,
                                amountTokens: typeof entry.amountTokens === 'number' ? entry.amountTokens : undefined
                            }))
                            .slice(-250)
                        : [],
                    osModules: {
                        ...DEFAULT_OS_MODULES,
                        ...(parsed.osModules && typeof parsed.osModules === 'object'
                            ? Object.fromEntries(
                                Object.entries(parsed.osModules)
                                    .filter(([key]) => key in DEFAULT_OS_MODULES)
                                    .map(([key, value]) => [key, Math.max(0, Number(value) || 0)])
                              )
                            : {})
                    },
                    breachCliHistory: Array.isArray(parsed.breachCliHistory)
                        ? parsed.breachCliHistory
                            .filter((line: unknown): line is string => typeof line === 'string')
                            .slice(-12)
                        : defaultState.breachCliHistory,
                    breachCliInput: typeof parsed.breachCliInput === 'string'
                        ? parsed.breachCliInput
                        : defaultState.breachCliInput,
                    menuButtonOrder: Array.isArray(parsed.menuButtonOrder) && parsed.menuButtonOrder.length > 0
                        ? parsed.menuButtonOrder.filter((item: unknown): item is string => typeof item === 'string')
                        : defaultState.menuButtonOrder,
                    terminalHistory: (Array.isArray(parsed.terminalHistory) ? parsed.terminalHistory : defaultState.terminalHistory)
                        .map((h: any) => ({
                            ...h,
                            content: typeof h.content === 'string' ? h.content : '[RECOVERY ERROR: DATA CORRUPTED]'
                        })),
                    pinnedPositions: { ...defaultState.pinnedPositions, ...(parsed.pinnedPositions || {}) },
                    pinnedSizes: { ...defaultState.pinnedSizes, ...(parsed.pinnedSizes || {}) }
                };
            } catch (e) {
                console.error("PRGN_OS: Failed to parse saved state, reverting to default.", e);
                return defaultState;
            }
        }
        return defaultState;
    });

    const stateRef = React.useRef(gameState);
    React.useEffect(() => {
        stateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setGameState(prev => {
                let changed = false;
                const newActiveJobs: { id: string; startTime: number }[] = [];
                const newCompletedJobs = [...prev.completedJobs];
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
                    return {
                        ...prev,
                        activeJobs: newActiveJobs,
                        completedJobs: newCompletedJobs,
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
        const persistGameState = () => {
            try {
                localStorage.setItem('latham_journals_state', JSON.stringify(stateRef.current));
            } catch (error) {
                console.error('PRGN_OS: Failed to persist game state.', error);
            }
        };

        persistGameState();
        const interval = setInterval(persistGameState, 1500);
        return () => clearInterval(interval);
    }, []);

    // Codex Agents Automation Loop
    useEffect(() => {
        const interval = setInterval(() => {
            setGameState(prev => {
                if (prev.codexAgents.length === 0) return prev;

                let nextState = { ...prev };
                let cuRemaining = prev.computeUnits;
                let currentClutter = prev.systemClutter;
                let newAlert = prev.activeAlert;
                const dungeonPressure = getDungeonPressureSnapshot();
                const depthPressure = Math.max(0, dungeonPressure.deepestFloor - 1);
                const defragSpendCap =
                    250 +
                    (depthPressure * 250) +
                    (dungeonPressure.breachCount * 10) +
                    (dungeonPressure.claimedFloorCount * 50) +
                    (dungeonPressure.tokenMintCount * 150);
                const defragEfficiency = Math.max(
                    0.004,
                    0.12 -
                        (depthPressure * 0.004) -
                        (dungeonPressure.breachCount * 0.00008) -
                        (dungeonPressure.claimedFloorCount * 0.003) -
                        (dungeonPressure.tokenMintCount * 0.01)
                );

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
                    const agentLabel = agent.nickname?.trim() ? `${agent.nickname} // ${agent.name}` : agent.name;

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
                        const availableFunds = agentBudget > 0
                            ? agentBudget
                            : (maxB === 0 ? cuRemaining : 0);
                        const spendAmount = Math.min(defragSpendCap, availableFunds);
                        const cleanupAmount = Math.min(currentClutter, spendAmount * defragEfficiency);

                        if (currentClutter > 0 && spendAmount > 0 && cleanupAmount > 0) {
                            if (agentBudget > 0) {
                                agentBudget -= spendAmount;
                            } else {
                                cuRemaining -= spendAmount;
                            }
                            currentClutter = Math.max(0, currentClutter - cleanupAmount);
                            lastAction = `DEFRAGGING F${dungeonPressure.deepestFloor} (-${cleanupAmount.toFixed(1)}%)`;
                            newAlert = { id: `alert-${Date.now()}`, title: 'AGENT ACTION COMPLETE', message: `${agentLabel} completed defrag cleanup: -${cleanupAmount.toFixed(1)}% clutter at floor pressure ${dungeonPressure.deepestFloor}.`, type: 'info' };
                        } else {
                            lastAction = currentClutter === 0 ? 'SYSTEM CLEAN' : 'CHARGING DEFRAG CACHE';
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
                    } else if (agent.strategy === 'scrapper') {
                        if (nextState.activeBrickedNode) {
                            const node = nextState.activeBrickedNode;
                            // Scrapper adds to main wallet (or budget?) 
                            // Request said "won't draw from the main wallet", didn't specify scrapper earnings.
                            // I'll keep scrapper adding to main wallet as it's a "gain" not a "draw".
                            cuRemaining += node.scrapValue;
                            nextState = { ...nextState, activeBrickedNode: null };
                            lastAction = `SCRAPPED NODE [${node.id.slice(-4)}]`;
                            newAlert = { id: `alert-${Date.now()}`, title: 'AGENT ACTION COMPLETE', message: `${agentLabel} scrapped a bricked node for +${node.scrapValue} CU.`, type: 'info' };
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
                                newAlert = { id: `alert-${Date.now()}`, title: 'AGENT ACTION COMPLETE', message: `${agentLabel} started repairing a bricked node.`, type: 'info' };
                            } else {
                                lastAction = `NEED ${node.repairCost} CU`;
                            }
                        } else {
                            lastAction = 'MONITORING SYSTEMS';
                        }
                    } else if (agent.strategy === 'manager') {
                        lastAction = 'COORDINATING BREACHES';
                    } else if (agent.strategy === 'builder') {
                        lastAction = 'PLANNING INFRASTRUCTURE';
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
                            newAlert = { id: `alert-${Date.now()}`, title: 'AGENT ACTION COMPLETE', message: `${agentLabel} purchased ${targetStat.toUpperCase()} upgrade.`, type: 'info' };
                        } else {
                            lastAction = `SAVING FOR ${targetStat.toUpperCase()}`;
                        }
                    } else if (agent.strategy !== 'defrag' && agent.strategy !== 'scrapper' && agent.strategy !== 'mechanic' && agent.strategy !== 'manager' && agent.strategy !== 'builder') {
                        lastAction = 'MONITORING';
                    }

                    return { ...agent, budget: agentBudget, lastAction };
                });

                return { 
                    ...nextState, 
                    codexAgents: updatedAgents, 
                    computeUnits: cuRemaining,
                    systemClutter: currentClutter,
                    activeAlert: newAlert
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
        void amount;
    }, []);

    const setArchiveRestoration = useCallback((amount: number) => {
        const normalized = Math.max(0, Math.min(100, Number.isFinite(amount) ? amount : 0));
        setGameState(prev => (
            prev.archiveRestoration === normalized
                ? prev
                : { ...prev, archiveRestoration: normalized }
        ));
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

            return {
                ...prev,
                compiledNodes: [...prev.compiledNodes, nodeId]
            };
        });
    }, []);

    const addComputeUnits = useCallback((amount: number) => {
        setGameState(prev => {
            const current = Number(prev.computeUnits) || 0;
            const toAdd = Number(amount) || 0;
            return { ...prev, computeUnits: current + toAdd };
        });
    }, []);

    const spendComputeUnits = useCallback((amount: number) => {
        if (stateRef.current.computeUnits < amount) return false;
        setGameState(prev => ({
            ...prev,
            computeUnits: prev.computeUnits - amount
        }));
        return true;
    }, []);

    const addProtocolTokens = useCallback((amount: number, reason?: string) => {
        if (amount <= 0) return;
        setGameState(prev => ({
            ...prev,
            protocolTokens: prev.protocolTokens + amount,
            opsLedger: [
                ...prev.opsLedger,
                {
                    id: `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    timestamp: Date.now(),
                    type: 'token' as const,
                    message: `+${amount} token${amount === 1 ? '' : 's'}${reason ? ` // ${reason}` : ''}`,
                    amountTokens: amount
                }
            ].slice(-250),
            activeAlert: {
                id: `alert-${Date.now()}`,
                title: 'ADMIN TOKENS ACQUIRED',
                message: `+${amount} ADMIN TOKEN${amount === 1 ? '' : 'S'}${reason ? ` // ${reason}` : ''}`,
                type: 'info'
            }
        }));
    }, []);

    const spendProtocolTokens = useCallback((amount: number) => {
        if (amount <= 0) return true;
        if (stateRef.current.protocolTokens < amount) return false;
        setGameState(prev => ({
            ...prev,
            protocolTokens: prev.protocolTokens - amount
        }));
        return true;
    }, []);

    const getOSModuleLevel = useCallback((id: OSModuleId) => {
        return stateRef.current.osModules[id] ?? 0;
    }, []);

    const getOSModuleCost = useCallback((id: OSModuleId) => {
        return getOSModuleCostForLevel(id, getOSModuleLevel(id));
    }, [getOSModuleLevel]);

    const getMaxClaimCount = useCallback(() => {
        return 1 + (getOSModuleLevel('claim-authority') * 2);
    }, [getOSModuleLevel]);

    const unlockOSModule = useCallback((id: OSModuleId) => {
        const definition = getOSModuleDefinition(id);
        if (!definition) return false;

        const currentLevel = getOSModuleLevel(id);
        if (currentLevel >= definition.maxLevel) return false;

        const cost = getOSModuleCostForLevel(id, currentLevel);
        if (!spendProtocolTokens(cost)) return false;

        setGameState(prev => ({
            ...prev,
            osModules: {
                ...prev.osModules,
                [id]: (prev.osModules[id] ?? 0) + 1
            },
            opsLedger: [
                ...prev.opsLedger,
                {
                    id: `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    timestamp: Date.now(),
                    type: 'system' as const,
                    message: `${definition.name} upgraded to LV ${Math.min(definition.maxLevel, (prev.osModules[id] ?? 0) + 1)}.`,
                    amountTokens: -cost
                }
            ].slice(-250),
            activeAlert: {
                id: `alert-${Date.now()}`,
                title: 'OS MODULE INSTALLED',
                message: `${definition.name} upgraded to LV ${(prev.osModules[id] ?? 0) + 1}.`,
                type: 'info'
            }
        }));

        return true;
    }, [getOSModuleLevel, spendProtocolTokens]);

    const getUpgradeCost = useCallback((stat: 'baseDmg' | 'maxHpBoost' | 'speedBoost' | 'maxBreachWindows' | 'minerYield') => {
        return getCrawlerUpgradeCost(gameState.crawlerStats, stat);
    }, [gameState.crawlerStats]);

    const upgradeCrawler = useCallback((stat: 'baseDmg' | 'maxHpBoost' | 'speedBoost' | 'maxBreachWindows' | 'minerYield') => {
        const cost = getCrawlerUpgradeCost(stateRef.current.crawlerStats, stat);

        if (stateRef.current.computeUnits < cost) return false;

        setGameState(prev => {
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

        return true;
    }, []);

    const upgradeCrawlerBulk = useCallback((stat: 'baseDmg' | 'maxHpBoost' | 'speedBoost' | 'maxBreachWindows' | 'minerYield', quantity: number | 'max' = 1) => {
        const targetCount = quantity === 'max' ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor(quantity));
        if (!Number.isFinite(targetCount) && quantity !== 'max') return 0;
        if (targetCount === 0) return 0;

        const currentStats = { ...stateRef.current.crawlerStats };
        let remainingCU = stateRef.current.computeUnits;
        let purchased = 0;

        while (purchased < targetCount) {
            const cost = getCrawlerUpgradeCost(currentStats, stat);
            if (remainingCU < cost) break;

            remainingCU -= cost;
            purchased += 1;

            if (stat === 'baseDmg') currentStats.baseDmg += 1;
            if (stat === 'maxHpBoost') currentStats.maxHpBoost += 5;
            if (stat === 'speedBoost') currentStats.speedBoost += 1;
            if (stat === 'maxBreachWindows') currentStats.maxBreachWindows += 1;
            if (stat === 'minerYield') currentStats.minerYield += 1;
        }

        if (purchased === 0) return 0;

        setGameState(prev => {
            let liveRemainingCU = prev.computeUnits;
            const liveStats = { ...prev.crawlerStats };
            let livePurchased = 0;

            while (livePurchased < purchased) {
                const cost = getCrawlerUpgradeCost(liveStats, stat);
                if (liveRemainingCU < cost) break;

                liveRemainingCU -= cost;
                livePurchased += 1;

                if (stat === 'baseDmg') liveStats.baseDmg += 1;
                if (stat === 'maxHpBoost') liveStats.maxHpBoost += 5;
                if (stat === 'speedBoost') liveStats.speedBoost += 1;
                if (stat === 'maxBreachWindows') liveStats.maxBreachWindows += 1;
                if (stat === 'minerYield') liveStats.minerYield += 1;
            }

            if (livePurchased === 0) return prev;

            return {
                ...prev,
                computeUnits: liveRemainingCU,
                crawlerStats: liveStats
            };
        });

        return purchased;
    }, []);

    const addCodexAgent = useCallback((strategy: 'responsible' | 'brave' | 'disabled' | 'parallel' | 'defrag' | 'scrapper' | 'mechanic' | 'manager' | 'builder') => {
        const agentCount = stateRef.current.codexAgents.length;
        const cost = 500 + (agentCount * 1000);
        if (stateRef.current.computeUnits < cost) return false;

        setGameState(prev => {
            const liveAgentCount = prev.codexAgents.length;
            const liveCost = 500 + (liveAgentCount * 1000);
            if (prev.computeUnits < liveCost) return prev;

            const id = `agent-${Date.now()}`;
            const name = createAgentName(prev.codexAgents);
            return {
                ...prev,
                computeUnits: prev.computeUnits - liveCost,
                codexAgents: [...prev.codexAgents, { 
                    id, 
                    name, 
                    nickname: '',
                    strategy, 
                    assignedDepartmentId: undefined,
                    lastAction: 'INITIALIZING...', 
                    budget: 0, 
                    maxBudget: 0, 
                    refillRate: 0 
                }]
            };
        });

        return true;
    }, []);

    const setAgentStrategy = useCallback((id: string, strategy: 'responsible' | 'brave' | 'disabled' | 'parallel' | 'defrag' | 'scrapper' | 'mechanic' | 'manager' | 'builder') => {
        setGameState(prev => ({
            ...prev,
            codexAgents: prev.codexAgents.map(a => a.id === id ? { ...a, strategy } : a)
        }));
    }, []);

    const assignAgentDepartment = useCallback((id: string, departmentId?: string) => {
        setGameState(prev => ({
            ...prev,
            codexAgents: prev.codexAgents.map(a => a.id === id ? { ...a, assignedDepartmentId: departmentId || undefined } : a)
        }));
    }, []);

    const setAgentNickname = useCallback((id: string, nickname: string) => {
        const normalizedNickname = nickname.trim().slice(0, 24);
        setGameState(prev => ({
            ...prev,
            codexAgents: prev.codexAgents.map(a => a.id === id ? { ...a, nickname: normalizedNickname } : a)
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

    const toggleDepartmentsPinned = useCallback(() => {
        setGameState(prev => ({ ...prev, isDepartmentsPinned: !prev.isDepartmentsPinned }));
    }, []);

    const toggleBuildPinned = useCallback(() => {
        setGameState(prev => ({ ...prev, isBuildPinned: !prev.isBuildPinned }));
    }, []);

    const toggleBreachCliPinned = useCallback(() => {
        setGameState(prev => ({ ...prev, isBreachCliPinned: !prev.isBreachCliPinned }));
    }, []);

    const toggleLedgerPinned = useCallback(() => {
        setGameState(prev => ({ ...prev, isLedgerPinned: !prev.isLedgerPinned }));
    }, []);

    const toggleModulesPinned = useCallback(() => {
        setGameState(prev => ({ ...prev, isModulesPinned: !prev.isModulesPinned }));
    }, []);

    const toggleTerminalPinned = useCallback(() => {
        setGameState(prev => ({ ...prev, isTerminalPinned: !prev.isTerminalPinned }));
    }, []);

    const toggleInboxPinned = useCallback(() => {
        setGameState(prev => ({ ...prev, isInboxPinned: !prev.isInboxPinned }));
    }, []);

    const toggleArchivePinned = useCallback(() => {
        setGameState(prev => ({ ...prev, isArchivePinned: !prev.isArchivePinned }));
    }, []);

    const toggleMainContentMinimized = useCallback(() => {
        setGameState(prev => ({ ...prev, isMainContentMinimized: !prev.isMainContentMinimized }));
    }, []);

    const toggleNotificationsEnabled = useCallback(() => {
        setGameState(prev => ({
            ...prev,
            notificationsEnabled: !prev.notificationsEnabled,
            activeAlert: !prev.notificationsEnabled ? prev.activeAlert : null
        }));
    }, []);

    const setNotificationsEnabled = useCallback((enabled: boolean) => {
        setGameState(prev => ({
            ...prev,
            notificationsEnabled: enabled,
            activeAlert: enabled ? prev.activeAlert : null
        }));
    }, []);

    const setBreachCliInput = useCallback((breachCliInput: string) => {
        setGameState(prev => ({ ...prev, breachCliInput }));
    }, []);

    const appendBreachCliLine = useCallback((line: string) => {
        setGameState(prev => ({
            ...prev,
            breachCliHistory: [...prev.breachCliHistory.slice(-11), line]
        }));
    }, []);

    const clearBreachCliHistory = useCallback(() => {
        setGameState(prev => ({
            ...prev,
            breachCliHistory: [...defaultState.breachCliHistory],
            breachCliInput: ''
        }));
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

    const setMenuButtonOrder = useCallback((menuButtonOrder: string[]) => {
        setGameState(prev => ({
            ...prev,
            menuButtonOrder
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

    const updatePinnedSize = useCallback((id: string, width: number, height: number) => {
        setGameState(prev => ({
            ...prev,
            pinnedSizes: {
                ...prev.pinnedSizes,
                [id]: { width, height }
            }
        }));
    }, []);

    const recordOpsLedgerEvent = useCallback((entry: Omit<OpsLedgerEntry, 'id' | 'timestamp'>) => {
        setGameState(prev => ({
            ...prev,
            opsLedger: [
                ...prev.opsLedger,
                {
                    ...entry,
                    id: `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    timestamp: Date.now()
                }
            ].slice(-250)
        }));
    }, []);

    const clearOpsLedger = useCallback(() => {
        setGameState(prev => ({ ...prev, opsLedger: [] }));
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

    const refillAgent = useCallback((id: string, amount: number) => {
        if (amount <= 0) return 0;
        if (stateRef.current.computeUnits < amount) return 0;

        const agent = stateRef.current.codexAgents.find(a => a.id === id);
        if (!agent) return 0;

        const transferableAmount = agent.maxBudget > 0
            ? Math.min(amount, Math.max(0, agent.maxBudget - agent.budget))
            : amount;

        if (transferableAmount <= 0) return 0;

        setGameState(prev => {
            const newAgents = prev.codexAgents.map(a => {
                if (a.id === id) {
                    return { ...a, budget: a.budget + transferableAmount };
                }
                return a;
            });

            return {
                ...prev,
                computeUnits: prev.computeUnits - transferableAmount,
                codexAgents: newAgents
            };
        });

        return transferableAmount;
    }, []);

    const spendAgentFunds = useCallback((id: string, amount: number) => {
        if (amount <= 0) return true;

        const agent = stateRef.current.codexAgents.find(a => a.id === id);
        if (!agent) return false;

        const canUseBudget = agent.budget >= amount;
        const canUseMainWallet = agent.maxBudget === 0 && stateRef.current.computeUnits >= amount;
        if (!canUseBudget && !canUseMainWallet) return false;

        let success = false;
        setGameState(prev => {
            const liveAgent = prev.codexAgents.find(a => a.id === id);
            if (!liveAgent) return prev;

            if (liveAgent.budget >= amount) {
                success = true;
                return {
                    ...prev,
                    codexAgents: prev.codexAgents.map(a => a.id === id ? { ...a, budget: a.budget - amount } : a)
                };
            }

            if (liveAgent.maxBudget === 0 && prev.computeUnits >= amount) {
                success = true;
                return {
                    ...prev,
                    computeUnits: prev.computeUnits - amount
                };
            }

            return prev;
        });

        return success;
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
        if (stateRef.current.computeUnits < cost) return false;
        
        setGameState(prev => ({
            ...prev,
            computeUnits: prev.computeUnits - cost,
            systemClutter: Math.max(0, prev.systemClutter - amount)
        }));
        return true;
    }, []);

    const stabilizeClutter = useCallback((amount: number) => {
        if (amount <= 0) return;

        setGameState(prev => ({
            ...prev,
            systemClutter: Math.max(0, prev.systemClutter - amount)
        }));
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
                const now = Date.now();
                const memoryCompressionLevel = prev.osModules['memory-compression'] ?? 0;
                const clutterGrowthMultiplier = Math.max(0.35, 1 - (memoryCompressionLevel * 0.15));
                const dungeonPressure = getDungeonPressureSnapshot();
                const depthPressure = Math.max(0, dungeonPressure.deepestFloor - 1);
                const elapsedGrowth = calculateClutterGrowth(prev.sessionStartTime, now) * clutterGrowthMultiplier;
                const operationPressureBurst =
                    (depthPressure * 0.35) +
                    (dungeonPressure.breachCount * 0.12) +
                    (dungeonPressure.claimedFloorCount * 1.5) +
                    (dungeonPressure.tokenMintCount * 4);
                const clutterGrowth =
                    elapsedGrowth +
                    (operationPressureBurst * clutterGrowthMultiplier);
                const newClutter = Math.min(150, prev.systemClutter + clutterGrowth);

                // Check for completed repairs
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

                if (newClutter >= 150) {
                    return buildCollapsedRunState(prev);
                }

                if (newClutter !== prev.systemClutter || done.length > 0) {
                    const overloadAlert = prev.systemClutter < 100 && newClutter >= 100
                        ? {
                            id: `alert-${Date.now()}`,
                            title: 'CRITICAL OVERLOAD',
                            message: `SYS_CLUTTER HAS ENTERED CRITICAL OVERLOAD AT ${newClutter.toFixed(1)}%. REDUCE IT BEFORE 150% OR THE RUN WILL COLLAPSE.`,
                            type: 'critical' as const
                        }
                        : null;
                    return {
                        ...prev,
                        systemClutter: newClutter,
                        sessionStartTime: now,
                        repairingNodes: remaining,
                        cipherFragments: newFragments,
                        computeUnits: prev.computeUnits + cuBonus,
                        activeAlert: overloadAlert || (done.length > 0 ? newAlert : prev.activeAlert)
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
            addRestoration, setArchiveRestoration, startJob, compileNode,
            addComputeUnits, spendComputeUnits, addProtocolTokens, spendProtocolTokens, upgradeCrawler, upgradeCrawlerBulk,
            addCodexAgent, setAgentStrategy, assignAgentDepartment, setAgentNickname, getUpgradeCost,
            triggerAlert, dismissAlert,
            getJobProgress, isJobActive, isJobCompleted,
            addCipherFragment, attemptCipherUnlock, getDegradation,
            reduceClutter, stabilizeClutter, initiateRefactor, scrapBrickedNode,
            repairBrickedNode, setDefaultSpec, getCipherProgress,
            setActiveBrickedNode, toggleAgentsPinned, toggleWalletsPinned, toggleMetaMapPinned, toggleDepartmentsPinned, toggleBuildPinned, toggleBreachCliPinned, toggleLedgerPinned, toggleModulesPinned,
            toggleTerminalPinned, toggleInboxPinned, toggleArchivePinned, toggleMainContentMinimized, toggleNotificationsEnabled, setNotificationsEnabled, setBreachCliInput, appendBreachCliLine, clearBreachCliHistory, setTerminalInput, setTerminalHistory,
            setAgentBudget, setAgentRefillRate, refillAgent, spendAgentFunds, setMenuButtonOrder, updatePinnedPosition, updatePinnedSize, recordOpsLedgerEvent, clearOpsLedger,
            getOSModuleLevel, getOSModuleCost, unlockOSModule, getMaxClaimCount
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
