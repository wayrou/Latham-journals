import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useGameState, type CrawlerSpec, type BrickedNode } from './GameStateContext';
import { type Position, type Enemy, type Loot } from '../utils/dungeonGenerator';
import { useSound } from '../hooks/useSound';
import { findNextStep } from '../utils/pathfinding';
import { generateMetaMap, MAX_SEED_FLOORS, type Room } from '../utils/metaMap';
import { rollCipherDrop } from '../utils/cipherSystem';

export interface BreachFolder {
    id: string;
    name: string;
}

export interface BreachDepartment {
    id: string;
    name: string;
    defaultSpec: CrawlerSpec | 'mixed';
    commandScript: CommandScriptId;
}

export type CommandScriptId = 'default' | 'scout' | 'lockrun' | 'harvest' | 'hold' | 'deep-push';

export type FloorInfrastructureType =
    | 'mining-rig'
    | 'relay-uplink'
    | 'repair-dock'
    | 'scanner-tower'
    | 'quarantine-node'
    | 'dispatch-beacon';

export interface FloorInfrastructure {
    type: FloorInfrastructureType;
    roomX: number;
    roomY: number;
}

export interface ClaimedFloor {
    floor: number;
    claimedAt: number;
    claimCostCU: number;
    claimCostTokens: number;
    infrastructure: FloorInfrastructure[];
}

// Stat multipliers per specialization
const SPEC_MULT: Record<CrawlerSpec, { hp: number; dmg: number; speed: number }> = {
    fighter:  { hp: 1.5, dmg: 2.0, speed: 0.7 },
    rogue:    { hp: 0.8, dmg: 0.5, speed: 1.5 },
    miner:    { hp: 0.5, dmg: 0.3, speed: 0.5 },
    summoner: { hp: 1.0, dmg: 0.5, speed: 1.0 },
    explorer: { hp: 0.9, dmg: 0.7, speed: 1.3 },
};

// Daemon entity for summoners
interface Daemon {
    id: string;
    pos: Position;
    hp: number;
    dmg: number;
}

export interface BreachInstance {
    id: string;
    callsign: string;
    spec: CrawlerSpec;
    floor: number;
    roomX: number;
    roomY: number;
    grid: string[][];
    playerPos: Position;
    stairsPos: Position;
    enemies: Enemy[];
    loot: Loot[];
    hp: number;
    maxHp: number;
    logs: string[];
    mascotMessage: string | null;
    isAutoPlaying: boolean;
    isPinned: boolean;
    isPaused: boolean;
    isMinimized: boolean;
    lastInputTime: number;
    visitedRooms: string[];
    daemons: Daemon[];
    minerTickAccum: number; // Miner passive CU accumulator
}

interface DungeonContextType {
    breaches: BreachInstance[];
    metaMap: Room[][];
    getMetaMapForFloor: (floor: number) => Room[][];
    availableFloors: number[];
    claimedFloors: ClaimedFloor[];
    breachDepartments: BreachDepartment[];
    breachFolders: BreachFolder[];
    departmentAssignments: Record<string, string>;
    folderAssignments: Record<string, string>;
    activeBreachId: string | null;
    currentFloor: number;
    keysFound: string[];
    locksOpened: string[];
    getFloorProgress: (floor: number) => { keysFound: string[]; locksOpened: string[] };
    getClaimCost: (floor: number) => { cu: number; tokens: number };
    getInfrastructureCost: (floor: number, type: FloorInfrastructureType) => { cu: number; tokens: number };
    getClaimedFloor: (floor: number) => ClaimedFloor | undefined;
    isFloorClaimed: (floor: number) => boolean;
    roomMarkers: Record<string, string>;
    setActiveBreachId: (id: string | null) => void;
    movePlayer: (id: string, dx: number, dy: number, isManual?: boolean) => void;
    togglePause: (id: string) => void;
    toggleMinimize: (id: string) => void;
    togglePin: (id: string) => void;
    terminateBreach: (id: string) => void;
    initNewBreach: (spec?: CrawlerSpec, options?: { folderId?: string; isMinimized?: boolean }) => string | null;
    mascotSay: (id: string, msg: string) => void;
    restartBreach: (id: string) => void;
    setBreachSpec: (id: string, spec: CrawlerSpec) => void;
    toggleMarker: (rx: number, ry: number, label?: string) => void;
    nextFloor: (id: string) => void;
    claimFloor: (floor: number) => boolean;
    buildInfrastructure: (floor: number, type: FloorInfrastructureType) => boolean;
    createBreachFolder: (name: string) => string | null;
    renameBreachFolder: (id: string, name: string) => void;
    deleteBreachFolder: (id: string) => void;
    assignBreachToFolder: (breachId: string, folderId: string) => void;
    createBreachDepartment: (name: string) => string | null;
    renameBreachDepartment: (id: string, name: string) => void;
    deleteBreachDepartment: (id: string) => void;
    assignFolderToDepartment: (folderId: string, departmentId: string) => void;
    updateDepartmentSettings: (id: string, updates: Partial<Pick<BreachDepartment, 'defaultSpec' | 'commandScript'>>) => void;
}

const DungeonContext = createContext<DungeonContextType | undefined>(undefined);

const CALLSIGNS = [
    'NODE_ALPHA', 'NODE_BRAVO', 'NODE_CHARLIE', 'NODE_DELTA', 'NODE_ECHO', 
    'NODE_FOXTROT', 'NODE_GOLF', 'NODE_HOTEL', 'NODE_INDIA', 'NODE_JULIET',
    'NODE_KILO', 'NODE_LIMA', 'NODE_MIKE', 'NODE_NOVEMBER', 'NODE_OSCAR'
];

const FOLDER_STORAGE_KEY = 'latham_breach_folders';
const ASSIGNMENT_STORAGE_KEY = 'latham_breach_folder_assignments';
const DEPARTMENT_STORAGE_KEY = 'latham_breach_departments';
const DEPARTMENT_ASSIGNMENT_STORAGE_KEY = 'latham_breach_department_assignments';
const DUNGEON_STATE_STORAGE_KEY = 'latham_dungeon_state';
export const UNGROUPED_FOLDER_ID = 'ungrouped';
export const UNASSIGNED_DEPARTMENT_ID = 'unassigned';
const MAX_INFRASTRUCTURE_SLOTS = 4;

const buildUniqueCallsign = (existingCallsigns: string[]) => {
    const usedRoots = existingCallsigns.map(callsign => callsign.split('_')[0] + '_' + callsign.split('_')[1]);
    const availableCallsigns = CALLSIGNS.filter(c => !usedRoots.some(u => u.startsWith(c)));
    const baseCallsign = availableCallsigns[Math.floor(Math.random() * availableCallsigns.length)] || 'NODE_UNKNOWN';
    return `${baseCallsign}_${Math.floor(Math.random() * 99).toString().padStart(2, '0')}`;
};

const INFRASTRUCTURE_TOKEN_MULT: Record<FloorInfrastructureType, number> = {
    'mining-rig': 1,
    'relay-uplink': 1,
    'repair-dock': 1,
    'scanner-tower': 1,
    'quarantine-node': 2,
    'dispatch-beacon': 2
};

function pickInfrastructureRoom(
    floorMap: Room[][],
    existing: FloorInfrastructure[]
): { roomX: number; roomY: number } {
    const occupied = new Set(existing.map(item => `${item.roomX},${item.roomY}`));
    const rooms = floorMap.flat();
    const preferred = rooms.filter(room => room.isCleared && !occupied.has(`${room.x},${room.y}`));
    const fallback = rooms.filter(room => room.isDiscovered && !occupied.has(`${room.x},${room.y}`));
    const target = preferred[0] || fallback[0] || rooms.find(room => !occupied.has(`${room.x},${room.y}`)) || rooms[0];
    return { roomX: target.x, roomY: target.y };
}

function countInfrastructureByType(
    claimedFloor: ClaimedFloor | undefined,
    type: FloorInfrastructureType
): number {
    return claimedFloor?.infrastructure.filter(item => item.type === type).length ?? 0;
}

function pickScannerRevealRoom(floorMap: Room[][]): Room | null {
    const rooms = floorMap.flat();
    const frontier = rooms
        .filter(room => !room.isDiscovered)
        .filter(room => {
            const neighbors = [
                floorMap[room.y - 1]?.[room.x],
                floorMap[room.y + 1]?.[room.x],
                floorMap[room.y]?.[room.x - 1],
                floorMap[room.y]?.[room.x + 1]
            ].filter(Boolean) as Room[];

            return neighbors.some(neighbor => neighbor.isDiscovered);
        })
        .sort((a, b) => {
            const aDist = Math.abs(a.x - 4.5) + Math.abs(a.y - 4.5);
            const bDist = Math.abs(b.x - 4.5) + Math.abs(b.y - 4.5);
            return aDist - bDist;
        });

    return frontier[0] ?? rooms.find(room => !room.isDiscovered) ?? null;
}

function pickAdjacentRoom(rx: number, ry: number, visited: string[]): { x: number; y: number } {
    const neighbors = [
        { x: rx, y: ry - 1 }, { x: rx, y: ry + 1 },
        { x: rx - 1, y: ry }, { x: rx + 1, y: ry }
    ].filter(n => n.x >= 0 && n.x < 10 && n.y >= 0 && n.y < 10);
    const unvisited = neighbors.filter(n => !visited.includes(`${n.x},${n.y}`));
    const pool = unvisited.length > 0 ? unvisited : neighbors;
    return pool[Math.floor(Math.random() * pool.length)];
}

function getTilesByGlyph(grid: string[][], glyph: string): Position[] {
    const positions: Position[] = [];
    grid.forEach((row, y) => {
        row.forEach((tile, x) => {
            if (tile === glyph) positions.push({ x, y });
        });
    });
    return positions;
}

function getAssignedDepartmentForBreach(
    breachId: string,
    breachFolders: BreachFolder[],
    breachDepartments: BreachDepartment[],
    folderAssignments: Record<string, string>,
    departmentAssignments: Record<string, string>
): BreachDepartment | undefined {
    const folderId = folderAssignments[breachId];
    if (!folderId) return undefined;
    if (!breachFolders.some(folder => folder.id === folderId)) return undefined;
    const departmentId = departmentAssignments[folderId];
    if (!departmentId) return undefined;
    return breachDepartments.find(department => department.id === departmentId);
}

