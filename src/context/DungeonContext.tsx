import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useGameState, type CrawlerSpec, type BrickedNode } from './GameStateContext';
import { type Position, type Enemy, type Loot } from '../utils/dungeonGenerator';
import { useSound } from '../hooks/useSound';
import { findNextStep } from '../utils/pathfinding';
import { generateMetaMap, MAX_SEED_FLOORS, type Room } from '../utils/metaMap';
import { rollCipherDrop } from '../utils/cipherSystem';
import { formatComputeUnits } from '../utils/numberFormat';

export interface BreachFolder {
    id: string;
    name: string;
}

export interface BreachDepartment {
    id: string;
    name: string;
    themeColor: DepartmentThemeId;
    defaultSpec: CrawlerSpec | 'mixed';
    commandScript: CommandScriptId;
    allocationMode: DepartmentAllocationMode;
    targetFloorMin: number;
    targetFloorMax: number;
}

export type CommandScriptId = 'default' | 'scout' | 'lockrun' | 'harvest' | 'hold' | 'deep-push';
export type DepartmentAllocationMode = 'balanced' | 'expansion' | 'infrastructure';
export type DepartmentThemeId = 'cyan' | 'amber' | 'lime' | 'rose' | 'violet' | 'ocean';

export const DEPARTMENT_THEME_OPTIONS: Array<{
    id: DepartmentThemeId;
    label: string;
    accent: string;
    border: string;
    surface: string;
}> = [
    { id: 'cyan', label: 'CYAN', accent: '#38a3a0', border: 'rgba(56, 163, 160, 0.35)', surface: 'rgba(56, 163, 160, 0.08)' },
    { id: 'amber', label: 'AMBER', accent: '#d8a44f', border: 'rgba(216, 164, 79, 0.35)', surface: 'rgba(216, 164, 79, 0.08)' },
    { id: 'lime', label: 'LIME', accent: '#7fbf5f', border: 'rgba(127, 191, 95, 0.35)', surface: 'rgba(127, 191, 95, 0.08)' },
    { id: 'rose', label: 'ROSE', accent: '#d46a7a', border: 'rgba(212, 106, 122, 0.35)', surface: 'rgba(212, 106, 122, 0.08)' },
    { id: 'violet', label: 'VIOLET', accent: '#8d7ae6', border: 'rgba(141, 122, 230, 0.35)', surface: 'rgba(141, 122, 230, 0.08)' },
    { id: 'ocean', label: 'OCEAN', accent: '#4f8dd8', border: 'rgba(79, 141, 216, 0.35)', surface: 'rgba(79, 141, 216, 0.08)' }
];

export const getDepartmentTheme = (themeId?: DepartmentThemeId) => (
    DEPARTMENT_THEME_OPTIONS.find(theme => theme.id === themeId) ?? DEPARTMENT_THEME_OPTIONS[0]
);

export type FloorInfrastructureType =
    | 'mining-rig'
    | 'relay-uplink'
    | 'repair-dock'
    | 'scanner-tower'
    | 'quarantine-node'
    | 'dispatch-beacon'
    | 'token-mint';

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
    initBreachesBulk: (count: number, spec?: CrawlerSpec, options?: { folderId?: string; isMinimized?: boolean }) => string[];
    mascotSay: (id: string, msg: string) => void;
    restartBreach: (id: string) => void;
    setBreachSpec: (id: string, spec: CrawlerSpec) => void;
    toggleMarker: (rx: number, ry: number, label?: string) => void;
    nextFloor: (id: string) => void;
    moveBreachToFloor: (id: string, targetFloor: number) => boolean;
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
    updateDepartmentSettings: (id: string, updates: Partial<Pick<BreachDepartment, 'themeColor' | 'defaultSpec' | 'commandScript' | 'allocationMode' | 'targetFloorMin' | 'targetFloorMax'>>) => void;
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
const DUNGEON_PRESSURE_STORAGE_KEY = 'latham_dungeon_pressure_state';
export const UNGROUPED_FOLDER_ID = 'ungrouped';
export const UNASSIGNED_DEPARTMENT_ID = 'unassigned';
const MAX_INFRASTRUCTURE_SLOTS = 4;
const MAX_SAVED_BREACH_LOGS = 6;
const MAX_SAVED_VISITED_ROOMS = 12;

function loadSavedDepartments(): BreachDepartment[] {
    try {
        const savedDepartments = localStorage.getItem(DEPARTMENT_STORAGE_KEY);
        if (!savedDepartments) return [];
        const parsedDepartments = JSON.parse(savedDepartments);
        if (!Array.isArray(parsedDepartments)) return [];

        return parsedDepartments
            .filter((department: Partial<BreachDepartment>) =>
                department &&
                typeof department.id === 'string' &&
                typeof department.name === 'string' &&
                (department.defaultSpec === 'mixed' || ['fighter', 'rogue', 'miner', 'summoner', 'explorer'].includes(department.defaultSpec || ''))
            )
            .map((department: Partial<BreachDepartment>) => ({
                id: department.id as string,
                name: department.name as string,
                themeColor: DEPARTMENT_THEME_OPTIONS.some(theme => theme.id === department.themeColor)
                    ? department.themeColor as DepartmentThemeId
                    : DEPARTMENT_THEME_OPTIONS[0].id,
                defaultSpec: (department.defaultSpec as BreachDepartment['defaultSpec']) || 'mixed',
                commandScript: ['default', 'scout', 'lockrun', 'harvest', 'hold', 'deep-push'].includes(department.commandScript || '')
                    ? department.commandScript as CommandScriptId
                    : 'default',
                allocationMode: ['balanced', 'expansion', 'infrastructure'].includes(department.allocationMode || '')
                    ? department.allocationMode as DepartmentAllocationMode
                    : 'balanced',
                targetFloorMin: normalizeDepartmentRange(department.targetFloorMin, department.targetFloorMax).min,
                targetFloorMax: normalizeDepartmentRange(department.targetFloorMin, department.targetFloorMax).max
            }));
    } catch {
        return [];
    }
}

function loadSavedFolders(): BreachFolder[] {
    try {
        const savedFolders = localStorage.getItem(FOLDER_STORAGE_KEY);
        if (!savedFolders) return [];
        const parsedFolders = JSON.parse(savedFolders);
        return Array.isArray(parsedFolders)
            ? parsedFolders.filter((folder: BreachFolder) => folder && typeof folder.id === 'string' && typeof folder.name === 'string')
            : [];
    } catch {
        return [];
    }
}

function loadSavedDepartmentAssignments(): Record<string, string> {
    try {
        const savedDepartmentAssignments = localStorage.getItem(DEPARTMENT_ASSIGNMENT_STORAGE_KEY);
        if (!savedDepartmentAssignments) return {};
        const parsedDepartmentAssignments = JSON.parse(savedDepartmentAssignments);
        return parsedDepartmentAssignments && typeof parsedDepartmentAssignments === 'object'
            ? parsedDepartmentAssignments
            : {};
    } catch {
        return {};
    }
}

