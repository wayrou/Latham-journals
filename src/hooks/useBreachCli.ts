import { useCallback } from 'react';
import { useGameState } from '../context/GameStateContext';
import {
    type BreachInstance,
    UNGROUPED_FOLDER_ID,
    useDungeon
} from '../context/DungeonContext';

export const BREACH_COMMAND_PLACEHOLDER = 'equalize folders | add 3 to mining ops | spec scouts to explorer';

const BREACH_CLI_HELP =
    'help | minimize all | expand all | advance all to next floor | equalize folders | ' +
    'department create [name] | department assign [folder] [department] | ' +
    'add [number] to [folder] | add ungrouped to [folder] | add minimized to [folder] | ' +
    'add [fighter|rogue|miner|summoner|explorer] to [folder] | ' +
    'spec [folder] to [fighter|rogue|miner|summoner|explorer] | ' +
    'spec [number] to [fighter|rogue|miner|summoner|explorer]';

const CRAWLER_SPECS = ['fighter', 'rogue', 'miner', 'summoner', 'explorer'] as const;

export const useBreachCli = () => {
    const {
        crawlerStats,
        breachCliHistory,
        breachCliInput,
        setBreachCliInput,
        appendBreachCliLine
    } = useGameState();
    const {
        breaches,
        breachDepartments,
        breachFolders,
        folderAssignments,
        createBreachDepartment,
        createBreachFolder,
        assignFolderToDepartment,
        assignBreachToFolder,
        getFloorProgress,
        initBreachesBulk,
        nextFloor,
        setBreachSpec,
        toggleMinimize
    } = useDungeon();

    const minimizedBreaches = breaches.filter(breach => breach.isMinimized);

    const appendTerminalLine = useCallback((line: string) => {
        appendBreachCliLine(line);
    }, [appendBreachCliLine]);

    const clearInput = useCallback(() => {
        setBreachCliInput('');
    }, [setBreachCliInput]);

    const getOrCreateFolderIdByName = useCallback((folderName: string) => {
        const normalized = folderName.trim().slice(0, 24);
        if (!normalized) return null;

        const existing = breachFolders.find(folder => folder.name.toLowerCase() === normalized.toLowerCase());
        if (existing) return existing.id;

        return createBreachFolder(normalized);
    }, [breachFolders, createBreachFolder]);

    const executeCommand = useCallback((overrideCommand?: string) => {
        const raw = (overrideCommand ?? breachCliInput).trim();
        if (!raw) return;

        appendTerminalLine(`> ${raw}`);
        const normalized = raw.toLowerCase();

        if (normalized === 'help') {
            appendTerminalLine(BREACH_CLI_HELP);
            clearInput();
            return;
        }

        const departmentCreateMatch = raw.match(/^department\s+create\s+(.+)$/i);
        if (departmentCreateMatch) {
            const departmentName = departmentCreateMatch[1].trim();
            const created = createBreachDepartment(departmentName);
            appendTerminalLine(created ? `Department created: ${departmentName}` : 'Department name is required.');
            clearInput();
            return;
        }

        const departmentAssignMatch = raw.match(/^department\s+assign\s+(.+?)\s+(.+)$/i);
        if (departmentAssignMatch) {
            const folderName = departmentAssignMatch[1].trim().toLowerCase();
            const departmentName = departmentAssignMatch[2].trim().toLowerCase();
            const folder = breachFolders.find(item => item.name.toLowerCase() === folderName);
            const department = breachDepartments.find(item => item.name.toLowerCase() === departmentName);

            if (!folder) {
                appendTerminalLine(`No folder found named "${departmentAssignMatch[1].trim()}".`);
            } else if (!department) {
                appendTerminalLine(`No department found named "${departmentAssignMatch[2].trim()}".`);
            } else {
                assignFolderToDepartment(folder.id, department.id);
                appendTerminalLine(`Assigned ${folder.name} to ${department.name}.`);
            }

            clearInput();
            return;
        }

        if (normalized === 'minimize all') {
            breaches.filter(breach => !breach.isMinimized).forEach(breach => toggleMinimize(breach.id));
            appendTerminalLine('All crawlers minimized.');
            clearInput();
            return;
        }

        if (normalized === 'expand all') {
            breaches.filter(breach => breach.isMinimized).forEach(breach => toggleMinimize(breach.id));
            appendTerminalLine('All crawlers expanded.');
            clearInput();
            return;
        }

        if (normalized === 'advance all to next floor') {
            const eligibleBreaches = breaches.filter(breach => getFloorProgress(breach.floor).locksOpened.length >= 3);

            if (eligibleBreaches.length === 0) {
                appendTerminalLine('No crawlers are ready to advance.');
            } else {
                eligibleBreaches.forEach(breach => nextFloor(breach.id));
                appendTerminalLine(`Advanced ${eligibleBreaches.length} crawler${eligibleBreaches.length === 1 ? '' : 's'} to the next floor.`);
            }

            clearInput();
            return;
        }

        if (normalized === 'equalize folders') {
            if (breachFolders.length === 0) {
                appendTerminalLine('No folders available to equalize.');
                clearInput();
                return;
            }

            const sortedFolders = [...breachFolders].sort((a, b) => a.name.localeCompare(b.name));
            const baseCount = Math.floor(breaches.length / sortedFolders.length);
            const remainder = breaches.length % sortedFolders.length;
            const desiredCounts = new Map(
                sortedFolders.map((folder, index) => [folder.id, baseCount + (index < remainder ? 1 : 0)])
            );

            const movableBreaches: BreachInstance[] = [];
            const assignedByFolder = new Map<string, BreachInstance[]>();
            sortedFolders.forEach(folder => {
                assignedByFolder.set(folder.id, []);
            });

            breaches.forEach(breach => {
                const folderId = folderAssignments[breach.id] || UNGROUPED_FOLDER_ID;
                if (folderId === UNGROUPED_FOLDER_ID || !desiredCounts.has(folderId)) {
                    movableBreaches.push(breach);
                    return;
                }

                const kept = assignedByFolder.get(folderId) || [];
                const targetCount = desiredCounts.get(folderId) || 0;
                if (kept.length < targetCount) {
                    kept.push(breach);
                    assignedByFolder.set(folderId, kept);
                } else {
                    movableBreaches.push(breach);
                }
            });

            const moves: Array<{ breachId: string; folderId: string }> = [];
            sortedFolders.forEach(folder => {
                const kept = assignedByFolder.get(folder.id) || [];
                const targetCount = desiredCounts.get(folder.id) || 0;
                const deficit = targetCount - kept.length;
                for (let i = 0; i < deficit && movableBreaches.length > 0; i += 1) {
                    const breach = movableBreaches.shift();
                    if (!breach) break;
                    moves.push({ breachId: breach.id, folderId: folder.id });
                }
            });

            moves.forEach(move => assignBreachToFolder(move.breachId, move.folderId));

            const distribution = sortedFolders
                .map(folder => `${folder.name}:${desiredCounts.get(folder.id) || 0}`)
                .join(' | ');

            appendTerminalLine(
                moves.length === 0
                    ? `Folders already balanced. ${distribution}`
                    : `Equalized folders with ${moves.length} reassignment${moves.length === 1 ? '' : 's'}. ${distribution}`
            );
            clearInput();
            return;
        }

        const addCountMatch = raw.match(/^add\s+(\d+)\s+to\s+(.+)$/i);
        if (addCountMatch) {
            const requested = parseInt(addCountMatch[1], 10);
            const targetFolderName = addCountMatch[2].trim();
            const folderId = getOrCreateFolderIdByName(targetFolderName);
            const targetAssigned = breaches.filter(
                breach => (folderAssignments[breach.id] || UNGROUPED_FOLDER_ID) === folderId
            );
            const missingForTarget = Math.max(0, requested - targetAssigned.length);
            const availableSlots = Math.max(0, (crawlerStats.maxBreachWindows || 1) - breaches.length);
            const toCreate = Math.max(0, Math.min(missingForTarget, availableSlots));

            if (!folderId) {
                appendTerminalLine('Folder name is required.');
            } else if (requested <= 0) {
                appendTerminalLine('Crawler count must be at least 1.');
            } else if (missingForTarget === 0) {
                appendTerminalLine(`${targetFolderName} already has ${targetAssigned.length} crawler${targetAssigned.length === 1 ? '' : 's'}.`);
            } else {
                const createdIds = toCreate > 0
                    ? initBreachesBulk(toCreate, undefined, { folderId, isMinimized: true })
                    : [];

                const remainingNeeded = Math.max(0, missingForTarget - createdIds.length);
                const movableBreaches = breaches
                    .filter(breach => (folderAssignments[breach.id] || UNGROUPED_FOLDER_ID) !== folderId)
                    .sort((a, b) => {
                        const aFolder = folderAssignments[a.id] || UNGROUPED_FOLDER_ID;
                        const bFolder = folderAssignments[b.id] || UNGROUPED_FOLDER_ID;
                        const aScore = aFolder === UNGROUPED_FOLDER_ID ? 0 : a.isMinimized ? 1 : 2;
                        const bScore = bFolder === UNGROUPED_FOLDER_ID ? 0 : b.isMinimized ? 1 : 2;
                        return aScore - bScore;
                    })
                    .slice(0, remainingNeeded);

                movableBreaches.forEach(breach => assignBreachToFolder(breach.id, folderId));

                const filled = createdIds.length + movableBreaches.length;
                const stillMissing = Math.max(0, missingForTarget - filled);
                appendTerminalLine(
                    `Added ${filled} crawler${filled === 1 ? '' : 's'} to ${targetFolderName}.` +
                    `${createdIds.length > 0 ? ` Spawned: ${createdIds.length}.` : ''}` +
                    `${movableBreaches.length > 0 ? ` Reassigned: ${movableBreaches.length}.` : ''}` +
                    `${stillMissing > 0 ? ` ${stillMissing} still unavailable.` : ''}`
                );
            }

            clearInput();
            return;
        }

        const addToFolderMatch = normalized.match(/^add\s+(.+?)\s+to\s+(.+)$/);
        if (addToFolderMatch) {
            const source = addToFolderMatch[1].trim();
            const targetFolderName = raw.slice(raw.toLowerCase().indexOf(' to ') + 4).trim();
            const folderId = getOrCreateFolderIdByName(targetFolderName);

            if (!folderId) {
                appendTerminalLine('Folder name is required.');
                clearInput();
                return;
            }

            let targetBreaches: BreachInstance[] = [];
            if (source === 'ungrouped') {
                targetBreaches = minimizedBreaches.filter(
                    breach => (folderAssignments[breach.id] || UNGROUPED_FOLDER_ID) === UNGROUPED_FOLDER_ID
                );
            } else if (source === 'minimized') {
                targetBreaches = minimizedBreaches;
            } else if (CRAWLER_SPECS.includes(source as typeof CRAWLER_SPECS[number])) {
                targetBreaches = minimizedBreaches.filter(breach => breach.spec === source);
            }

            if (targetBreaches.length === 0) {
                appendTerminalLine(`No minimized crawlers matched "${source}".`);
            } else {
                targetBreaches.forEach(breach => assignBreachToFolder(breach.id, folderId));
                appendTerminalLine(`Moved ${targetBreaches.length} crawler${targetBreaches.length === 1 ? '' : 's'} to ${targetFolderName}.`);
            }

            clearInput();
            return;
        }

        const specFolderMatch = raw.match(/^spec\s+(.+?)\s+to\s+(.+)$/i);
        if (specFolderMatch && Number.isNaN(parseInt(specFolderMatch[1].trim(), 10))) {
            const folderName = specFolderMatch[1].trim().toLowerCase();
            const nextSpec = specFolderMatch[2].trim().toLowerCase() as typeof CRAWLER_SPECS[number];
            const folder = breachFolders.find(item => item.name.toLowerCase() === folderName);

            if (!folder) {
                appendTerminalLine(`No folder found named "${specFolderMatch[1].trim()}".`);
            } else if (!CRAWLER_SPECS.includes(nextSpec)) {
                appendTerminalLine('Unknown spec. Use fighter, rogue, miner, summoner, or explorer.');
            } else {
                const targets = breaches.filter(
                    breach => (folderAssignments[breach.id] || UNGROUPED_FOLDER_ID) === folder.id
                );

                if (targets.length === 0) {
                    appendTerminalLine(`${folder.name} has no crawlers to re-spec.`);
                } else {
                    targets.forEach(breach => setBreachSpec(breach.id, nextSpec));
                    appendTerminalLine(`Re-speced ${targets.length} crawler${targets.length === 1 ? '' : 's'} in ${folder.name} to ${nextSpec.toUpperCase()}.`);
                }
            }

            clearInput();
            return;
        }

        const specCountMatch = raw.match(/^spec\s+(\d+)\s+to\s+(.+)$/i);
        if (specCountMatch) {
            const requested = parseInt(specCountMatch[1], 10);
            const nextSpec = specCountMatch[2].trim().toLowerCase() as typeof CRAWLER_SPECS[number];

            if (requested <= 0) {
                appendTerminalLine('Crawler count must be at least 1.');
            } else if (!CRAWLER_SPECS.includes(nextSpec)) {
                appendTerminalLine('Unknown spec. Use fighter, rogue, miner, summoner, or explorer.');
            } else {
                const targets = breaches.slice(0, requested);
                if (targets.length === 0) {
                    appendTerminalLine('No crawlers available to re-spec.');
                } else {
                    targets.forEach(breach => setBreachSpec(breach.id, nextSpec));
                    appendTerminalLine(
                        `Re-speced ${targets.length} crawler${targets.length === 1 ? '' : 's'} to ${nextSpec.toUpperCase()}.` +
                        `${requested > targets.length ? ` ${requested - targets.length} unavailable.` : ''}`
                    );
                }
            }

            clearInput();
            return;
        }

        appendTerminalLine('Unknown breach command.');
        clearInput();
    }, [
        appendTerminalLine,
        assignBreachToFolder,
        assignFolderToDepartment,
        breachCliInput,
        breachDepartments,
        breachFolders,
        breaches,
        clearInput,
        crawlerStats.maxBreachWindows,
        createBreachDepartment,
        createBreachFolder,
        folderAssignments,
        getFloorProgress,
        getOrCreateFolderIdByName,
        initBreachesBulk,
        minimizedBreaches,
        nextFloor,
        setBreachSpec,
        toggleMinimize
    ]);

    return {
        history: breachCliHistory,
        inputVal: breachCliInput,
        setInputVal: setBreachCliInput,
        executeCommand,
        placeholder: BREACH_COMMAND_PLACEHOLDER
    };
};