export const DungeonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { addRestoration, setArchiveRestoration, addComputeUnits, addProtocolTokens, spendComputeUnits, spendProtocolTokens, spendAgentFunds, triggerAlert, computeUnits, protocolTokens, crawlerStats, getDegradation, recordOpsLedgerEvent, getOSModuleLevel, getMaxClaimCount,
            addCipherFragment, refactorBonuses, defaultCrawlerSpec, setActiveBrickedNode, codexAgents } = useGameState();
    const { playSound } = useSound();

    const [breaches, setBreaches] = useState<BreachInstance[]>(() => {
        try {
            const saved = localStorage.getItem(DUNGEON_STATE_STORAGE_KEY);
            if (!saved) return [];
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed?.breaches) ? parsed.breaches : [];
        } catch {
            return [];
        }
    });
    const [floorMaps, setFloorMaps] = useState<Record<number, Room[][]>>(() => {
        try {
            const saved = localStorage.getItem(DUNGEON_STATE_STORAGE_KEY);
            if (!saved) return { 1: generateMetaMap(1) };
            const parsed = JSON.parse(saved);
            const savedMaps = parsed?.floorMaps;
            if (savedMaps && typeof savedMaps === 'object' && Object.keys(savedMaps).length > 0) {
                return savedMaps;
            }
        } catch {
            // Fall back to a fresh map.
        }
        return { 1: generateMetaMap(1) };
    });
    const [floorProgress, setFloorProgress] = useState<Record<number, { keysFound: string[]; locksOpened: string[] }>>(() => {
        try {
            const saved = localStorage.getItem(DUNGEON_STATE_STORAGE_KEY);
            if (!saved) return { 1: { keysFound: [], locksOpened: [] } };
            const parsed = JSON.parse(saved);
            const savedProgress = parsed?.floorProgress;
            if (savedProgress && typeof savedProgress === 'object' && Object.keys(savedProgress).length > 0) {
                return savedProgress;
            }
        } catch {
            // Fall back to default progress.
        }
        return { 1: { keysFound: [], locksOpened: [] } };
    });
    const [roomMarkers, setRoomMarkers] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem(DUNGEON_STATE_STORAGE_KEY);
            if (!saved) return {};
            const parsed = JSON.parse(saved);
            return parsed?.roomMarkers && typeof parsed.roomMarkers === 'object' ? parsed.roomMarkers : {};
        } catch {
            return {};
        }
    });
    const [claimedFloors, setClaimedFloors] = useState<ClaimedFloor[]>(() => {
        try {
            const saved = localStorage.getItem(DUNGEON_STATE_STORAGE_KEY);
            if (!saved) return [];
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed?.claimedFloors) ? parsed.claimedFloors : [];
        } catch {
            return [];
        }
    });
    const [breachDepartments, setBreachDepartments] = useState<BreachDepartment[]>([]);
    const [breachFolders, setBreachFolders] = useState<BreachFolder[]>([]);
    const [departmentAssignments, setDepartmentAssignments] = useState<Record<string, string>>({});
    const [folderAssignments, setFolderAssignments] = useState<Record<string, string>>({});
    const [activeBreachId, setActiveBreachId] = useState<string | null>(() => {
        try {
            const saved = localStorage.getItem(DUNGEON_STATE_STORAGE_KEY);
            if (!saved) return null;
            const parsed = JSON.parse(saved);
            return typeof parsed?.activeBreachId === 'string' ? parsed.activeBreachId : null;
        } catch {
            return null;
        }
    });
    const mascotTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const hasLoadedOrganizationState = useRef(false);
    const breachesRef = useRef<BreachInstance[]>(breaches);
    const gameStateRef = useRef({ getDegradation, addCipherFragment, refactorBonuses, crawlerStats });
    const currentFloor = breaches.find(b => b.id === activeBreachId)?.floor ?? breaches[0]?.floor ?? 1;
    const metaMap = floorMaps[currentFloor] ?? floorMaps[1];
    const keysFound = floorProgress[currentFloor]?.keysFound ?? [];
    const locksOpened = floorProgress[currentFloor]?.locksOpened ?? [];
    const availableFloors = Object.keys(floorMaps)
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

    useEffect(() => {
        setArchiveRestoration((availableFloors.length / MAX_SEED_FLOORS) * 100);
    }, [availableFloors, setArchiveRestoration]);

    useEffect(() => {
        localStorage.setItem(DUNGEON_STATE_STORAGE_KEY, JSON.stringify({
            breaches,
            floorMaps,
            floorProgress,
            roomMarkers,
            claimedFloors,
            activeBreachId
        }));
    }, [activeBreachId, breaches, claimedFloors, floorMaps, floorProgress, roomMarkers]);

    useEffect(() => {
        if (activeBreachId && !breaches.some(breach => breach.id === activeBreachId)) {
            setActiveBreachId(breaches[0]?.id ?? null);
        }
    }, [activeBreachId, breaches]);

    useEffect(() => {
        breachesRef.current = breaches;
    }, [breaches]);

    const getMetaMapForFloor = useCallback((floor: number) => {
        return floorMaps[floor] ?? floorMaps[1];
    }, [floorMaps]);

    const getFloorProgress = useCallback((floor: number) => {
        return floorProgress[floor] ?? { keysFound: [], locksOpened: [] };
    }, [floorProgress]);

    useEffect(() => {
        setClaimedFloors(prev => {
            let changed = false;
            const next = prev.map(entry => {
                const infrastructure = Array.isArray(entry.infrastructure) ? entry.infrastructure : [];
                if (infrastructure.every(item => typeof item === 'object' && item !== null && 'type' in item && 'roomX' in item && 'roomY' in item)) {
                    return entry;
                }

                changed = true;
                const floorMap = floorMaps[entry.floor] ?? generateMetaMap(entry.floor);
                const converted: FloorInfrastructure[] = [];
                infrastructure.forEach((item: FloorInfrastructure | FloorInfrastructureType) => {
                    const type = typeof item === 'string' ? item : item.type;
                    const placement = pickInfrastructureRoom(floorMap, converted);
                    converted.push({ type, ...placement });
                });

                return { ...entry, infrastructure: converted };
            });

            return changed ? next : prev;
        });
    }, [floorMaps]);

    const getClaimCost = useCallback((floor: number) => ({
        cu: 250 + ((Math.max(1, floor) - 1) * 125),
        tokens: Math.max(1, Math.ceil(floor / 3))
    }), []);

    const getInfrastructureCost = useCallback((floor: number, type: FloorInfrastructureType) => {
        const logisticsLevel = getOSModuleLevel('logistics-mesh');
        const discountMultiplier = Math.max(0.6, 1 - (logisticsLevel * 0.1));
        return {
            cu: Math.max(10, Math.round(((150 + (Math.max(1, floor) * 50) + (type === 'mining-rig' ? 0 : 75)) * 10) * discountMultiplier)),
            tokens: Math.max(1, Math.round(Math.max(1, floor) * 10 * INFRASTRUCTURE_TOKEN_MULT[type] * discountMultiplier))
        };
    }, [getOSModuleLevel]);

    const getClaimedFloor = useCallback((floor: number) => {
        return claimedFloors.find(entry => entry.floor === floor);
    }, [claimedFloors]);

    const isFloorClaimed = useCallback((floor: number) => {
        return claimedFloors.some(entry => entry.floor === floor);
    }, [claimedFloors]);

    const getInfrastructureCount = useCallback((floor: number, type: FloorInfrastructureType) => {
        return countInfrastructureByType(getClaimedFloor(floor), type);
    }, [getClaimedFloor]);

    useEffect(() => {
        try {
            const savedDepartments = localStorage.getItem(DEPARTMENT_STORAGE_KEY);
            const savedDepartmentAssignments = localStorage.getItem(DEPARTMENT_ASSIGNMENT_STORAGE_KEY);
            const savedFolders = localStorage.getItem(FOLDER_STORAGE_KEY);
            const savedAssignments = localStorage.getItem(ASSIGNMENT_STORAGE_KEY);

            if (savedDepartments) {
                const parsedDepartments = JSON.parse(savedDepartments);
                if (Array.isArray(parsedDepartments)) {
                    setBreachDepartments(parsedDepartments
                        .filter((department: Partial<BreachDepartment>) =>
                            department &&
                            typeof department.id === 'string' &&
                            typeof department.name === 'string' &&
                            (department.defaultSpec === 'mixed' || ['fighter', 'rogue', 'miner', 'summoner', 'explorer'].includes(department.defaultSpec || ''))
                        )
                        .map((department: Partial<BreachDepartment>) => ({
                            id: department.id as string,
                            name: department.name as string,
                            defaultSpec: (department.defaultSpec as BreachDepartment['defaultSpec']) || 'mixed',
                            commandScript: ['default', 'scout', 'lockrun', 'harvest', 'hold', 'deep-push'].includes(department.commandScript || '')
                                ? department.commandScript as CommandScriptId
                                : 'default'
                        })));
                }
            }

            if (savedDepartmentAssignments) {
                const parsedDepartmentAssignments = JSON.parse(savedDepartmentAssignments);
                if (parsedDepartmentAssignments && typeof parsedDepartmentAssignments === 'object') {
                    setDepartmentAssignments(parsedDepartmentAssignments);
                }
            }

            if (savedFolders) {
                const parsedFolders = JSON.parse(savedFolders);
                if (Array.isArray(parsedFolders)) {
                    setBreachFolders(parsedFolders.filter((folder: BreachFolder) => folder && typeof folder.id === 'string' && typeof folder.name === 'string'));
                }
            }

            if (savedAssignments) {
                const parsedAssignments = JSON.parse(savedAssignments);
                if (parsedAssignments && typeof parsedAssignments === 'object') {
                    setFolderAssignments(parsedAssignments);
                }
            }
        } catch {
            // Ignore malformed local folder state.
        } finally {
            hasLoadedOrganizationState.current = true;
        }
    }, []);

    useEffect(() => {
        if (!hasLoadedOrganizationState.current) return;
        localStorage.setItem(DEPARTMENT_STORAGE_KEY, JSON.stringify(breachDepartments));
    }, [breachDepartments]);

    useEffect(() => {
        if (!hasLoadedOrganizationState.current) return;
        localStorage.setItem(DEPARTMENT_ASSIGNMENT_STORAGE_KEY, JSON.stringify(departmentAssignments));
    }, [departmentAssignments]);

    useEffect(() => {
        if (!hasLoadedOrganizationState.current) return;
        localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(breachFolders));
    }, [breachFolders]);

    useEffect(() => {
        if (!hasLoadedOrganizationState.current) return;
        localStorage.setItem(ASSIGNMENT_STORAGE_KEY, JSON.stringify(folderAssignments));
    }, [folderAssignments]);

    useEffect(() => {
        const activeFolderIds = new Set([UNGROUPED_FOLDER_ID, ...breachFolders.map(folder => folder.id)]);
        setFolderAssignments(prev => {
            const next = Object.fromEntries(
                Object.entries(prev).filter(([breachId, folderId]) =>
                    breaches.some(breach => breach.id === breachId) && activeFolderIds.has(folderId)
                )
            );
            return Object.keys(next).length === Object.keys(prev).length ? prev : next;
        });
    }, [breachFolders, breaches]);

    useEffect(() => {
        const activeDepartmentIds = new Set([UNASSIGNED_DEPARTMENT_ID, ...breachDepartments.map(department => department.id)]);
        setDepartmentAssignments(prev => {
            const next = Object.fromEntries(
                Object.entries(prev).filter(([folderId, departmentId]) =>
                    breachFolders.some(folder => folder.id === folderId) && activeDepartmentIds.has(departmentId)
                )
            );
            return Object.keys(next).length === Object.keys(prev).length ? prev : next;
        });
    }, [breachDepartments, breachFolders]);

    const getTickDuration = useCallback(() => {
        return Math.max(75, 450 - ((gameStateRef.current.crawlerStats.speedBoost || 0) * 75));
    }, []);

    const getMinerTicksRequired = useCallback(() => {
        return Math.max(1, 3 - (gameStateRef.current.crawlerStats.speedBoost || 0));
    }, []);

    const createBreachFolder = useCallback((name: string) => {
        const normalized = name.trim().slice(0, 24);
        if (!normalized) return null;

        const existing = breachFolders.find(folder => folder.name.toLowerCase() === normalized.toLowerCase());
        if (existing) return existing.id;

        const id = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        setBreachFolders(prev => [...prev, { id, name: normalized }]);
        return id;
    }, [breachFolders]);

    const createBreachDepartment = useCallback((name: string) => {
        const normalized = name.trim().slice(0, 24);
        if (!normalized) return null;

        const existing = breachDepartments.find(department => department.name.toLowerCase() === normalized.toLowerCase());
        if (existing) return existing.id;

        const id = `department-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        setBreachDepartments(prev => [...prev, { id, name: normalized, defaultSpec: 'mixed', commandScript: 'default' }]);
        return id;
    }, [breachDepartments]);

    const renameBreachFolder = useCallback((id: string, name: string) => {
        const normalized = name.slice(0, 24);
        setBreachFolders(prev => prev.map(folder => folder.id === id ? { ...folder, name: normalized } : folder));
    }, []);

    const renameBreachDepartment = useCallback((id: string, name: string) => {
        const normalized = name.slice(0, 24);
        setBreachDepartments(prev => prev.map(department => department.id === id ? { ...department, name: normalized } : department));
    }, []);

    const deleteBreachFolder = useCallback((id: string) => {
        setBreachFolders(prev => prev.filter(folder => folder.id !== id));
        setFolderAssignments(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(breachId => {
                if (next[breachId] === id) delete next[breachId];
            });
            return next;
        });
    }, []);

    const deleteBreachDepartment = useCallback((id: string) => {
        setBreachDepartments(prev => prev.filter(department => department.id !== id));
        setDepartmentAssignments(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(folderId => {
                if (next[folderId] === id) delete next[folderId];
            });
            return next;
        });
    }, []);

    const assignBreachToFolder = useCallback((breachId: string, folderId: string) => {
        setFolderAssignments(prev => {
            if (folderId === UNGROUPED_FOLDER_ID) {
                const next = { ...prev };
                delete next[breachId];
                return next;
            }
            return { ...prev, [breachId]: folderId };
        });
    }, []);

    const assignFolderToDepartment = useCallback((folderId: string, departmentId: string) => {
        setDepartmentAssignments(prev => {
            if (departmentId === UNASSIGNED_DEPARTMENT_ID) {
                const next = { ...prev };
                delete next[folderId];
                return next;
            }
            return { ...prev, [folderId]: departmentId };
        });
    }, []);

    const updateDepartmentSettings = useCallback((id: string, updates: Partial<Pick<BreachDepartment, 'defaultSpec' | 'commandScript'>>) => {
        setBreachDepartments(prev => prev.map(department => (
            department.id === id ? { ...department, ...updates } : department
        )));
    }, []);

    // Keep refs fresh
    useEffect(() => {
        gameStateRef.current = { getDegradation, addCipherFragment, refactorBonuses, crawlerStats };
    }, [getDegradation, addCipherFragment, refactorBonuses, crawlerStats]);

    const updateFloorMap = useCallback((floor: number, updater: (map: Room[][]) => Room[][]) => {
        setFloorMaps(prev => {
            const baseMap = prev[floor] ?? generateMetaMap(floor);
            return { ...prev, [floor]: updater(baseMap) };
        });
    }, []);

    const updateFloorProgress = useCallback((floor: number, updater: (progress: { keysFound: string[]; locksOpened: string[] }) => { keysFound: string[]; locksOpened: string[] }) => {
        setFloorProgress(prev => {
            const current = prev[floor] ?? { keysFound: [], locksOpened: [] };
            const next = updater(current);
            return {
                ...prev,
                [floor]: {
                    keysFound: [...new Set(next.keysFound)],
                    locksOpened: [...new Set(next.locksOpened)]
                }
            };
        });
    }, []);

    const mascotSay = useCallback((id: string, msg: string) => {
        setBreaches(prev => prev.map(b => 
            b.id === id ? { ...b, mascotMessage: msg } : b
        ));
        if (mascotTimeouts.current[id]) clearTimeout(mascotTimeouts.current[id]);
        mascotTimeouts.current[id] = setTimeout(() => {
            setBreaches(prev => prev.map(b => 
                b.id === id ? { ...b, mascotMessage: null } : b
            ));
        }, 2000);
    }, []);

    // Enforce max breach capacity (trims excess on capacity reduction/refactor)
    useEffect(() => {
        const capacity = crawlerStats.maxBreachWindows || 1;
        setBreaches(prev => {
            if (prev.length > capacity) {
                const trimmed = prev.slice(0, capacity);
                // If active breach was among those trimmed, reset focus
                if (activeBreachId && !trimmed.some(b => b.id === activeBreachId)) {
                    setActiveBreachId(null);
                }
                return trimmed;
            }
            return prev;
        });
    }, [crawlerStats.maxBreachWindows, activeBreachId]);

    const initNewBreach = useCallback((spec?: CrawlerSpec, options?: { folderId?: string; isMinimized?: boolean }) => {
        if (breachesRef.current.length >= (crawlerStats.maxBreachWindows || 1)) {
            return null;
        }

        const id = `breach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const chosenSpec = spec || defaultCrawlerSpec;
        const mult = SPEC_MULT[chosenSpec];
        const baseHp = 20 + crawlerStats.maxHpBoost;
        const initialHp = Math.floor(baseHp * mult.hp);
        const floorMap = floorMaps[1] ?? generateMetaMap(1);
        
        const rx = 4 + Math.floor(Math.random() * 2);
        const ry = 4 + Math.floor(Math.random() * 2);
        const room = floorMap[ry][rx];

        setBreaches(prev => {
            if (prev.length >= (crawlerStats.maxBreachWindows || 1)) return prev;

            const callsign = buildUniqueCallsign(prev.map(b => b.callsign));

            const specLabel = chosenSpec.toUpperCase();
            const newBreach: BreachInstance = {
                id,
                callsign,
                spec: chosenSpec,
                floor: 1,
                roomX: rx,
                roomY: ry,
                grid: room.grid,
                playerPos: room.playerSpawn,
                stairsPos: room.stairsPos,
                enemies: [...room.enemies],
                loot: [...room.loot],
                hp: initialHp,
                maxHp: initialHp,
                logs: [`[BREACH PROTOCOL ${callsign} INITIATED]`, `[CLASS: ${specLabel}]`, `[COORDINATES: ${rx},${ry}]`],
                mascotMessage: null,
                isAutoPlaying: false,
                isPinned: false,
                isPaused: false,
                isMinimized: !!options?.isMinimized,
                lastInputTime: Date.now(),
                visitedRooms: [`${rx},${ry}`],
                daemons: [],
                minerTickAccum: 0
            };

            playSound('boot');
            // Mark initial room as discovered
            updateFloorMap(1, prevMap => {
                const newMap = [...prevMap];
                const row = [...newMap[ry]];
                row[rx] = { ...row[rx], isDiscovered: true };
                newMap[ry] = row;
                return newMap;
            });
            return [...prev, newBreach];
        });
        if (options?.folderId && options.folderId !== UNGROUPED_FOLDER_ID) {
            setFolderAssignments(prev => ({ ...prev, [id]: options.folderId as string }));
        }
        recordOpsLedgerEvent({
            type: 'crawler',
            message: `Crawler initiated // ${chosenSpec.toUpperCase()}${options?.folderId ? ' // folder assigned' : ''}.`,
            floor: 1
        });
        breachesRef.current = [...breachesRef.current, { id } as BreachInstance];
        return id;
    }, [crawlerStats.maxBreachWindows, crawlerStats.maxHpBoost, playSound, floorMaps, defaultCrawlerSpec, updateFloorMap, recordOpsLedgerEvent]);

    const terminateBreach = useCallback((id: string) => {
        const breach = breachesRef.current.find(b => b.id === id);
        setBreaches(prev => prev.filter(b => b.id !== id));
        if (activeBreachId === id) setActiveBreachId(null);
        if (breach) {
            recordOpsLedgerEvent({
                type: 'crawler',
                message: `${breach.callsign} terminated.`,
                floor: breach.floor
            });
        }
        playSound('error');
    }, [activeBreachId, playSound, recordOpsLedgerEvent]);

    const togglePause = useCallback((id: string) => {
        setBreaches(prev => prev.map(b => b.id === id ? { ...b, isPaused: !b.isPaused } : b));
    }, []);

    const toggleMinimize = useCallback((id: string) => {
        setBreaches(prev => prev.map(b => b.id === id ? { ...b, isMinimized: !b.isMinimized } : b));
    }, []);

    const togglePin = useCallback((id: string) => {
        setBreaches(prev => prev.map(b => b.id === id ? { ...b, isPinned: !b.isPinned } : b));
    }, []);

    const restartBreach = useCallback((id: string) => {
        const breach = breachesRef.current.find(item => item.id === id);
        const floorMap = floorMaps[1] ?? generateMetaMap(1);
        const rx = 4 + Math.floor(Math.random() * 2);
        const ry = 4 + Math.floor(Math.random() * 2);
        const room = floorMap[ry][rx];
        
        setBreaches(prev => prev.map(b => {
            if (b.id !== id) return b;
            const mult = SPEC_MULT[b.spec];
            const baseHp = 20 + crawlerStats.maxHpBoost;
            const initialHp = Math.floor(baseHp * mult.hp);
            return {
                ...b,
                floor: 1,
                roomX: rx,
                roomY: ry,
                grid: room.grid,
                playerPos: room.playerSpawn,
                stairsPos: room.stairsPos,
                enemies: [...room.enemies],
                loot: [...room.loot],
                hp: initialHp,
                maxHp: initialHp,
                logs: [...b.logs.slice(-2), '[SYSTEM REBOOTING...]', '[RE-INITIATING BREACH PROTOCOL]'],
                isAutoPlaying: false,
                isPaused: false,
                visitedRooms: [`${rx},${ry}`],
                daemons: [],
                minerTickAccum: 0
            };
        }));

        updateFloorMap(1, prevMap => {
            const newMap = [...prevMap];
            const row = [...newMap[ry]];
            row[rx] = { ...row[rx], isDiscovered: true };
            newMap[ry] = row;
            return newMap;
        });

        playSound('boot');
        if (breach) {
            recordOpsLedgerEvent({
                type: 'crawler',
                message: `${breach.callsign} restarted on floor 1.`,
                floor: 1
            });
        }
    }, [crawlerStats.maxHpBoost, playSound, floorMaps, updateFloorMap, recordOpsLedgerEvent]);

    const setBreachSpec = useCallback((id: string, spec: CrawlerSpec) => {
        const breach = breachesRef.current.find(b => b.id === id);
        setBreaches(prev => prev.map(b => {
            if (b.id !== id) return b;
            const mult = SPEC_MULT[spec];
            const baseHp = 20 + crawlerStats.maxHpBoost;
            const newMaxHp = Math.floor(baseHp * mult.hp);
            
            // Maintain health percentage
            const hpPercent = b.hp / b.maxHp;
            const newHp = Math.max(1, Math.floor(newMaxHp * hpPercent));

            return {
                ...b,
                spec,
                maxHp: newMaxHp,
                hp: newHp,
                logs: [...b.logs.slice(-4), `[SYSTEM] RE-SPECING: ${spec.toUpperCase()}`],
                daemons: spec !== 'summoner' ? [] : b.daemons,
                minerTickAccum: 0
            };
        }));
        if (breach && breach.spec !== spec) {
            recordOpsLedgerEvent({
                type: 'system',
                message: `${breach.callsign} re-speced to ${spec.toUpperCase()}.`,
                floor: breach.floor
            });
        }
    }, [crawlerStats.maxHpBoost, recordOpsLedgerEvent]);

    const processBreachMove = useCallback((b: BreachInstance, dx: number, dy: number, currentMap: Room[][]): { nextBreach: BreachInstance, cu: number, res: number, sounds: string[], updatedRoom?: Room, spawnBrickedNode?: BrickedNode } | null => {
        if (b.hp <= 0 || b.isPaused) return null;

        const nx = b.playerPos.x + dx;
        const ny = b.playerPos.y + dy;

        if (ny < 0 || ny >= b.grid.length || nx < 0 || nx >= b.grid[0].length) return null;
        if (b.grid[ny][nx] === '#') return null;

        let nextBreach = { ...b, playerPos: { x: nx, y: ny } };

        let cu = 0;
        let res = 0;
        let sounds: string[] = [];
        let updatedRoom: Room | undefined = undefined;

        // Get degradation multipliers
        const deg = gameStateRef.current.getDegradation();
        const mult = SPEC_MULT[b.spec];

        // Calculate CU yield multiplier from refactor bonuses
        const cuBonusMult = 1 + (gameStateRef.current.refactorBonuses || [])
            .filter(rb => rb.type === 'cuYield')
            .reduce((sum, rb) => sum + rb.amount, 0);

        // Transitions
        const tile = b.grid[ny][nx];
        if (['^', 'v', '<', '>', 'stairs'].includes(tile) || (nx === b.stairsPos.x && ny === b.stairsPos.y)) {
            let nextX = b.roomX;
            let nextY = b.roomY;

            if (tile === '^') nextY--;
            else if (tile === 'v') nextY++;
            else if (tile === '<') nextX--;
            else if (tile === '>' && nx === b.grid[0].length - 1) nextX++; // '>' is also stairs, so check position
            else {
                // Default stairs behavior if it's the old 'stairs' tile or position-based
                const next = pickAdjacentRoom(b.roomX, b.roomY, b.visitedRooms || []);
                nextX = next.x;
                nextY = next.y;
            }

            // Boundary check
            nextX = Math.max(0, Math.min(9, nextX));
            nextY = Math.max(0, Math.min(9, nextY));

            const nextRoom = currentMap[nextY][nextX];
            const newVisited = [...(b.visitedRooms || []), `${b.roomX},${b.roomY}`].slice(-12);
            
            nextBreach = {
                ...nextBreach,
                roomX: nextX,
                roomY: nextY,
                grid: nextRoom.grid,
                playerPos: nextRoom.playerSpawn,
                stairsPos: nextRoom.stairsPos,
                enemies: [...nextRoom.enemies],
                loot: [...nextRoom.loot],
                floor: b.floor,
                visitedRooms: newVisited,
                logs: [...b.logs.slice(-2), `[SECTOR TRANSITION: ${nextX},${nextY}]`],
                daemons: [],
                minerTickAccum: 0
            };
            updatedRoom = { ...nextRoom, isDiscovered: true };
            
            // If current room was cleared before leaving, mark it
            if (b.enemies.length === 0 && b.loot.length === 0) {
                const oldRoom = currentMap[b.roomY][b.roomX];
                if (!oldRoom.isCleared) {
                    updateFloorMap(b.floor, prevMap => {
                        const newMap = [...prevMap];
                        const row = [...newMap[b.roomY]];
                        row[b.roomX] = { ...row[b.roomX], isCleared: true };
                        newMap[b.roomY] = row;
                        return newMap;
                    });
                }
            }

            // 8% chance to find a bricked node on transition
            if (Math.random() < 0.08) {
                const node: BrickedNode = {
                    id: `node-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
                    roomCoords: `${nextX},${nextY}`,
                    repairCost: 50 + (b.floor * 10),
                    scrapValue: 20 + (b.floor * 5),
                    repairTimeMs: 30000,
                    rewardType: Math.random() > 0.5 ? 'cipher' : 'cu'
                };
                return { nextBreach, cu: 0, res: 0, sounds: ['success'], updatedRoom, spawnBrickedNode: node };
            }

            // Check for special rooms (Keys/Locks)
            const currentRoom = currentMap[nextY][nextX];
            let newLogs = nextBreach.logs;
            if (currentRoom.specialType) {
                if (currentRoom.specialType.startsWith('K')) {
                    const keyId = currentRoom.specialType;
                    const progress = getFloorProgress(b.floor);
                    if (!progress.keysFound.includes(keyId)) {
                        updateFloorProgress(b.floor, prev => ({ ...prev, keysFound: [...prev.keysFound, keyId] }));
                        newLogs = [...newLogs, `[SYSTEM] KEY ${keyId} COLLECTED.`];
                        sounds.push('success');
                    }
                } else if (currentRoom.specialType.startsWith('L')) {
                    const lockId = currentRoom.specialType;
                    const requiredKey = 'K' + lockId.slice(1);
                    const progress = getFloorProgress(b.floor);
                    if (progress.keysFound.includes(requiredKey) && !progress.locksOpened.includes(lockId)) {
                        updateFloorProgress(b.floor, prev => ({ ...prev, locksOpened: [...prev.locksOpened, lockId] }));
                        addProtocolTokens(1, `Opened ${lockId} on floor ${b.floor}`);
                        newLogs = [...newLogs, `[SYSTEM] LOCK ${lockId} OPENED.`];
                        sounds.push('boot');
                    }
                }
            }

            return { nextBreach: { ...nextBreach, logs: newLogs }, cu: 0, res: 0, sounds, updatedRoom };
        }

        // Combat — apply degradation to enemy stats
        const enemyIdx = nextBreach.enemies.findIndex(e => e.pos.x === nx && e.pos.y === ny);
        if (enemyIdx !== -1) {
            const playerDmg = Math.max(1, Math.floor(crawlerStats.baseDmg * mult.dmg));
            const target = nextBreach.enemies[enemyIdx];
            const newEnemyHp = target.hp - playerDmg; // raw hp tracking
            
            let newEnemies = [...nextBreach.enemies];
            let newLogs = [...nextBreach.logs];
            let newMascot = b.mascotMessage;

            if (newEnemyHp <= 0) {
                cu = Math.floor(10 * deg.cuYieldMult * cuBonusMult);
                newLogs = [...newLogs.slice(-4), `UNIT_${target.type} DELETED. (+${cu} CU)`];
                newMascot = "TARGET DELETED!";
                newEnemies = newEnemies.filter((_, i) => i !== enemyIdx);
                const currentRoom = currentMap[b.roomY][b.roomX];
                updatedRoom = { ...currentRoom, enemies: newEnemies };
            } else {
                newLogs = [...newLogs.slice(-4), `Attacked UNIT_${target.type} for ${playerDmg} DMG!`];
                newMascot = "ENGAGING.";
                sounds.push('click');
                newEnemies[enemyIdx] = { ...target, hp: newEnemyHp };
                const currentRoom = currentMap[b.roomY][b.roomX];
                updatedRoom = { ...currentRoom, enemies: newEnemies };
                
                const counterDmg = Math.max(1, Math.floor((target.dmg || 2) * deg.enemyDmgMult));
                const counterHp = nextBreach.hp - counterDmg;
                newLogs = [...newLogs.slice(-4), `Counter-attack: -${counterDmg} HP`];
                if (counterHp <= 0) {
                    newMascot = "CRITICAL FAILURE!";
                    newLogs = [...newLogs.slice(-4), '[SYSTEM ERROR: CRAWLER DESTROYED]'];
                    sounds.push('error');
                    setTimeout(() => restartBreach(b.id), 2000);
                    nextBreach.hp = 0;
                } else {
                    nextBreach.hp = counterHp;
                }
            }
            nextBreach.enemies = newEnemies;
            nextBreach.logs = newLogs;
            nextBreach.mascotMessage = newMascot;
            nextBreach.playerPos = b.playerPos; 
            return { nextBreach, cu, res, sounds, updatedRoom };
        }

        // Loot — with cipher fragment drop chance
        const lootIdx = nextBreach.loot.findIndex(l => l.pos.x === nx && l.pos.y === ny);
        if (lootIdx !== -1) {
            const l = nextBreach.loot[lootIdx];
            cu = Math.floor(l.amount * deg.cuYieldMult * cuBonusMult);
            sounds.push('success');

            const heal = 2;
            const newHp = Math.min(b.maxHp, b.hp + heal);
            let newLogs = [...nextBreach.logs.slice(-4), `Recovered data (+${heal} HP / +${cu} CU)`];
            let newMascot = "SHINY!";

            if (Math.random() > 0.8) {
                res = 5;
                newLogs = [...newLogs.slice(-4), '++ GLOBAL RESTORATION BOOST ++'];
            }

            // Cipher fragment drop
            const fragBonusMult = (gameStateRef.current.refactorBonuses || [])
                .filter(rb => rb.type === 'fragmentRate')
                .reduce((sum, rb) => sum + rb.amount, 0);
            const baseFragRate = b.spec === 'rogue' ? 0.35 : 0.15;
            const fragRate = baseFragRate + fragBonusMult + deg.fragmentDropBonus;
            // rollCipherDrop needs existing fragments from context — we pass empty and let the caller handle it
            const roomCoords = `${b.roomX},${b.roomY}`;
            const fragment = rollCipherDrop(fragRate, [], roomCoords);
            if (fragment) {
                newLogs = [...newLogs.slice(-4), `>> CIPHER FRAGMENT RECOVERED: "${fragment.content}"`];
                newMascot = "ENCRYPTED DATA FOUND!";
                // Schedule fragment addition (can't call context directly in processBreachMove)
                setTimeout(() => gameStateRef.current.addCipherFragment(fragment), 0);
            }
            
            const newLoot = nextBreach.loot.filter((_, i) => i !== lootIdx);
            const currentRoom = currentMap[b.roomY][b.roomX];
            updatedRoom = { ...currentRoom, loot: newLoot };

            return {
                nextBreach: {
                    ...nextBreach,
                    hp: newHp,
                    loot: newLoot,
                    logs: newLogs,
                    mascotMessage: newMascot
                },
                cu,
                res,
                sounds,
                updatedRoom
            };
        }

        return { nextBreach, cu: 0, res: 0, sounds: [] };
    }, [crawlerStats.baseDmg, restartBreach, getFloorProgress, updateFloorMap, updateFloorProgress]);

    const movePlayer = useCallback((id: string, dx: number, dy: number, isManual: boolean = false) => {
        let pendingCU = 0;
        let pendingRes = 0;
        let pendingSounds: string[] = [];
        let updatedRoomFloor: number | null = null;
        let updatedRoomData: Room | null = null;

        setBreaches(prevBreaches => {
            const b = prevBreaches.find(x => x.id === id);
            if (!b) return prevBreaches;

            const currentMap = getMetaMapForFloor(b.floor);
            const result = processBreachMove(b, dx, dy, currentMap);
            if (!result) return prevBreaches;

            const { nextBreach, cu, res, sounds, updatedRoom, spawnBrickedNode } = result;
            pendingCU = cu;
            pendingRes = res;
            pendingSounds = sounds;
            updatedRoomFloor = updatedRoom ? b.floor : null;
            updatedRoomData = updatedRoom ?? null;

            if (spawnBrickedNode) {
                setTimeout(() => setActiveBrickedNode(spawnBrickedNode), 0);
            }

            return prevBreaches.map(x => {
                if (x.id !== id) return x;
                const updated = { ...nextBreach };
                if (isManual) updated.lastInputTime = Date.now();
                return updated;
            });
        });

        if (updatedRoomData && updatedRoomFloor !== null) {
            const r: Room = updatedRoomData as Room;
            updateFloorMap(updatedRoomFloor, (prev: Room[][]): Room[][] => {
                const newMap = [...prev];
                if (newMap[r.y]) {
                    const row = [...newMap[r.y]];
                    row[r.x] = r;
                    newMap[r.y] = row;
                }
                return newMap;
            });
        }
        if (pendingCU) addComputeUnits(pendingCU);
        if (pendingRes) addRestoration(pendingRes);
        pendingSounds.forEach(s => playSound(s as any));
    }, [processBreachMove, addComputeUnits, addRestoration, playSound, getMetaMapForFloor, updateFloorMap]);

    // Initial setup
    useEffect(() => {
        if (breaches.length === 0) {
            initNewBreach();
        }
    }, [breaches.length, initNewBreach]);

    // AI Loop
    useEffect(() => {
        const aiInterval = setInterval(() => {
            const effects: { cu: number, res: number, sounds: string[] }[] = [];
            const updatedRooms: Array<Room & { floor: number }> = [];
            const pendingFloorAdvances: string[] = [];
            const deg = gameStateRef.current.getDegradation();

            setBreaches(currentBreaches => {
                return currentBreaches.map(b => {
                    if (b.isPaused || b.hp <= 0) return b;

                    const isBeingControlled = b.id === activeBreachId && (Date.now() - b.lastInputTime < 4000);
                    
                    if (isBeingControlled) {
                        if (b.isAutoPlaying) {
                            return { ...b, logs: [...b.logs.slice(-4), '[PEREGRINE OVERRIDE DISENGAGED]'], isAutoPlaying: false };
                        }
                        return b;
                    }

                    let updatedB = { ...b };
                    if (!b.isAutoPlaying) {
                        updatedB = { 
                            ...b, 
                            logs: [...b.logs.slice(-4), '[PEREGRINE OVERRIDE ENGAGED]'],
                            mascotMessage: "I'LL TAKE IT FROM HERE!",
                            isAutoPlaying: true 
                        };
                    }

                    const breachMap = getMetaMapForFloor(updatedB.floor);
                    const assignedDepartment = getAssignedDepartmentForBreach(
                        updatedB.id,
                        breachFolders,
                        breachDepartments,
                        folderAssignments,
                        departmentAssignments
                    );
                    const commandScript = assignedDepartment?.commandScript ?? 'default';

                    // === MINER: stop moving under auto-play and generate passive CU ===
                    let minerMult = 1;
                    if (updatedB.spec === 'miner') {
                        const currentRoom = breachMap[updatedB.roomY][updatedB.roomX];
                        if (currentRoom.specialType === 'mining_boost') {
                            minerMult = 2;
                        }
                        const newAccum = (updatedB.minerTickAccum || 0) + 1;
                        const yieldAmt = gameStateRef.current.crawlerStats.minerYield || 3;
                        const ticksRequired = getMinerTicksRequired();
                        if (newAccum >= ticksRequired) {
                            effects.push({ cu: yieldAmt * minerMult, res: 0, sounds: [] });
                            return { 
                                ...updatedB, 
                                minerTickAccum: 0,
                                logs: [...updatedB.logs.slice(-4), `[MINER: +${yieldAmt * minerMult} CU ${minerMult > 1 ? '(BOOSTED)' : ticksRequired < 3 ? '(OVERCLOCKED)' : '(PASSIVE)'}]`],
                                isAutoPlaying: true 
                            };
                        }
                        return { ...updatedB, minerTickAccum: newAccum, isAutoPlaying: true };
                    }

                    // === SUMMONER: spawn daemons on room entry ===
                    if (updatedB.spec === 'summoner' && updatedB.daemons.length < 2 && updatedB.enemies.length > 0) {
                        const newDaemon: Daemon = {
                            id: `daemon-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
                            pos: { ...updatedB.playerPos },
                            hp: 10,
                            dmg: crawlerStats.baseDmg
                        };
                        updatedB = {
                            ...updatedB,
                            daemons: [...updatedB.daemons, newDaemon],
                            logs: [...updatedB.logs.slice(-4), '[SUMMONER: DAEMON SPAWNED]']
                        };
                    }

                    // === Daemon combat phase (summoner) ===
                    if (updatedB.daemons.length > 0 && updatedB.enemies.length > 0) {
                        let newEnemies = [...updatedB.enemies];
                        let newDaemons = [...updatedB.daemons];
                        let daemonCU = 0;

                        newDaemons.forEach(d => {
                            const target = newEnemies.find(e => 
                                Math.abs(e.pos.x - d.pos.x) + Math.abs(e.pos.y - d.pos.y) <= 3
                            );
                            if (target) {
                                const newHp = target.hp - d.dmg;
                                if (newHp <= 0) {
                                    newEnemies = newEnemies.filter(e => e.id !== target.id);
                                    daemonCU += 10;
                                } else {
                                    newEnemies = newEnemies.map(e => 
                                        e.id === target.id ? { ...e, hp: newHp } : e
                                    );
                                }
                            }
                        });

                        if (daemonCU > 0) {
                            effects.push({ cu: daemonCU, res: 0, sounds: [] });
                        }
                        updatedB = { ...updatedB, enemies: newEnemies, daemons: newDaemons };
                    }

                    // Pathfinding jitter from degradation
                    if (Math.random() < deg.pathfindingJitter) {
                        // Random walk instead of pathfinding
                        const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }]
                            .sort(() => Math.random() - 0.5);
                        for (const dir of dirs) {
                            const result = processBreachMove(updatedB, dir.dx, dir.dy, breachMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                        }
                        return { ...updatedB, isAutoPlaying: true };
                    }

                    const currentPos = updatedB.playerPos;
                    const floorIsComplete = getFloorProgress(updatedB.floor).locksOpened.length >= 3;

                    if ((commandScript === 'deep-push' || updatedB.spec === 'explorer') && floorIsComplete) {
                        pendingFloorAdvances.push(updatedB.id);
                        return {
                            ...updatedB,
                            isAutoPlaying: true,
                            logs: [
                                ...updatedB.logs.slice(-4),
                                updatedB.spec === 'explorer'
                                    ? `[EXPLORER: ADVANCING TO FLOOR ${updatedB.floor + 1}]`
                                    : `[DEEP PUSH: ADVANCING TO FLOOR ${updatedB.floor + 1}]`
                            ]
                        };
                    }

                    if (commandScript === 'hold') {
                        const adjEnemy = updatedB.enemies.find(e => Math.abs(e.pos.x - currentPos.x) + Math.abs(e.pos.y - currentPos.y) === 1);
                        if (adjEnemy) {
                            const result = processBreachMove(updatedB, adjEnemy.pos.x - currentPos.x, adjEnemy.pos.y - currentPos.y, breachMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                        }

                        const adjLoot = updatedB.loot.find(l => Math.abs(l.pos.x - currentPos.x) + Math.abs(l.pos.y - currentPos.y) === 1);
                        if (adjLoot) {
                            const result = processBreachMove(updatedB, adjLoot.pos.x - currentPos.x, adjLoot.pos.y - currentPos.y, breachMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                        }

                        return { ...updatedB, isAutoPlaying: true, logs: [...updatedB.logs.slice(-4), '[SCRIPT: HOLD]'] };
                    }

                    if (commandScript === 'deep-push' && updatedB.stairsPos.x >= 0) {
                        const bestMove = findNextStep(updatedB.grid, currentPos, [updatedB.stairsPos]);
                        if (bestMove) {
                            const result = processBreachMove(updatedB, bestMove.dx, bestMove.dy, breachMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                        }
                    }

                    if (commandScript === 'harvest') {
                        const adjLoot = updatedB.loot.find(l => Math.abs(l.pos.x - currentPos.x) + Math.abs(l.pos.y - currentPos.y) === 1);
                        if (adjLoot) {
                            const result = processBreachMove(updatedB, adjLoot.pos.x - currentPos.x, adjLoot.pos.y - currentPos.y, breachMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                        }

                        if (updatedB.loot.length > 0) {
                            const bestMove = findNextStep(updatedB.grid, currentPos, updatedB.loot.map(l => l.pos));
                            if (bestMove) {
                                const result = processBreachMove(updatedB, bestMove.dx, bestMove.dy, breachMap);
                                if (result) {
                                    effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                    if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                    if (result.spawnBrickedNode) {
                                        setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                    }
                                    return { ...result.nextBreach, isAutoPlaying: true };
                                }
                            }
                        }
                    }

                    if (commandScript === 'scout' || commandScript === 'lockrun') {
                        const progress = getFloorProgress(updatedB.floor);
                        const targetRoom = breachMap
                            .flat()
                            .filter(room => {
                                if (commandScript === 'lockrun') {
                                    if (room.specialType?.startsWith('K') && !progress.keysFound.includes(room.specialType)) return true;
                                    if (room.specialType?.startsWith('L') && !progress.locksOpened.includes(room.specialType)) return true;
                                }
                                if (room.specialType?.startsWith('K') && !progress.keysFound.includes(room.specialType)) return true;
                                return !room.isDiscovered;
                            })
                            .sort((a, b) => {
                                const aDist = Math.abs(a.x - updatedB.roomX) + Math.abs(a.y - updatedB.roomY);
                                const bDist = Math.abs(b.x - updatedB.roomX) + Math.abs(b.y - updatedB.roomY);
                                const priority = (room: Room) => {
                                    if (room.specialType?.startsWith('K')) return 0;
                                    if (commandScript === 'lockrun' && room.specialType?.startsWith('L')) return 1;
                                    return 2;
                                };
                                const aPriority = priority(a);
                                const bPriority = priority(b);
                                if (aPriority !== bPriority) return aPriority - bPriority;
                                return aDist - bDist;
                            })[0];

                        if (targetRoom && (targetRoom.x !== updatedB.roomX || targetRoom.y !== updatedB.roomY)) {
                            const roomDx = targetRoom.x - updatedB.roomX;
                            const roomDy = targetRoom.y - updatedB.roomY;
                            const preferredExits = [
                                roomDx > 0 ? '>' : roomDx < 0 ? '<' : null,
                                roomDy > 0 ? 'v' : roomDy < 0 ? '^' : null
                            ].filter((glyph): glyph is string => !!glyph);

                            for (const glyph of preferredExits) {
                                const exitTiles = getTilesByGlyph(updatedB.grid, glyph);
                                const bestMove = findNextStep(updatedB.grid, currentPos, exitTiles);
                                if (bestMove) {
                                    const result = processBreachMove(updatedB, bestMove.dx, bestMove.dy, breachMap);
                                    if (result) {
                                        effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                        if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                        if (result.spawnBrickedNode) {
                                            setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                        }
                                        return { ...result.nextBreach, isAutoPlaying: true };
                                    }
                                }
                            }
                        }
                    }

                    // === EXPLORER: prioritize undiscovered rooms and floor keys ===
                    if (updatedB.spec === 'explorer') {
                        const progress = getFloorProgress(updatedB.floor);
                        const targetRoom = breachMap
                            .flat()
                            .filter(room => {
                                if (room.specialType?.startsWith('K') && !progress.keysFound.includes(room.specialType)) return true;
                                return !room.isDiscovered;
                            })
                            .sort((a, b) => {
                                const aDist = Math.abs(a.x - updatedB.roomX) + Math.abs(a.y - updatedB.roomY);
                                const bDist = Math.abs(b.x - updatedB.roomX) + Math.abs(b.y - updatedB.roomY);
                                const aIsKey = a.specialType?.startsWith('K') ? 0 : 1;
                                const bIsKey = b.specialType?.startsWith('K') ? 0 : 1;
                                if (aIsKey !== bIsKey) return aIsKey - bIsKey;
                                return aDist - bDist;
                            })[0];

                        // If we're already in the target room, fall back to loot/enemy cleanup.
                        if (targetRoom && (targetRoom.x !== updatedB.roomX || targetRoom.y !== updatedB.roomY)) {
                            const roomDx = targetRoom.x - updatedB.roomX;
                            const roomDy = targetRoom.y - updatedB.roomY;
                            const preferredExits = [
                                roomDx > 0 ? '>' : roomDx < 0 ? '<' : null,
                                roomDy > 0 ? 'v' : roomDy < 0 ? '^' : null
                            ].filter((glyph): glyph is string => !!glyph);

                            for (const glyph of preferredExits) {
                                const exitTiles = getTilesByGlyph(updatedB.grid, glyph);
                                const bestMove = findNextStep(updatedB.grid, currentPos, exitTiles);
                                if (bestMove) {
                                    const result = processBreachMove(updatedB, bestMove.dx, bestMove.dy, breachMap);
                                    if (result) {
                                        effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                        if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                        if (result.spawnBrickedNode) {
                                            setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                        }
                                        return { ...result.nextBreach, isAutoPlaying: true };
                                    }
                                }
                            }
                        }

                        if (updatedB.loot.length > 0) {
                            const bestMove = findNextStep(updatedB.grid, currentPos, updatedB.loot.map(l => l.pos));
                            if (bestMove) {
                                const result = processBreachMove(updatedB, bestMove.dx, bestMove.dy, breachMap);
                                if (result) {
                                    effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                    if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                    if (result.spawnBrickedNode) {
                                        setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                    }
                                    return { ...result.nextBreach, isAutoPlaying: true };
                                }
                            }
                        }

                        const adjEnemy = updatedB.enemies.find(e => Math.abs(e.pos.x - currentPos.x) + Math.abs(e.pos.y - currentPos.y) === 1);
                        if (adjEnemy) {
                            const result = processBreachMove(updatedB, adjEnemy.pos.x - currentPos.x, adjEnemy.pos.y - currentPos.y, breachMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                        }

                        if (updatedB.enemies.length > 0) {
                            const bestMove = findNextStep(updatedB.grid, currentPos, updatedB.enemies.map(e => e.pos));
                            if (bestMove) {
                                const result = processBreachMove(updatedB, bestMove.dx, bestMove.dy, breachMap);
                                if (result) {
                                    effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                    if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                    if (result.spawnBrickedNode) {
                                        setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                    }
                                    return { ...result.nextBreach, isAutoPlaying: true };
                                }
                            }
                        }
                    }

                    // === ROGUE: evade enemies, prioritize loot/stairs ===
                    if (updatedB.spec === 'rogue') {
                        // Rogue skips enemies, goes for loot then stairs
                        let bestMove = null;
                        if (updatedB.loot.length > 0) {
                            // Check if adjacent loot
                            const adjLoot = updatedB.loot.find(l => Math.abs(l.pos.x - currentPos.x) + Math.abs(l.pos.y - currentPos.y) === 1);
                            if (adjLoot) {
                                const result = processBreachMove(updatedB, adjLoot.pos.x - currentPos.x, adjLoot.pos.y - currentPos.y, breachMap);
                                if (result) {
                                    effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                    if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                    if (result.spawnBrickedNode) {
                                        setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                    }
                                    return { ...result.nextBreach, isAutoPlaying: true };
                                }
                            }
                            bestMove = findNextStep(updatedB.grid, currentPos, updatedB.loot.map(l => l.pos));
                        }
                        if (!bestMove && updatedB.stairsPos.x >= 0) {
                            bestMove = findNextStep(updatedB.grid, currentPos, [updatedB.stairsPos]);
                        }
                        if (bestMove) {
                            const result = processBreachMove(updatedB, bestMove.dx, bestMove.dy, breachMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                        }
                    } else {
                        // === FIGHTER / MINER / SUMMONER: standard priority ===
                        
                        // 1. Attack adjacent enemy
                        const adjEnemy = updatedB.enemies.find(e => Math.abs(e.pos.x - currentPos.x) + Math.abs(e.pos.y - currentPos.y) === 1);
                        if (adjEnemy) {
                            const result = processBreachMove(updatedB, adjEnemy.pos.x - currentPos.x, adjEnemy.pos.y - currentPos.y, breachMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                            return updatedB;
                        }

                        // 2. Grab adjacent loot
                        const adjLoot = updatedB.loot.find(l => Math.abs(l.pos.x - currentPos.x) + Math.abs(l.pos.y - currentPos.y) === 1);
                        if (adjLoot) {
                            const result = processBreachMove(updatedB, adjLoot.pos.x - currentPos.x, adjLoot.pos.y - currentPos.y, breachMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                            return updatedB;
                        }

                        // 3. Pathfind: Fighter prioritizes enemies, others do loot→enemies→stairs
                        let bestMove = null;
                        if (updatedB.spec === 'fighter' && updatedB.enemies.length > 0) {
                            bestMove = findNextStep(updatedB.grid, currentPos, updatedB.enemies.map(e => e.pos));
                        }
                        if (!bestMove && updatedB.loot.length > 0) {
                            bestMove = findNextStep(updatedB.grid, currentPos, updatedB.loot.map(l => l.pos));
                        }
                        if (!bestMove && updatedB.enemies.length > 0) {
                            bestMove = findNextStep(updatedB.grid, currentPos, updatedB.enemies.map(e => e.pos));
                        }
                        if (!bestMove && updatedB.stairsPos.x >= 0) {
                            bestMove = findNextStep(updatedB.grid, currentPos, [updatedB.stairsPos]);
                        }

                        if (bestMove) {
                            const result = processBreachMove(updatedB, bestMove.dx, bestMove.dy, breachMap);
                            if (result) {
                                effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                                if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                                if (result.spawnBrickedNode) {
                                    setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                                }
                                return { ...result.nextBreach, isAutoPlaying: true };
                            }
                        }
                    }

                    // Random walk fallback
                    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }]
                        .sort(() => Math.random() - 0.5);
                    for (const dir of dirs) {
                        const result = processBreachMove(updatedB, dir.dx, dir.dy, breachMap);
                        if (result) {
                            effects.push({ cu: result.cu, res: result.res, sounds: result.sounds });
                            if (result.updatedRoom) updatedRooms.push({ ...result.updatedRoom, floor: updatedB.floor });
                            if (result.spawnBrickedNode) {
                                setTimeout(() => setActiveBrickedNode(result.spawnBrickedNode!), 0);
                            }
                            return { ...result.nextBreach, isAutoPlaying: true };
                        }
                    }

                    return { ...updatedB, isAutoPlaying: true };
                });
            });

            // Execute buffered effects
            updatedRooms.forEach(r => {
                updateFloorMap(r.floor, (prev: Room[][]): Room[][] => {
                    const newMap = [...prev];
                    if (newMap[r.y]) {
                        const row = [...newMap[r.y]];
                        row[r.x] = r;
                        newMap[r.y] = row;
                    }
                    return newMap;
                });
            });

            effects.forEach(e => {
                if (e.cu) addComputeUnits(e.cu);
                if (e.res) addRestoration(e.res);
                e.sounds.forEach(s => playSound(s as any));
            });

            [...new Set(pendingFloorAdvances)].forEach(id => nextFloor(id));

            // Check for newly cleared rooms in metadata
            setBreaches(prev => {
                prev.forEach(b => {
                    if (b.enemies.length === 0 && b.loot.length === 0) {
                        updateFloorMap(b.floor, prevMap => {
                            if (prevMap[b.roomY][b.roomX].isCleared) return prevMap;
                            const newMap = [...prevMap];
                            const row = [...newMap[b.roomY]];
                            row[b.roomX] = { ...row[b.roomX], isCleared: true, isDiscovered: true };
                            newMap[b.roomY] = row;
                            return newMap;
                        });
                    }
                });
                return prev;
            });
        }, getTickDuration());

        return () => clearInterval(aiInterval);
    }, [activeBreachId, crawlerStats.speedBoost, addComputeUnits, addRestoration, playSound, processBreachMove, getMetaMapForFloor, updateFloorMap, getMinerTicksRequired, getTickDuration]);

    const toggleMarker = useCallback((rx: number, ry: number, label: string = 'MARK') => {
        const key = `${rx},${ry}`;
        setRoomMarkers(prev => {
            const next = { ...prev };
            if (next[key]) delete next[key];
            else next[key] = label;
            return next;
        });
    }, []);

    const claimFloor = useCallback((floor: number) => {
        if (isFloorClaimed(floor)) return false;
        if (claimedFloors.length >= getMaxClaimCount()) return false;
        const progress = getFloorProgress(floor);
        if (progress.locksOpened.length < 3) return false;

        const cost = getClaimCost(floor);
        if (!spendComputeUnits(cost.cu)) return false;
        if (!spendProtocolTokens(cost.tokens)) {
            addComputeUnits(cost.cu);
            return false;
        }

        setClaimedFloors(prev => [...prev, {
            floor,
            claimedAt: Date.now(),
            claimCostCU: cost.cu,
            claimCostTokens: cost.tokens,
            infrastructure: []
        }]);
        recordOpsLedgerEvent({
            type: 'claim',
            message: `Claimed floor ${floor}.`,
            floor,
            amountCU: -cost.cu,
            amountTokens: -cost.tokens
        });
        return true;
    }, [addComputeUnits, claimedFloors.length, getClaimCost, getFloorProgress, getMaxClaimCount, isFloorClaimed, spendComputeUnits, spendProtocolTokens, recordOpsLedgerEvent]);

    const buildInfrastructure = useCallback((floor: number, type: FloorInfrastructureType) => {
        const claimed = getClaimedFloor(floor);
        if (!claimed) return false;
        if (claimed.infrastructure.length >= MAX_INFRASTRUCTURE_SLOTS) return false;

        const cost = getInfrastructureCost(floor, type);
        if (!spendComputeUnits(cost.cu)) return false;
        if (!spendProtocolTokens(cost.tokens)) {
            addComputeUnits(cost.cu);
            return false;
        }

        setClaimedFloors(prev => prev.map(entry => {
            if (entry.floor !== floor) return entry;
            if (entry.infrastructure.length >= MAX_INFRASTRUCTURE_SLOTS) return entry;
            const floorMap = floorMaps[floor] ?? generateMetaMap(floor);
            const placement = pickInfrastructureRoom(floorMap, entry.infrastructure);
            return {
                ...entry,
                infrastructure: [...entry.infrastructure, { type, ...placement }]
            };
        }));

        recordOpsLedgerEvent({
            type: 'build',
            message: `Built ${type.toUpperCase()} on floor ${floor}.`,
            floor,
            amountCU: -cost.cu,
            amountTokens: -cost.tokens
        });

        return true;
    }, [addComputeUnits, floorMaps, getClaimedFloor, getInfrastructureCost, spendComputeUnits, spendProtocolTokens, recordOpsLedgerEvent]);

    const nextFloor = useCallback((id: string) => {
        const breach = breachesRef.current.find(b => b.id === id);
        if (!breach) return;

        const progress = getFloorProgress(breach.floor);
        if (progress.locksOpened.length < 3) return;

        const nextF = breach.floor + 1;
        const newMap = floorMaps[nextF] ?? generateMetaMap(nextF);
        const rx = 4 + Math.floor(Math.random() * 2);
        const ry = 4 + Math.floor(Math.random() * 2);
        const startRoom = newMap[ry][rx];

        setFloorMaps(prev => {
            const baseMap = prev[nextF] ?? newMap;
            const updatedMap = [...baseMap];
            const row = [...updatedMap[ry]];
            row[rx] = { ...row[rx], isDiscovered: true };
            updatedMap[ry] = row;
            return { ...prev, [nextF]: updatedMap };
        });
        setFloorProgress(prev => (
            prev[nextF]
                ? prev
                : { ...prev, [nextF]: { keysFound: [], locksOpened: [] } }
        ));
        setRoomMarkers({});

        setBreaches(prev => prev.map(b => {
            if (b.id !== id) return b;
            return {
                ...b,
                floor: nextF,
                roomX: rx,
                roomY: ry,
                grid: startRoom.grid,
                playerPos: startRoom.playerSpawn,
                stairsPos: startRoom.stairsPos,
                enemies: [...startRoom.enemies],
                loot: [...startRoom.loot],
                visitedRooms: [`${rx},${ry}`],
                daemons: [],
                minerTickAccum: 0,
                logs: [...b.logs.slice(-4), `[TRANSITIONING TO FLOOR ${nextF}]`]
            };
        }));
        recordOpsLedgerEvent({
            type: 'advance',
            message: `${breach.callsign} advanced to floor ${nextF}.`,
            floor: nextF
        });
        playSound('boot');
    }, [floorMaps, getFloorProgress, playSound, recordOpsLedgerEvent]);

    useEffect(() => {
        if (claimedFloors.length === 0) return;

        const interval = setInterval(() => {
            let totalCU = 0;

            claimedFloors.forEach(entry => {
                const miningRigCount = entry.infrastructure.filter(item => item.type === 'mining-rig').length;
                if (miningRigCount > 0) {
                    totalCU += miningRigCount * (5 + entry.floor * 2);
                }
            });

            if (totalCU > 0) {
                addComputeUnits(totalCU);
                recordOpsLedgerEvent({
                    type: 'income',
                    message: `Infrastructure payout: +${totalCU} CU.`,
                    amountCU: totalCU
                });
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [addComputeUnits, claimedFloors, recordOpsLedgerEvent]);

    useEffect(() => {
        if (claimedFloors.length === 0) return;

        const interval = setInterval(() => {
            const deepScanLevel = getOSModuleLevel('deep-scan-bus');
            claimedFloors.forEach(entry => {
                const scannerCount = countInfrastructureByType(entry, 'scanner-tower');
                if (scannerCount <= 0) return;

                updateFloorMap(entry.floor, prevMap => {
                    let nextMap = prevMap;

                    for (let sweep = 0; sweep < scannerCount + deepScanLevel; sweep++) {
                        const target = pickScannerRevealRoom(nextMap);
                        if (!target) break;

                        const cloned = [...nextMap];
                        const row = [...cloned[target.y]];
                        row[target.x] = { ...row[target.x], isDiscovered: true };
                        cloned[target.y] = row;
                        nextMap = cloned;
                    }

                    return nextMap;
                });
            });
        }, 4500);

        return () => clearInterval(interval);
    }, [claimedFloors, getOSModuleLevel, updateFloorMap]);

    useEffect(() => {
        const interval = setInterval(() => {
            const deepScanLevel = getOSModuleLevel('deep-scan-bus');
            breaches.forEach(breach => {
                if (breach.isPaused || breach.hp <= 0 || breach.spec === 'miner') return;

                const uplinkCount = getInfrastructureCount(breach.floor, 'relay-uplink');
                if (uplinkCount <= 0) return;

                const isBeingControlled = breach.id === activeBreachId && (Date.now() - breach.lastInputTime < 4000);
                if (isBeingControlled) return;

                const breachMap = getMetaMapForFloor(breach.floor);
                const extraMoves = Math.min(4, uplinkCount + deepScanLevel);

                for (let step = 0; step < extraMoves; step++) {
                    const liveBreach = breaches.find(item => item.id === breach.id) ?? breach;
                    const livePos = liveBreach.playerPos;
                    let nextMove: { dx: number; dy: number } | null = null;

                    const adjacentEnemy = liveBreach.enemies.find(e => Math.abs(e.pos.x - livePos.x) + Math.abs(e.pos.y - livePos.y) === 1);
                    if (adjacentEnemy) {
                        nextMove = { dx: adjacentEnemy.pos.x - livePos.x, dy: adjacentEnemy.pos.y - livePos.y };
                    }

                    if (!nextMove) {
                        const adjacentLoot = liveBreach.loot.find(l => Math.abs(l.pos.x - livePos.x) + Math.abs(l.pos.y - livePos.y) === 1);
                        if (adjacentLoot) {
                            nextMove = { dx: adjacentLoot.pos.x - livePos.x, dy: adjacentLoot.pos.y - livePos.y };
                        }
                    }

                    if (!nextMove && liveBreach.spec === 'explorer') {
                        const progress = getFloorProgress(liveBreach.floor);
                        const targetRoom = breachMap
                            .flat()
                            .filter(room => {
                                if (room.specialType?.startsWith('K') && !progress.keysFound.includes(room.specialType)) return true;
                                return !room.isDiscovered;
                            })
                            .sort((a, b) => {
                                const aDist = Math.abs(a.x - liveBreach.roomX) + Math.abs(a.y - liveBreach.roomY);
                                const bDist = Math.abs(b.x - liveBreach.roomX) + Math.abs(b.y - liveBreach.roomY);
                                const aIsKey = a.specialType?.startsWith('K') ? 0 : 1;
                                const bIsKey = b.specialType?.startsWith('K') ? 0 : 1;
                                if (aIsKey !== bIsKey) return aIsKey - bIsKey;
                                return aDist - bDist;
                            })[0];

                        if (targetRoom && (targetRoom.x !== liveBreach.roomX || targetRoom.y !== liveBreach.roomY)) {
                            const roomDx = targetRoom.x - liveBreach.roomX;
                            const roomDy = targetRoom.y - liveBreach.roomY;
                            const preferredExits = [
                                roomDx > 0 ? '>' : roomDx < 0 ? '<' : null,
                                roomDy > 0 ? 'v' : roomDy < 0 ? '^' : null
                            ].filter((glyph): glyph is string => !!glyph);

                            for (const glyph of preferredExits) {
                                const exitTiles = getTilesByGlyph(liveBreach.grid, glyph);
                                const bestMove = findNextStep(liveBreach.grid, livePos, exitTiles);
                                if (bestMove) {
                                    nextMove = bestMove;
                                    break;
                                }
                            }
                        }
                    }

                    if (!nextMove && liveBreach.loot.length > 0) {
                        nextMove = findNextStep(liveBreach.grid, livePos, liveBreach.loot.map(l => l.pos));
                    }

                    if (!nextMove && liveBreach.enemies.length > 0) {
                        nextMove = findNextStep(liveBreach.grid, livePos, liveBreach.enemies.map(e => e.pos));
                    }

                    if (!nextMove && liveBreach.stairsPos.x >= 0) {
                        nextMove = findNextStep(liveBreach.grid, livePos, [liveBreach.stairsPos]);
                    }

                    if (!nextMove) break;
                    movePlayer(liveBreach.id, nextMove.dx, nextMove.dy);
                }
            });
        }, Math.max(75, Math.floor(getTickDuration() * Math.max(0.3, 0.55 - (getOSModuleLevel('deep-scan-bus') * 0.05)))));

        return () => clearInterval(interval);
    }, [activeBreachId, breaches, getFloorProgress, getInfrastructureCount, getMetaMapForFloor, getOSModuleLevel, getTickDuration, movePlayer]);

    useEffect(() => {
        const runExplorerAutoAdvance = () => {
            const readyExplorers = breachesRef.current
                .filter(breach => breach.spec === 'explorer' && !breach.isPaused && breach.hp > 0)
                .filter(breach => getFloorProgress(breach.floor).locksOpened.length >= 3)
                .map(breach => breach.id);

            [...new Set(readyExplorers)].forEach(id => nextFloor(id));
        };

        runExplorerAutoAdvance();
        const interval = setInterval(runExplorerAutoAdvance, 900);
        return () => clearInterval(interval);
    }, [getFloorProgress, nextFloor]);

    useEffect(() => {
        const managerAgents = codexAgents.filter(agent => agent.strategy === 'manager');
        if (managerAgents.length === 0) return;

        const runManagerCycle = () => {
            const schedulerLevel = getOSModuleLevel('scheduler-kernel');
            const folderTargets: Record<CrawlerSpec, string> = {
                miner: 'MINING',
                rogue: 'SCOUTING',
                summoner: 'SUMMONING',
                fighter: 'ASSAULT',
                explorer: 'EXPLORATION'
            };

            const missingFolderNames = Object.values(folderTargets).filter(folderName =>
                !breachFolders.some(folder => folder.name.toLowerCase() === folderName.toLowerCase())
            );

            const assignmentTargets = breachesRef.current
                .filter(breach => breach.isMinimized)
                .map(breach => {
                    const targetFolderName = folderTargets[breach.spec];
                    const targetFolder = breachFolders.find(folder => folder.name.toLowerCase() === targetFolderName.toLowerCase());
                    return { breach, targetFolder };
                })
                .filter(({ breach, targetFolder }) => targetFolder && folderAssignments[breach.id] !== targetFolder.id);

            const departmentTargets = breachesRef.current
                .filter(breach => breach.isMinimized)
                .map(breach => {
                    const folderId = folderAssignments[breach.id];
                    const departmentId = folderId ? departmentAssignments[folderId] : undefined;
                    const department = departmentId ? breachDepartments.find(item => item.id === departmentId) : undefined;
                    return { breach, department };
                })
                .filter(({ department }) => !!department);

            const respecTargets = departmentTargets.filter(({ breach, department }) =>
                department &&
                department.defaultSpec !== 'mixed' &&
                breach.spec !== department.defaultSpec
            );

            const readyBreaches = breachesRef.current
                .filter(breach => getFloorProgress(breach.floor).locksOpened.length >= 3);

            const autoAdvanceTargets = readyBreaches;

            const rawCycleCost =
                (missingFolderNames.length > 0 ? 6 : 0) +
                (assignmentTargets.length * 2) +
                (respecTargets.length * 3) +
                (autoAdvanceTargets.length * 10);
            const cycleCost = Math.max(1, Math.ceil(rawCycleCost * Math.max(0.35, 1 - (schedulerLevel * 0.15))));

            if (cycleCost <= 0) return;

            const payingManager = managerAgents.find(agent => spendAgentFunds(agent.id, cycleCost));
            if (!payingManager) return;

            missingFolderNames.forEach(folderName => {
                createBreachFolder(folderName);
            });

            assignmentTargets.forEach(({ breach, targetFolder }) => {
                if (targetFolder) {
                    assignBreachToFolder(breach.id, targetFolder.id);
                }
            });

            respecTargets.forEach(({ breach, department }) => {
                if (department && department.defaultSpec !== 'mixed') {
                    setBreachSpec(breach.id, department.defaultSpec);
                }
            });

            autoAdvanceTargets.forEach(breach => nextFloor(breach.id));
            triggerAlert(
                'AGENT ACTION COMPLETE',
                `${payingManager.nickname?.trim() ? `${payingManager.nickname} // ${payingManager.name}` : payingManager.name} coordinated ${assignmentTargets.length + respecTargets.length + autoAdvanceTargets.length + missingFolderNames.length} breach action${assignmentTargets.length + respecTargets.length + autoAdvanceTargets.length + missingFolderNames.length === 1 ? '' : 's'}.`
            );
        };

        runManagerCycle();
        const interval = setInterval(runManagerCycle, Math.max(450, 1200 - (getOSModuleLevel('scheduler-kernel') * 150)));

        return () => clearInterval(interval);
    }, [assignBreachToFolder, breachDepartments, breachFolders, codexAgents, createBreachFolder, departmentAssignments, folderAssignments, getFloorProgress, getOSModuleLevel, nextFloor, setBreachSpec, spendAgentFunds]);

    useEffect(() => {
        const builderAgents = codexAgents.filter(agent => agent.strategy === 'builder');
        if (builderAgents.length === 0) return;

        const pickBuildType = (floor: number): FloorInfrastructureType | null => {
            const claimed = getClaimedFloor(floor);
            if (!claimed || claimed.infrastructure.length >= MAX_INFRASTRUCTURE_SLOTS) return null;

            const miningCount = countInfrastructureByType(claimed, 'mining-rig');
            const uplinkCount = countInfrastructureByType(claimed, 'relay-uplink');
            const scannerCount = countInfrastructureByType(claimed, 'scanner-tower');

            if (miningCount === 0) return 'mining-rig';
            if (uplinkCount === 0) return 'relay-uplink';
            if (scannerCount === 0) return 'scanner-tower';
            if (miningCount <= uplinkCount + scannerCount) return 'mining-rig';
            if (scannerCount < 2) return 'scanner-tower';
            return 'relay-uplink';
        };

        const runBuilderCycle = () => {
            const logisticsLevel = getOSModuleLevel('logistics-mesh');
            for (const agent of builderAgents) {
                const canCoverOpCost = (amount: number) =>
                    agent.budget >= amount || (agent.maxBudget === 0 && computeUnits >= amount);
                const availableComputeAfterOp = (amount: number) =>
                    agent.maxBudget === 0 ? Math.max(0, computeUnits - amount) : computeUnits;

                const claimOpCost = Math.max(6, 18 - (logisticsLevel * 2));
                const buildOpCost = Math.max(4, 12 - (logisticsLevel * 2));

                const claimTarget = canCoverOpCost(claimOpCost)
                    ? [...availableFloors]
                        .sort((a, b) => a - b)
                        .find(floor => {
                            if (isFloorClaimed(floor)) return false;
                            const progress = getFloorProgress(floor);
                            if (progress.locksOpened.length < 3) return false;
                            const cost = getClaimCost(floor);
                            return availableComputeAfterOp(claimOpCost) >= cost.cu && protocolTokens >= cost.tokens;
                        })
                    : undefined;

                if (claimTarget !== undefined) {
                    if (!spendAgentFunds(agent.id, claimOpCost)) continue;
                    if (claimFloor(claimTarget)) {
                        triggerAlert(
                            'AGENT ACTION COMPLETE',
                            `${agent.nickname?.trim() ? `${agent.nickname} // ${agent.name}` : agent.name} claimed floor ${claimTarget}.`
                        );
                        break;
                    }
                }

                const buildTarget = canCoverOpCost(buildOpCost)
                    ? [...claimedFloors]
                        .sort((a, b) => a.floor - b.floor)
                        .map(entry => {
                            const type = pickBuildType(entry.floor);
                            return type ? { floor: entry.floor, type, cost: getInfrastructureCost(entry.floor, type) } : null;
                        })
                        .find(entry => entry && availableComputeAfterOp(buildOpCost) >= entry.cost.cu && protocolTokens >= entry.cost.tokens) ?? null
                    : null;

                if (buildTarget) {
                    if (!spendAgentFunds(agent.id, buildOpCost)) continue;
                    if (buildInfrastructure(buildTarget.floor, buildTarget.type)) {
                        triggerAlert(
                            'AGENT ACTION COMPLETE',
                            `${agent.nickname?.trim() ? `${agent.nickname} // ${agent.name}` : agent.name} built ${buildTarget.type.toUpperCase()} on floor ${buildTarget.floor}.`
                        );
                        break;
                    }
                }
            }
        };

        runBuilderCycle();
        const interval = setInterval(runBuilderCycle, Math.max(900, 2200 - (getOSModuleLevel('logistics-mesh') * 220)));

        return () => clearInterval(interval);
    }, [availableFloors, buildInfrastructure, claimFloor, claimedFloors, codexAgents, computeUnits, getClaimCost, getClaimedFloor, getFloorProgress, getInfrastructureCost, getOSModuleLevel, isFloorClaimed, protocolTokens, spendAgentFunds]);

    return (
        <DungeonContext.Provider value={{
            breaches, metaMap, getMetaMapForFloor, availableFloors, claimedFloors, breachDepartments, breachFolders, departmentAssignments, folderAssignments, activeBreachId, currentFloor, keysFound, locksOpened, getFloorProgress, getClaimCost, getInfrastructureCost, getClaimedFloor, isFloorClaimed, roomMarkers,
            setActiveBreachId,
            movePlayer, togglePause, toggleMinimize, togglePin, terminateBreach,
            initNewBreach, mascotSay, restartBreach, setBreachSpec, toggleMarker, nextFloor, claimFloor, buildInfrastructure,
            createBreachFolder, renameBreachFolder, deleteBreachFolder, assignBreachToFolder,
            createBreachDepartment, renameBreachDepartment, deleteBreachDepartment, assignFolderToDepartment, updateDepartmentSettings
        }}>{children}</DungeonContext.Provider>
    );
}

export const useDungeon = () => {
    const context = useContext(DungeonContext);
    if (!context) throw new Error('useDungeon must be used within a DungeonProvider');
    return context;
};