function loadSavedFolderAssignments(): Record<string, string> {
    try {
        const savedAssignments = localStorage.getItem(ASSIGNMENT_STORAGE_KEY);
        if (!savedAssignments) return {};
        const parsedAssignments = JSON.parse(savedAssignments);
        return parsedAssignments && typeof parsedAssignments === 'object'
            ? parsedAssignments
            : {};
    } catch {
        return {};
    }
}

function normalizeDepartmentRange(minFloor?: number, maxFloor?: number) {
    const normalizedMin = Math.min(MAX_SEED_FLOORS, Math.max(1, Math.floor(minFloor || 1)));
    const normalizedMax = Math.min(MAX_SEED_FLOORS, Math.max(normalizedMin, Math.floor(maxFloor || MAX_SEED_FLOORS)));
    return {
        min: normalizedMin,
        max: normalizedMax
    };
}

const buildUniqueCallsign = (existingCallsigns: string[]) => {
    const usedRoots = existingCallsigns.map(callsign => callsign.split('_')[0] + '_' + callsign.split('_')[1]);
    const availableCallsigns = CALLSIGNS.filter(c => !usedRoots.some(u => u.startsWith(c)));
    const baseCallsign = availableCallsigns[Math.floor(Math.random() * availableCallsigns.length)] || 'NODE_UNKNOWN';
    return `${baseCallsign}_${Math.floor(Math.random() * 99).toString().padStart(2, '0')}`;
};

interface PersistedBreachState {
    id: string;
    callsign: string;
    spec: CrawlerSpec;
    floor: number;
    roomX: number;
    roomY: number;
    playerPos?: Position;
    hp?: number;
    maxHp?: number;
    logs?: string[];
    mascotMessage?: string | null;
    isAutoPlaying?: boolean;
    isPinned?: boolean;
    isPaused?: boolean;
    isMinimized?: boolean;
    lastInputTime?: number;
    visitedRooms?: string[];
    daemons?: Daemon[];
    minerTickAccum?: number;
}

interface PersistedDungeonState {
    breaches?: unknown;
    floorMaps?: unknown;
    floorProgress?: unknown;
    roomMarkers?: unknown;
    claimedFloors?: unknown;
    activeBreachId?: unknown;
}

function loadPersistedDungeonState(): PersistedDungeonState | null {
    try {
        const saved = localStorage.getItem(DUNGEON_STATE_STORAGE_KEY);
        if (!saved) return null;
        return JSON.parse(saved) as PersistedDungeonState;
    } catch {
        return null;
    }
}

function serializeBreachForStorage(breach: BreachInstance): PersistedBreachState {
    return {
        id: breach.id,
        callsign: breach.callsign,
        spec: breach.spec,
        floor: breach.floor,
        roomX: breach.roomX,
        roomY: breach.roomY,
        playerPos: breach.playerPos,
        hp: breach.hp,
        maxHp: breach.maxHp,
        logs: breach.logs.slice(-MAX_SAVED_BREACH_LOGS),
        mascotMessage: breach.mascotMessage,
        isAutoPlaying: breach.isAutoPlaying,
        isPinned: breach.isPinned,
        isPaused: breach.isPaused,
        isMinimized: breach.isMinimized,
        lastInputTime: breach.lastInputTime,
        visitedRooms: (breach.visitedRooms || []).slice(-MAX_SAVED_VISITED_ROOMS),
        daemons: Array.isArray(breach.daemons) ? breach.daemons : [],
        minerTickAccum: breach.minerTickAccum || 0
    };
}

function hydrateSavedBreaches(
    rawBreaches: unknown,
    rawFloorMaps: unknown
): BreachInstance[] {
    if (!Array.isArray(rawBreaches)) return [];

    const savedFloorMaps = rawFloorMaps && typeof rawFloorMaps === 'object'
        ? rawFloorMaps as Record<number, Room[][]>
        : {};

    return rawBreaches
        .map((entry): BreachInstance | null => {
            if (!entry || typeof entry !== 'object') return null;

            const saved = entry as Partial<PersistedBreachState>;
            if (typeof saved.id !== 'string' || typeof saved.callsign !== 'string') return null;
            if (!['fighter', 'rogue', 'miner', 'summoner', 'explorer'].includes(saved.spec || '')) return null;

            const floor = Math.max(1, Math.floor(Number(saved.floor) || 1));
            const fallbackMap = savedFloorMaps[floor] ?? generateMetaMap(floor);
            const roomX = Math.min(9, Math.max(0, Math.floor(Number(saved.roomX) || 4)));
            const roomY = Math.min(9, Math.max(0, Math.floor(Number(saved.roomY) || 4)));
            const room = fallbackMap[roomY]?.[roomX] ?? fallbackMap[4]?.[4] ?? fallbackMap[0]?.[0];
            if (!room) return null;

            const savedPos = saved.playerPos;
            const playerPos =
                savedPos &&
                typeof savedPos.x === 'number' &&
                typeof savedPos.y === 'number' &&
                room.grid[savedPos.y]?.[savedPos.x] !== undefined &&
                room.grid[savedPos.y]?.[savedPos.x] !== '#'
                    ? { x: savedPos.x, y: savedPos.y }
                    : room.playerSpawn;

            const rawMaxHp = Number(saved.maxHp);
            const maxHp = Math.max(1, Math.floor(Number.isFinite(rawMaxHp) ? rawMaxHp : 20));
            const rawHp = Number(saved.hp);
            const hp = Math.max(0, Math.min(maxHp, Math.floor(Number.isFinite(rawHp) ? rawHp : maxHp)));

            return {
                id: saved.id,
                callsign: saved.callsign,
                spec: saved.spec as CrawlerSpec,
                floor,
                roomX,
                roomY,
                grid: room.grid,
                playerPos,
                stairsPos: room.stairsPos,
                enemies: [...room.enemies],
                loot: [...room.loot],
                hp,
                maxHp,
                logs: Array.isArray(saved.logs) ? saved.logs.slice(-MAX_SAVED_BREACH_LOGS) : [],
                mascotMessage: typeof saved.mascotMessage === 'string' ? saved.mascotMessage : null,
                isAutoPlaying: !!saved.isAutoPlaying,
                isPinned: !!saved.isPinned,
                isPaused: !!saved.isPaused,
                isMinimized: !!saved.isMinimized,
                lastInputTime: Number(saved.lastInputTime) || Date.now(),
                visitedRooms: Array.isArray(saved.visitedRooms) && saved.visitedRooms.length > 0
                    ? saved.visitedRooms.slice(-MAX_SAVED_VISITED_ROOMS)
                    : [`${roomX},${roomY}`],
                daemons: Array.isArray(saved.daemons) ? saved.daemons : [],
                minerTickAccum: Number(saved.minerTickAccum) || 0
            };
        })
        .filter((breach): breach is BreachInstance => !!breach);
}

function buildDungeonPressureSnapshot(
    floorMaps: Record<number, Room[][]>,
    claimedFloors: ClaimedFloor[],
    breaches: BreachInstance[]
) {
    const deepestFloor = Math.max(
        1,
        ...Object.keys(floorMaps)
            .map(Number)
            .filter(Number.isFinite)
    );

    const tokenMintCount = claimedFloors.reduce((total, floor) => (
        total + (Array.isArray(floor.infrastructure) ? floor.infrastructure : []).filter(item => item.type === 'token-mint').length
    ), 0);

    return {
        deepestFloor,
        breachCount: breaches.length,
        claimedFloorCount: claimedFloors.length,
        tokenMintCount
    };
}

const INFRASTRUCTURE_TOKEN_MULT: Record<FloorInfrastructureType, number> = {
    'mining-rig': 1,
    'relay-uplink': 1,
    'repair-dock': 1,
    'scanner-tower': 1,
    'quarantine-node': 2,
    'dispatch-beacon': 2,
    'token-mint': 3
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

function pickSpawnRoom(
    floorMap: Room[][],
    claimedFloor: ClaimedFloor | undefined,
    preferredTypes: FloorInfrastructureType[] = []
) {
    for (const type of preferredTypes) {
        const match = claimedFloor?.infrastructure.find(item => item.type === type);
        if (match) {
            return {
                roomX: match.roomX,
                roomY: match.roomY,
                room: floorMap[match.roomY][match.roomX]
            };
        }
    }

    const centerRooms = [
        { x: 4, y: 4 },
        { x: 5, y: 4 },
        { x: 4, y: 5 },
        { x: 5, y: 5 }
    ];
    const target = centerRooms[Math.floor(Math.random() * centerRooms.length)];
    return {
        roomX: target.x,
        roomY: target.y,
        room: floorMap[target.y][target.x]
    };
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
    const { addRestoration, setArchiveRestoration, addComputeUnits, addProtocolTokens, spendComputeUnits, spendProtocolTokens, spendAgentFunds, triggerAlert, computeUnits, protocolTokens, crawlerStats, getDegradation, recordOpsLedgerEvent, getOSModuleLevel, getMaxClaimCount, stabilizeClutter, runCollapseCount,
            addCipherFragment, refactorBonuses, defaultCrawlerSpec, setActiveBrickedNode, codexAgents } = useGameState();
    const { playSound } = useSound();
    const initialSavedDungeonStateRef = useRef<PersistedDungeonState | null>(loadPersistedDungeonState());

    const [breaches, setBreaches] = useState<BreachInstance[]>(() => {
        const parsed = initialSavedDungeonStateRef.current;
        return hydrateSavedBreaches(parsed?.breaches, parsed?.floorMaps);
    });
    const [floorMaps, setFloorMaps] = useState<Record<number, Room[][]>>(() => {
        const parsed = initialSavedDungeonStateRef.current;
        const savedMaps = parsed?.floorMaps;
        if (savedMaps && typeof savedMaps === 'object' && Object.keys(savedMaps).length > 0) {
            return savedMaps as Record<number, Room[][]>;
        }
        return { 1: generateMetaMap(1) };
    });
    const [floorProgress, setFloorProgress] = useState<Record<number, { keysFound: string[]; locksOpened: string[] }>>(() => {
        const parsed = initialSavedDungeonStateRef.current;
        const savedProgress = parsed?.floorProgress;
        if (savedProgress && typeof savedProgress === 'object' && Object.keys(savedProgress).length > 0) {
            return savedProgress as Record<number, { keysFound: string[]; locksOpened: string[] }>;
        }
        return { 1: { keysFound: [], locksOpened: [] } };
    });
    const [roomMarkers, setRoomMarkers] = useState<Record<string, string>>(() => {
        const parsed = initialSavedDungeonStateRef.current;
        return parsed?.roomMarkers && typeof parsed.roomMarkers === 'object'
            ? parsed.roomMarkers as Record<string, string>
            : {};
    });
    const [claimedFloors, setClaimedFloors] = useState<ClaimedFloor[]>(() => {
        const parsed = initialSavedDungeonStateRef.current;
        return Array.isArray(parsed?.claimedFloors) ? parsed.claimedFloors as ClaimedFloor[] : [];
    });
    const [breachDepartments, setBreachDepartments] = useState<BreachDepartment[]>(loadSavedDepartments);
    const [breachFolders, setBreachFolders] = useState<BreachFolder[]>(loadSavedFolders);
    const [departmentAssignments, setDepartmentAssignments] = useState<Record<string, string>>(loadSavedDepartmentAssignments);
    const [folderAssignments, setFolderAssignments] = useState<Record<string, string>>(loadSavedFolderAssignments);
    const [activeBreachId, setActiveBreachId] = useState<string | null>(() => {
        const parsed = initialSavedDungeonStateRef.current;
        return typeof parsed?.activeBreachId === 'string' ? parsed.activeBreachId : null;
    });
    const mascotTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const hasLoadedOrganizationState = useRef(true);
    const breachesRef = useRef<BreachInstance[]>(breaches);
    const aiCursorRef = useRef(0);
    const uplinkCursorRef = useRef(0);
    const dungeonSnapshotRef = useRef({
        breaches,
        floorMaps,
        floorProgress,
        roomMarkers,
        claimedFloors,
        activeBreachId
    });
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
        dungeonSnapshotRef.current = {
            breaches,
            floorMaps,
            floorProgress,
            roomMarkers,
            claimedFloors,
            activeBreachId
        };
    }, [activeBreachId, breaches, claimedFloors, floorMaps, floorProgress, roomMarkers]);

    useEffect(() => {
        const persistDungeonState = () => {
            const snapshot = dungeonSnapshotRef.current;
            try {
                localStorage.setItem(DUNGEON_STATE_STORAGE_KEY, JSON.stringify({
                    breaches: snapshot.breaches.map(serializeBreachForStorage),
                    floorMaps: snapshot.floorMaps,
                    floorProgress: snapshot.floorProgress,
                    roomMarkers: snapshot.roomMarkers,
                    claimedFloors: snapshot.claimedFloors,
                    activeBreachId: snapshot.activeBreachId
                }));
                localStorage.setItem(
                    DUNGEON_PRESSURE_STORAGE_KEY,
                    JSON.stringify(buildDungeonPressureSnapshot(snapshot.floorMaps, snapshot.claimedFloors, snapshot.breaches))
                );
            } catch (error) {
                console.error('PRGN_OS: Failed to persist dungeon state.', error);
            }
        };

        persistDungeonState();
        const interval = setInterval(persistDungeonState, 1500);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (activeBreachId && !breaches.some(breach => breach.id === activeBreachId)) {
            setActiveBreachId(breaches[0]?.id ?? null);
        }
    }, [activeBreachId, breaches]);

    useEffect(() => {
        if (runCollapseCount <= 0) return;

        setBreaches([]);
        setFloorMaps({ 1: generateMetaMap(1) });
        setFloorProgress({ 1: { keysFound: [], locksOpened: [] } });
        setRoomMarkers({});
        setClaimedFloors([]);
        setBreachDepartments([]);
        setBreachFolders([]);
        setDepartmentAssignments({});
        setFolderAssignments({});
        setActiveBreachId(null);
        localStorage.removeItem(FOLDER_STORAGE_KEY);
        localStorage.removeItem(ASSIGNMENT_STORAGE_KEY);
        localStorage.removeItem(DEPARTMENT_STORAGE_KEY);
        localStorage.removeItem(DEPARTMENT_ASSIGNMENT_STORAGE_KEY);
        localStorage.removeItem(DUNGEON_STATE_STORAGE_KEY);
        localStorage.removeItem(DUNGEON_PRESSURE_STORAGE_KEY);
    }, [runCollapseCount]);

    useEffect(() => {
        breachesRef.current = breaches;
    }, [breaches]);

    const getMetaMapForFloor = useCallback((floor: number) => {
        return floorMaps[floor] ?? floorMaps[1];
    }, [floorMaps]);

    const getFloorProgress = useCallback((floor: number) => {
        return floorProgress[floor] ?? { keysFound: [], locksOpened: [] };
    }, [floorProgress]);

    const pickRecoveryFloorForBreach = useCallback((breach: BreachInstance | undefined) => {
        if (!breach) return 1;

        const assignedDepartment = getAssignedDepartmentForBreach(
            breach.id,
            breachFolders,
            breachDepartments,
            folderAssignments,
            departmentAssignments
        );
        const range = assignedDepartment
            ? normalizeDepartmentRange(assignedDepartment.targetFloorMin, assignedDepartment.targetFloorMax)
            : null;

        const filterRange = (entry: ClaimedFloor) => !range || (entry.floor >= range.min && entry.floor <= range.max);

        const repairFloorsInRange = claimedFloors
            .filter(entry => filterRange(entry) && countInfrastructureByType(entry, 'repair-dock') > 0)
            .sort((a, b) => b.floor - a.floor);
        if (repairFloorsInRange[0]) return repairFloorsInRange[0].floor;

        const repairFloors = claimedFloors
            .filter(entry => countInfrastructureByType(entry, 'repair-dock') > 0)
            .sort((a, b) => b.floor - a.floor);
        if (repairFloors[0]) return repairFloors[0].floor;

        const beaconFloorsInRange = claimedFloors
            .filter(entry => filterRange(entry) && countInfrastructureByType(entry, 'dispatch-beacon') > 0)
            .sort((a, b) => b.floor - a.floor);
        if (beaconFloorsInRange[0]) return beaconFloorsInRange[0].floor;

        const beaconFloors = claimedFloors
            .filter(entry => countInfrastructureByType(entry, 'dispatch-beacon') > 0)
            .sort((a, b) => b.floor - a.floor);
        if (beaconFloors[0]) return beaconFloors[0].floor;

        return 1;
    }, [breachDepartments, breachFolders, claimedFloors, departmentAssignments, folderAssignments]);

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
        const cuBase = 150 + (Math.max(1, floor) * 50) + (type === 'mining-rig' ? 0 : 75) + (type === 'token-mint' ? 450 : 0);
        return {
            cu: Math.max(10, Math.round((cuBase * 10) * discountMultiplier)),
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
        if (!hasLoadedOrganizationState.current) return;
        try {
            localStorage.setItem(DEPARTMENT_STORAGE_KEY, JSON.stringify(breachDepartments));
        } catch (error) {
            console.error('PRGN_OS: Failed to persist breach departments.', error);
        }
    }, [breachDepartments]);

    useEffect(() => {
        if (!hasLoadedOrganizationState.current) return;
        try {
            localStorage.setItem(DEPARTMENT_ASSIGNMENT_STORAGE_KEY, JSON.stringify(departmentAssignments));
        } catch (error) {
            console.error('PRGN_OS: Failed to persist department assignments.', error);
        }
    }, [departmentAssignments]);

    useEffect(() => {
        if (!hasLoadedOrganizationState.current) return;
        try {
            localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(breachFolders));
        } catch (error) {
            console.error('PRGN_OS: Failed to persist breach folders.', error);
        }
    }, [breachFolders]);

    useEffect(() => {
        if (!hasLoadedOrganizationState.current) return;
        try {
            localStorage.setItem(ASSIGNMENT_STORAGE_KEY, JSON.stringify(folderAssignments));
        } catch (error) {
            console.error('PRGN_OS: Failed to persist folder assignments.', error);
        }
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
        setBreachDepartments(prev => [...prev, {
            id,
            name: normalized,
            themeColor: DEPARTMENT_THEME_OPTIONS[prev.length % DEPARTMENT_THEME_OPTIONS.length].id,
            defaultSpec: 'mixed',
            commandScript: 'default',
            allocationMode: 'balanced',
            targetFloorMin: 1,
            targetFloorMax: MAX_SEED_FLOORS
        }]);
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

    const updateDepartmentSettings = useCallback((id: string, updates: Partial<Pick<BreachDepartment, 'themeColor' | 'defaultSpec' | 'commandScript' | 'allocationMode' | 'targetFloorMin' | 'targetFloorMax'>>) => {
        setBreachDepartments(prev => prev.map(department => {
            if (department.id !== id) return department;

            const nextMin = updates.targetFloorMin ?? department.targetFloorMin;
            const nextMax = updates.targetFloorMax ?? department.targetFloorMax;
            const normalizedRange = normalizeDepartmentRange(nextMin, nextMax);

            return {
                ...department,
                ...updates,
                themeColor: updates.themeColor ?? department.themeColor,
                allocationMode: updates.allocationMode ?? department.allocationMode,
                targetFloorMin: normalizedRange.min,
                targetFloorMax: normalizedRange.max
            };
        }));
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

    const initBreachesBulk = useCallback((count: number, spec?: CrawlerSpec, options?: { folderId?: string; isMinimized?: boolean }) => {
        const requested = Math.max(0, Math.floor(count));
        const capacity = crawlerStats.maxBreachWindows || 1;
        const availableSlots = Math.max(0, capacity - breachesRef.current.length);
        const createCount = Math.min(requested, availableSlots);
        if (createCount <= 0) return [];

        const chosenSpec = spec || defaultCrawlerSpec;
        const mult = SPEC_MULT[chosenSpec];
        const baseHp = 20 + crawlerStats.maxHpBoost;
        const initialHp = Math.floor(baseHp * mult.hp);
        const floorMap = floorMaps[1] ?? generateMetaMap(1);
        const now = Date.now();
        const existingCallsigns = breachesRef.current.map(breach => breach.callsign);
        const discoveredRooms = new Set<string>();
        const newBreaches: BreachInstance[] = [];

        for (let index = 0; index < createCount; index += 1) {
            const id = `breach-${now}-${index}-${Math.random().toString(36).slice(2, 6)}`;
            const rx = 4 + Math.floor(Math.random() * 2);
            const ry = 4 + Math.floor(Math.random() * 2);
            const room = floorMap[ry][rx];
            const callsign = buildUniqueCallsign([...existingCallsigns, ...newBreaches.map(breach => breach.callsign)]);
            const specLabel = chosenSpec.toUpperCase();

            newBreaches.push({
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
                lastInputTime: now,
                visitedRooms: [`${rx},${ry}`],
                daemons: [],
                minerTickAccum: 0
            });
            discoveredRooms.add(`${rx},${ry}`);
        }

        setBreaches(prev => [...prev, ...newBreaches]);
        breachesRef.current = [...breachesRef.current, ...newBreaches];

        if (discoveredRooms.size > 0) {
            updateFloorMap(1, prevMap => {
                const nextMap = [...prevMap];
                discoveredRooms.forEach(marker => {
                    const [roomXStr, roomYStr] = marker.split(',');
                    const roomX = Number(roomXStr);
                    const roomY = Number(roomYStr);
                    if (!nextMap[roomY]?.[roomX]) return;
                    const row = [...nextMap[roomY]];
                    row[roomX] = { ...row[roomX], isDiscovered: true };
                    nextMap[roomY] = row;
                });
                return nextMap;
            });
        }

        if (options?.folderId && options.folderId !== UNGROUPED_FOLDER_ID) {
            const folderId = options.folderId;
            setFolderAssignments(prev => ({
                ...prev,
                ...Object.fromEntries(newBreaches.map(breach => [breach.id, folderId]))
            }));
        }

        playSound('boot');
        recordOpsLedgerEvent({
            type: 'crawler',
            message: `${createCount} crawler${createCount === 1 ? '' : 's'} initiated // ${chosenSpec.toUpperCase()}${options?.folderId ? ' // folder assigned' : ''}.`,
            floor: 1
        });

        return newBreaches.map(breach => breach.id);
    }, [crawlerStats.maxBreachWindows, crawlerStats.maxHpBoost, defaultCrawlerSpec, floorMaps, playSound, recordOpsLedgerEvent, updateFloorMap]);

    const initNewBreach = useCallback((spec?: CrawlerSpec, options?: { folderId?: string; isMinimized?: boolean }) => {
        return initBreachesBulk(1, spec, options)[0] ?? null;
    }, [initBreachesBulk]);

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
        const recoveryFloor = pickRecoveryFloorForBreach(breach);
        const floorMap = floorMaps[recoveryFloor] ?? generateMetaMap(recoveryFloor);
        const claimedFloor = claimedFloors.find(entry => entry.floor === recoveryFloor);
        const dockCount = countInfrastructureByType(claimedFloor, 'repair-dock');
        const spawn = pickSpawnRoom(floorMap, claimedFloor, ['repair-dock', 'dispatch-beacon']);
        const room = spawn.room;
        
        setBreaches(prev => prev.map(b => {
            if (b.id !== id) return b;
            const mult = SPEC_MULT[b.spec];
            const baseHp = 20 + crawlerStats.maxHpBoost;
            const initialHp = Math.floor(baseHp * mult.hp);
            return {
                ...b,
                floor: recoveryFloor,
                roomX: spawn.roomX,
                roomY: spawn.roomY,
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
                visitedRooms: [`${spawn.roomX},${spawn.roomY}`],
                daemons: [],
                minerTickAccum: 0
            };
        }));

        updateFloorMap(recoveryFloor, prevMap => {
            const newMap = [...prevMap];
            const row = [...newMap[spawn.roomY]];
            row[spawn.roomX] = { ...row[spawn.roomX], isDiscovered: true };
            newMap[spawn.roomY] = row;
            return newMap;
        });

        playSound('boot');
        if (breach) {
            recordOpsLedgerEvent({
                type: 'crawler',
                message: `${breach.callsign} restarted on floor ${recoveryFloor}${dockCount > 0 ? ' via repair-dock' : ''}.`,
                floor: recoveryFloor
            });
        }
    }, [claimedFloors, crawlerStats.maxHpBoost, floorMaps, pickRecoveryFloorForBreach, playSound, recordOpsLedgerEvent, updateFloorMap]);

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
            const pendingFloorTransfers: Array<{ id: string; targetFloor: number }> = [];
            const deg = gameStateRef.current.getDegradation();

            setBreaches(currentBreaches => {
                const totalBreaches = currentBreaches.length;
                if (totalBreaches === 0) return currentBreaches;

                const batchSize = totalBreaches <= 160 ? totalBreaches : Math.ceil(totalBreaches / 4);
                const batchStart = aiCursorRef.current % totalBreaches;
                const batchEnd = batchStart + batchSize;
                const shouldProcessIndex = (index: number) => (
                    batchEnd <= totalBreaches
                        ? index >= batchStart && index < batchEnd
                        : index >= batchStart || index < (batchEnd % totalBreaches)
                );
                aiCursorRef.current = (batchStart + batchSize) % totalBreaches;

                return currentBreaches.map((b, index) => {
                    if (!shouldProcessIndex(index) && b.id !== activeBreachId) return b;
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
                    const departmentRange = assignedDepartment
                        ? normalizeDepartmentRange(assignedDepartment.targetFloorMin, assignedDepartment.targetFloorMax)
                        : { min: 1, max: MAX_SEED_FLOORS };
                    const floorCeiling = departmentRange.max;
                    const floorFloor = departmentRange.min;

                    if (updatedB.floor > floorCeiling && floorMaps[floorCeiling]) {
                        pendingFloorTransfers.push({ id: updatedB.id, targetFloor: floorCeiling });
                        return {
                            ...updatedB,
                            isAutoPlaying: true,
                            logs: [...updatedB.logs.slice(-4), `[RANGE: RETURNING TO FLOOR ${floorCeiling}]`]
                        };
                    }

                    if (updatedB.floor < floorFloor && floorMaps[floorFloor]) {
                        pendingFloorTransfers.push({ id: updatedB.id, targetFloor: floorFloor });
                        return {
                            ...updatedB,
                            isAutoPlaying: true,
                            logs: [...updatedB.logs.slice(-4), `[RANGE: REDEPLOYING TO FLOOR ${floorFloor}]`]
                        };
                    }

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

                    if (updatedB.floor < floorFloor && floorIsComplete) {
                        pendingFloorAdvances.push(updatedB.id);
                        return {
                            ...updatedB,
                            isAutoPlaying: true,
                            logs: [...updatedB.logs.slice(-4), `[RANGE: ADVANCING TOWARD FLOOR ${floorFloor}]`]
                        };
                    }

                    if ((commandScript === 'deep-push' || updatedB.spec === 'explorer') && floorIsComplete && updatedB.floor < floorCeiling) {
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

            [...new Map(pendingFloorTransfers.map(entry => [entry.id, entry])).values()].forEach(entry => {
                moveBreachToFloor(entry.id, entry.targetFloor);
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
    }, [activeBreachId, crawlerStats.speedBoost, addComputeUnits, addRestoration, breachDepartments, breachFolders, departmentAssignments, floorMaps, folderAssignments, getFloorProgress, getMetaMapForFloor, getMinerTicksRequired, getTickDuration, playSound, processBreachMove, updateFloorMap]);

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

    const transitionBreachToFloor = useCallback((
        id: string,
        targetFloor: number,
        options?: {
            allowGenerate?: boolean;
            logMessage?: string;
            ledgerMessage?: string;
        }
    ) => {
        const breach = breachesRef.current.find(b => b.id === id);
        if (!breach) return false;

        const normalizedFloor = Math.max(1, Math.floor(targetFloor));
        if (normalizedFloor === breach.floor) return true;

        const existingMap = floorMaps[normalizedFloor];
        if (!existingMap && !options?.allowGenerate) return false;

        const targetMap = existingMap ?? generateMetaMap(normalizedFloor);
        const claimedFloor = claimedFloors.find(entry => entry.floor === normalizedFloor);
        const spawn = pickSpawnRoom(targetMap, claimedFloor, ['dispatch-beacon']);
        const startRoom = spawn.room;

        setFloorMaps(prev => {
            const baseMap = prev[normalizedFloor] ?? targetMap;
            const updatedMap = [...baseMap];
            const row = [...updatedMap[spawn.roomY]];
            row[spawn.roomX] = { ...row[spawn.roomX], isDiscovered: true };
            updatedMap[spawn.roomY] = row;
            return { ...prev, [normalizedFloor]: updatedMap };
        });
        setFloorProgress(prev => (
            prev[normalizedFloor]
                ? prev
                : { ...prev, [normalizedFloor]: { keysFound: [], locksOpened: [] } }
        ));
        setRoomMarkers({});

        setBreaches(prev => prev.map(b => {
            if (b.id !== id) return b;
            return {
                ...b,
                floor: normalizedFloor,
                roomX: spawn.roomX,
                roomY: spawn.roomY,
                grid: startRoom.grid,
                playerPos: startRoom.playerSpawn,
                stairsPos: startRoom.stairsPos,
                enemies: [...startRoom.enemies],
                loot: [...startRoom.loot],
                visitedRooms: [`${spawn.roomX},${spawn.roomY}`],
                daemons: [],
                minerTickAccum: 0,
                logs: [...b.logs.slice(-4), options?.logMessage || `[TRANSITIONING TO FLOOR ${normalizedFloor}]`]
            };
        }));
        recordOpsLedgerEvent({
            type: 'advance',
            message: options?.ledgerMessage || `${breach.callsign} moved to floor ${normalizedFloor}.`,
            floor: normalizedFloor
        });
        playSound('boot');
        return true;
    }, [claimedFloors, floorMaps, playSound, recordOpsLedgerEvent]);

    const moveBreachToFloor = useCallback((id: string, targetFloor: number) => {
        const breach = breachesRef.current.find(b => b.id === id);
        if (!breach) return false;

        return transitionBreachToFloor(id, targetFloor, {
            allowGenerate: false,
            logMessage: `[REDEPLOYED TO FLOOR ${Math.max(1, Math.floor(targetFloor))}]`,
            ledgerMessage: `${breach.callsign} redeployed to floor ${Math.max(1, Math.floor(targetFloor))}.`
        });
    }, [transitionBreachToFloor]);

    const nextFloor = useCallback((id: string) => {
        const breach = breachesRef.current.find(b => b.id === id);
        if (!breach) return;

        const progress = getFloorProgress(breach.floor);
        if (progress.locksOpened.length < 3) return;

        const nextF = breach.floor + 1;
        transitionBreachToFloor(id, nextF, {
            allowGenerate: true,
            logMessage: `[TRANSITIONING TO FLOOR ${nextF}]`,
            ledgerMessage: `${breach.callsign} advanced to floor ${nextF}.`
        });
    }, [getFloorProgress, transitionBreachToFloor]);

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

        const TOKEN_MINT_COST = 10_000_000;
        const interval = setInterval(() => {
            const activeMints = claimedFloors.reduce((total, entry) => {
                const mintCount = countInfrastructureByType(entry, 'token-mint');
                const quarantineCount = countInfrastructureByType(entry, 'quarantine-node');
                if (mintCount <= 0 || quarantineCount <= 0) return total;
                return total + mintCount;
            }, 0);

            if (activeMints <= 0) return;

            const affordableMints = Math.min(activeMints, Math.floor(computeUnits / TOKEN_MINT_COST));
            if (affordableMints <= 0) return;

            const spendAmount = affordableMints * TOKEN_MINT_COST;
            if (!spendComputeUnits(spendAmount)) return;

            addProtocolTokens(affordableMints, `TOKEN MINT REFINEMENT x${affordableMints}`);
            recordOpsLedgerEvent({
                type: 'income',
                message: `Token mint output: +${affordableMints} TOK for ${formatComputeUnits(spendAmount)} CU.`,
                amountCU: -spendAmount,
                amountTokens: affordableMints
            });
        }, 15000);

        return () => clearInterval(interval);
    }, [addProtocolTokens, claimedFloors, computeUnits, recordOpsLedgerEvent, spendComputeUnits]);

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
        if (claimedFloors.length === 0) return;

        const interval = setInterval(() => {
            setBreaches(prev => {
                let changed = false;
                const next = prev.map(breach => {
                    if (breach.hp <= 0 || breach.hp >= breach.maxHp) return breach;
                    const dockCount = getInfrastructureCount(breach.floor, 'repair-dock');
                    if (dockCount <= 0) return breach;

                    const healAmount = dockCount * 4;
                    const nextHp = Math.min(breach.maxHp, breach.hp + healAmount);
                    if (nextHp === breach.hp) return breach;

                    changed = true;
                    return {
                        ...breach,
                        hp: nextHp,
                        logs: nextHp === breach.maxHp
                            ? [...breach.logs.slice(-4), '[REPAIR-DOCK RESTORED FULL INTEGRITY]']
                            : [...breach.logs.slice(-4), `[REPAIR-DOCK RESTORED ${healAmount} HP]`]
                    };
                });

                return changed ? next : prev;
            });
        }, 4000);

        return () => clearInterval(interval);
    }, [claimedFloors, getInfrastructureCount]);

    useEffect(() => {
        if (claimedFloors.length === 0) return;

        const interval = setInterval(() => {
            const quarantinePower = claimedFloors.reduce((total, entry) => {
                const nodeCount = countInfrastructureByType(entry, 'quarantine-node');
                if (nodeCount <= 0) return total;
                return total + (nodeCount * (0.8 + (entry.floor * 0.05)));
            }, 0);

            if (quarantinePower > 0) {
                stabilizeClutter(quarantinePower);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [claimedFloors, stabilizeClutter]);

    useEffect(() => {
        const interval = setInterval(() => {
            const deepScanLevel = getOSModuleLevel('deep-scan-bus');
            const currentBreaches = breachesRef.current;
            const totalBreaches = currentBreaches.length;
            if (totalBreaches === 0) return;

            const batchSize = totalBreaches <= 160 ? totalBreaches : Math.ceil(totalBreaches / 4);
            const batchStart = uplinkCursorRef.current % totalBreaches;
            const batchEnd = batchStart + batchSize;
            const shouldProcessIndex = (index: number) => (
                batchEnd <= totalBreaches
                    ? index >= batchStart && index < batchEnd
                    : index >= batchStart || index < (batchEnd % totalBreaches)
            );
            uplinkCursorRef.current = (batchStart + batchSize) % totalBreaches;

            currentBreaches.forEach((breach, index) => {
                if (!shouldProcessIndex(index) && breach.id !== activeBreachId) return;
                if (breach.isPaused || breach.hp <= 0 || breach.spec === 'miner') return;

                const uplinkCount = getInfrastructureCount(breach.floor, 'relay-uplink');
                if (uplinkCount <= 0) return;

                const isBeingControlled = breach.id === activeBreachId && (Date.now() - breach.lastInputTime < 4000);
                if (isBeingControlled) return;

                const breachMap = getMetaMapForFloor(breach.floor);
                const extraMoves = Math.min(4, uplinkCount + deepScanLevel);

                for (let step = 0; step < extraMoves; step++) {
                    const liveBreach = breachesRef.current.find(item => item.id === breach.id) ?? breach;
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
    }, [activeBreachId, getFloorProgress, getInfrastructureCount, getMetaMapForFloor, getOSModuleLevel, getTickDuration, movePlayer]);

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

            managerAgents.forEach(manager => {
                const scopedDepartmentId = manager.assignedDepartmentId;
                const scopedFolderIds = scopedDepartmentId
                    ? new Set(
                        breachFolders
                            .filter(folder => departmentAssignments[folder.id] === scopedDepartmentId)
                            .map(folder => folder.id)
                    )
                    : null;

                const scopedBreaches = breachesRef.current.filter(breach => {
                    if (!breach.isMinimized) return false;
                    if (!scopedFolderIds) return true;
                    const folderId = folderAssignments[breach.id];
                    return !!folderId && scopedFolderIds.has(folderId);
                });

                const missingFolderNames = [...new Set(
                    scopedBreaches
                        .map(breach => folderTargets[breach.spec])
                        .filter(folderName =>
                            !!folderName && !breachFolders.some(folder => folder.name.toLowerCase() === folderName.toLowerCase())
                        )
                )];

                const assignmentTargets = scopedBreaches
                    .map(breach => {
                        const targetFolderName = folderTargets[breach.spec];
                        const targetFolder = breachFolders.find(folder => folder.name.toLowerCase() === targetFolderName.toLowerCase());
                        return { breach, targetFolder };
                    })
                    .filter(({ breach, targetFolder }) => targetFolder && folderAssignments[breach.id] !== targetFolder.id);

                const departmentTargets = scopedBreaches
                    .map(breach => {
                        const department = getAssignedDepartmentForBreach(
                            breach.id,
                            breachFolders,
                            breachDepartments,
                            folderAssignments,
                            departmentAssignments
                        );
                        return { breach, department };
                    })
                    .filter(({ department }) => !!department);

                const respecTargets = departmentTargets.filter(({ breach, department }) =>
                    department &&
                    department.defaultSpec !== 'mixed' &&
                    breach.spec !== department.defaultSpec
                );

                const movementTargets: Array<{ breach: BreachInstance; type: 'transfer' | 'advance'; targetFloor?: number }> = [];
                departmentTargets.forEach(({ breach, department }) => {
                    if (!department) return;

                    const range = normalizeDepartmentRange(department.targetFloorMin, department.targetFloorMax);
                    const floorComplete = getFloorProgress(breach.floor).locksOpened.length >= 3;

                    if (breach.floor > range.max && floorMaps[range.max]) {
                        movementTargets.push({ breach, type: 'transfer', targetFloor: range.max });
                        return;
                    }

                    if (breach.floor < range.min && floorMaps[range.min]) {
                        movementTargets.push({ breach, type: 'transfer', targetFloor: range.min });
                        return;
                    }

                    if (breach.floor < range.min && floorComplete) {
                        movementTargets.push({ breach, type: 'advance' });
                        return;
                    }

                    if (department.allocationMode === 'expansion' && floorComplete && breach.floor < range.max) {
                        movementTargets.push({ breach, type: 'advance' });
                    }
                });

                const rawCycleCost =
                    (missingFolderNames.length > 0 ? 6 : 0) +
                    (assignmentTargets.length * 2) +
                    (respecTargets.length * 3) +
                    (movementTargets.length * 8);
                const cycleCost = Math.max(1, Math.ceil(rawCycleCost * Math.max(0.35, 1 - (schedulerLevel * 0.15))));

                if (rawCycleCost <= 0 || !spendAgentFunds(manager.id, cycleCost)) return;

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

                movementTargets.forEach(target => {
                    if (target.type === 'transfer' && target.targetFloor) {
                        moveBreachToFloor(target.breach.id, target.targetFloor);
                    } else if (target.type === 'advance') {
                        nextFloor(target.breach.id);
                    }
                });

                const scopeName = scopedDepartmentId
                    ? breachDepartments.find(department => department.id === scopedDepartmentId)?.name
                    : null;
                triggerAlert(
                    'AGENT ACTION COMPLETE',
                    `${manager.nickname?.trim() ? `${manager.nickname} // ${manager.name}` : manager.name} coordinated ${assignmentTargets.length + respecTargets.length + movementTargets.length + missingFolderNames.length} breach action${assignmentTargets.length + respecTargets.length + movementTargets.length + missingFolderNames.length === 1 ? '' : 's'}${scopeName ? ` for ${scopeName}` : ''}.`
                );
            });
        };

        runManagerCycle();
        const interval = setInterval(runManagerCycle, Math.max(450, 1200 - (getOSModuleLevel('scheduler-kernel') * 150)));

        return () => clearInterval(interval);
    }, [assignBreachToFolder, breachDepartments, breachFolders, codexAgents, createBreachFolder, departmentAssignments, floorMaps, folderAssignments, getFloorProgress, getOSModuleLevel, moveBreachToFloor, nextFloor, setBreachSpec, spendAgentFunds]);

    useEffect(() => {
        const builderAgents = codexAgents.filter(agent => agent.strategy === 'builder');
        if (builderAgents.length === 0) return;

        const pickBuildType = (floor: number): FloorInfrastructureType | null => {
            const claimed = getClaimedFloor(floor);
            if (!claimed || claimed.infrastructure.length >= MAX_INFRASTRUCTURE_SLOTS) return null;

            const miningCount = countInfrastructureByType(claimed, 'mining-rig');
            const uplinkCount = countInfrastructureByType(claimed, 'relay-uplink');
            const scannerCount = countInfrastructureByType(claimed, 'scanner-tower');
            const dockCount = countInfrastructureByType(claimed, 'repair-dock');
            const beaconCount = countInfrastructureByType(claimed, 'dispatch-beacon');
            const quarantineCount = countInfrastructureByType(claimed, 'quarantine-node');
            const mintCount = countInfrastructureByType(claimed, 'token-mint');

            if (miningCount === 0) return 'mining-rig';
            if (dockCount === 0) return 'repair-dock';
            if (beaconCount === 0) return 'dispatch-beacon';
            if (uplinkCount === 0) return 'relay-uplink';
            if (scannerCount === 0) return 'scanner-tower';
            if (quarantineCount === 0) return 'quarantine-node';
            if (mintCount === 0 && quarantineCount > 0 && floor >= 6) return 'token-mint';
            if (miningCount <= uplinkCount + scannerCount) return 'mining-rig';
            if (dockCount < 2 && floor >= 2) return 'repair-dock';
            if (quarantineCount < 2 && floor >= 3) return 'quarantine-node';
            if (scannerCount < 2) return 'scanner-tower';
            if (beaconCount < 2 && floor >= 4) return 'dispatch-beacon';
            if (mintCount < 2 && quarantineCount > 0 && floor >= 10) return 'token-mint';
            return uplinkCount <= scannerCount ? 'relay-uplink' : 'scanner-tower';
        };

        const runBuilderCycle = () => {
            const logisticsLevel = getOSModuleLevel('logistics-mesh');
            const departmentPresence = breachDepartments.map(department => {
                const range = normalizeDepartmentRange(department.targetFloorMin, department.targetFloorMax);
                const floors = [...new Set(
                    breachesRef.current
                        .filter(breach => {
                            const assignedDepartment = getAssignedDepartmentForBreach(
                                breach.id,
                                breachFolders,
                                breachDepartments,
                                folderAssignments,
                                departmentAssignments
                            );
                            return assignedDepartment?.id === department.id;
                        })
                        .map(breach => breach.floor)
                        .filter(floor => floor >= range.min && floor <= range.max)
                )];

                return {
                    department,
                    range,
                    floors
                };
            }).filter(entry => entry.floors.length > 0);

            for (const agent of builderAgents) {
                const canCoverOpCost = (amount: number) =>
                    agent.budget >= amount || (agent.maxBudget === 0 && computeUnits >= amount);
                const availableComputeAfterOp = (amount: number) =>
                    agent.maxBudget === 0 ? Math.max(0, computeUnits - amount) : computeUnits;

                const claimOpCost = Math.max(6, 18 - (logisticsLevel * 2));
                const buildOpCost = Math.max(4, 12 - (logisticsLevel * 2));

                const claimTarget = canCoverOpCost(claimOpCost)
                    ? departmentPresence
                        .flatMap(entry => (
                            entry.floors
                                .filter(floor => !isFloorClaimed(floor) && getFloorProgress(floor).locksOpened.length >= 3)
                                .map(floor => ({
                                    department: entry.department,
                                    floor,
                                    cost: getClaimCost(floor),
                                    priority: entry.department.allocationMode === 'expansion' ? 0 : entry.department.allocationMode === 'balanced' ? 1 : 3
                                }))
                        ))
                        .filter(entry => availableComputeAfterOp(claimOpCost) >= entry.cost.cu && protocolTokens >= entry.cost.tokens)
                        .sort((a, b) => {
                            if (a.priority !== b.priority) return a.priority - b.priority;
                            return b.floor - a.floor;
                        })[0]
                    : undefined;

                const buildTarget = canCoverOpCost(buildOpCost)
                    ? departmentPresence
                        .flatMap(entry => (
                            claimedFloors
                                .filter(claimedFloor =>
                                    claimedFloor.floor >= entry.range.min &&
                                    claimedFloor.floor <= entry.range.max &&
                                    entry.floors.includes(claimedFloor.floor)
                                )
                                .map(claimedFloor => {
                                    const type = pickBuildType(claimedFloor.floor);
                                    if (!type) return null;
                                    return {
                                        department: entry.department,
                                        floor: claimedFloor.floor,
                                        type,
                                        cost: getInfrastructureCost(claimedFloor.floor, type),
                                        priority: entry.department.allocationMode === 'infrastructure' ? 0 : entry.department.allocationMode === 'balanced' ? 1 : 2
                                    };
                                })
                        ))
                        .filter((entry): entry is {
                            department: BreachDepartment;
                            floor: number;
                            type: FloorInfrastructureType;
                            cost: { cu: number; tokens: number };
                            priority: number;
                        } => !!entry)
                        .filter(entry => availableComputeAfterOp(buildOpCost) >= entry.cost.cu && protocolTokens >= entry.cost.tokens)
                        .sort((a, b) => {
                            if (a.priority !== b.priority) return a.priority - b.priority;
                            return a.department.allocationMode === 'infrastructure'
                                ? a.floor - b.floor
                                : b.floor - a.floor;
                        })[0]
                    : undefined;

                const preferredAction = claimTarget && buildTarget
                    ? claimTarget.priority <= buildTarget.priority
                        ? 'claim'
                        : 'build'
                    : claimTarget
                        ? 'claim'
                        : buildTarget
                            ? 'build'
                            : null;

                if (preferredAction === 'claim' && claimTarget) {
                    if (!spendAgentFunds(agent.id, claimOpCost)) continue;
                    if (claimFloor(claimTarget.floor)) {
                        triggerAlert(
                            'AGENT ACTION COMPLETE',
                            `${agent.nickname?.trim() ? `${agent.nickname} // ${agent.name}` : agent.name} claimed floor ${claimTarget.floor} for ${claimTarget.department.name}.`
                        );
                        break;
                    }
                }

                if (preferredAction === 'build' && buildTarget) {
                    if (!spendAgentFunds(agent.id, buildOpCost)) continue;
                    if (buildInfrastructure(buildTarget.floor, buildTarget.type)) {
                        triggerAlert(
                            'AGENT ACTION COMPLETE',
                            `${agent.nickname?.trim() ? `${agent.nickname} // ${agent.name}` : agent.name} built ${buildTarget.type.toUpperCase()} on floor ${buildTarget.floor} for ${buildTarget.department.name}.`
                        );
                        break;
                    }
                }
            }
        };

        runBuilderCycle();
        const interval = setInterval(runBuilderCycle, Math.max(900, 2200 - (getOSModuleLevel('logistics-mesh') * 220)));

        return () => clearInterval(interval);
    }, [breachDepartments, breachFolders, buildInfrastructure, claimFloor, claimedFloors, codexAgents, computeUnits, departmentAssignments, folderAssignments, getClaimCost, getClaimedFloor, getFloorProgress, getInfrastructureCost, getOSModuleLevel, isFloorClaimed, protocolTokens, spendAgentFunds]);

    return (
        <DungeonContext.Provider value={{
            breaches, metaMap, getMetaMapForFloor, availableFloors, claimedFloors, breachDepartments, breachFolders, departmentAssignments, folderAssignments, activeBreachId, currentFloor, keysFound, locksOpened, getFloorProgress, getClaimCost, getInfrastructureCost, getClaimedFloor, isFloorClaimed, roomMarkers,
            setActiveBreachId,
            movePlayer, togglePause, toggleMinimize, togglePin, terminateBreach,
            initNewBreach, initBreachesBulk, mascotSay, restartBreach, setBreachSpec, toggleMarker, nextFloor, moveBreachToFloor, claimFloor, buildInfrastructure,
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
