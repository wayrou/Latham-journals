import React, { useMemo, useState } from 'react';
import { Network } from 'lucide-react';
import { useGameState } from '../context/GameStateContext';
import { useDungeon, type BreachDepartment, DEPARTMENT_THEME_OPTIONS, getDepartmentTheme, UNASSIGNED_DEPARTMENT_ID, UNGROUPED_FOLDER_ID } from '../context/DungeonContext';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

const getCommandScriptDescription = (script: BreachDepartment['commandScript']) => {
    if (script === 'scout') return 'Pushes toward undiscovered rooms and missing keys.';
    if (script === 'lockrun') return 'Rushes missing keys, then unopened locks.';
    if (script === 'harvest') return 'Biases toward nearby loot and room income.';
    if (script === 'hold') return 'Keeps squads settled unless something is adjacent.';
    if (script === 'deep-push') return 'Prioritizes exits and faster floor progression.';
    return 'Uses each crawler class normally.';
};

const getAllocationDescription = (allocationMode: BreachDepartment['allocationMode']) => {
    if (allocationMode === 'expansion') return 'Builders prioritize claims and managers keep squads pressing deeper within range.';
    if (allocationMode === 'infrastructure') return 'Builders prioritize floor installs and stabilization within the assigned range.';
    return 'Balances claiming and building work across the department range.';
};

const PinnedDepartments: React.FC = () => {
    const { isDepartmentsPinned, pinnedPositions, pinnedSizes, updatePinnedPosition, updatePinnedSize } = useGameState();
    const {
        breaches,
        breachDepartments,
        breachFolders,
        departmentAssignments,
        folderAssignments,
        createBreachDepartment,
        createBreachFolder,
        renameBreachFolder,
        renameBreachDepartment,
        deleteBreachFolder,
        deleteBreachDepartment,
        assignFolderToDepartment,
        updateDepartmentSettings
    } = useDungeon();

    const initialPos = pinnedPositions?.departments || { x: window.innerWidth - 420, y: 220 };
    const initialSize = pinnedSizes?.departments || { width: 400, height: 460 };
    const { pos, onMouseDown, isDragging } = useDraggable('departments', initialPos, updatePinnedPosition);
    const { size, isResizing, onResizeMouseDown } = useResizable('departments', initialSize, updatePinnedSize, { width: 340, height: 360 });
    const [departmentNameDraft, setDepartmentNameDraft] = useState('');
    const [folderNameDraft, setFolderNameDraft] = useState('');

    const departmentOptions: BreachDepartment[] = useMemo(() => (
        [{
            id: UNASSIGNED_DEPARTMENT_ID,
            name: 'UNASSIGNED',
            themeColor: 'cyan',
            defaultSpec: 'mixed',
            commandScript: 'default',
            allocationMode: 'balanced',
            targetFloorMin: 1,
            targetFloorMax: 250
        }, ...breachDepartments]
    ), [breachDepartments]);

    if (!isDepartmentsPinned) return null;

    const minimizedBreaches = breaches.filter(breach => breach.isMinimized);
    const assignableFolders = breachFolders.filter(folder => folder.id !== UNGROUPED_FOLDER_ID);
    const departmentById = useMemo(
        () => new Map(breachDepartments.map(department => [department.id, department])),
        [breachDepartments]
    );
    const unassignedFolderCount = assignableFolders.filter(folder => !departmentAssignments[folder.id]).length;
    const ungroupedUnitCount = minimizedBreaches.filter(
        breach => (folderAssignments[breach.id] || UNGROUPED_FOLDER_ID) === UNGROUPED_FOLDER_ID
    ).length;

    const createDepartment = () => {
        const normalized = departmentNameDraft.trim().slice(0, 24);
        if (!normalized) return;
        createBreachDepartment(normalized);
        setDepartmentNameDraft('');
    };

    const createFolder = () => {
        const normalized = folderNameDraft.trim().slice(0, 24);
        if (!normalized) return;
        createBreachFolder(normalized);
        setFolderNameDraft('');
    };

    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                backgroundColor: 'rgba(0, 5, 10, 0.88)',
                border: '1px solid var(--color-primary-dim)',
                padding: '12px',
                zIndex: 100,
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)',
                backdropFilter: 'blur(4px)',
                fontFamily: 'monospace',
                display: 'flex',
                flexDirection: 'column',
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 0.8 : 1,
                transition: isDragging ? 'none' : 'opacity 0.3s ease',
                userSelect: 'none'
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--color-primary-dim)',
                paddingBottom: '8px',
                marginBottom: '10px',
                color: 'var(--color-accent)',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                letterSpacing: '1px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Network size={14} />
                    DEPARTMENTS_MENU
                </div>
                <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                    DEPTS: {breachDepartments.length} | FOLDERS: {assignableFolders.length} | OPEN: {unassignedFolderCount}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }} onMouseDown={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                        type="text"
                        value={departmentNameDraft}
                        onChange={(e) => setDepartmentNameDraft(e.target.value)}
                        placeholder="New department"
                        maxLength={24}
                        style={{
                            flex: 1,
                            padding: '0.3rem 0.45rem',
                            backgroundColor: '#05080a',
                            color: 'var(--color-primary)',
                            border: '1px solid var(--color-primary-dim)',
                            fontFamily: 'inherit'
                        }}
                    />
                    <button
                        type="button"
                        onClick={createDepartment}
                        style={{
                            padding: '0.3rem 0.6rem',
                            backgroundColor: 'transparent',
                            color: 'var(--color-accent)',
                            border: '1px solid var(--color-accent)',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '0.72rem'
                        }}
                    >
                        NEW DEPT
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                        type="text"
                        value={folderNameDraft}
                        onChange={(e) => setFolderNameDraft(e.target.value)}
                        placeholder="New folder"
                        maxLength={24}
                        style={{
                            flex: 1,
                            padding: '0.3rem 0.45rem',
                            backgroundColor: '#05080a',
                            color: 'var(--color-primary)',
                            border: '1px solid var(--color-primary-dim)',
                            fontFamily: 'inherit'
                        }}
                    />
                    <button
                        type="button"
                        onClick={createFolder}
                        style={{
                            padding: '0.3rem 0.6rem',
                            backgroundColor: 'transparent',
                            color: 'var(--color-accent)',
                            border: '1px solid var(--color-accent)',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '0.72rem'
                        }}
                    >
                        NEW FOLDER
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', minHeight: 0 }} onMouseDown={(e) => e.stopPropagation()}>
                {breachDepartments.length === 0 ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-primary-dim)', opacity: 0.8 }}>
                        No departments yet. Create one here, then assign squads below.
                    </div>
                ) : breachDepartments.map(department => {
                    const assignedFolderIds = assignableFolders.filter(folder => departmentAssignments[folder.id] === department.id).map(folder => folder.id);
                    const assignedUnits = minimizedBreaches.filter(breach => assignedFolderIds.includes(folderAssignments[breach.id] || '')).length;
                    const theme = getDepartmentTheme(department.themeColor);

                    return (
                        <div
                            key={department.id}
                            style={{
                                border: `1px solid ${theme.border}`,
                                padding: '8px',
                                backgroundColor: theme.surface,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                            }}
                        >
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    value={department.name}
                                    onChange={(e) => renameBreachDepartment(department.id, e.target.value)}
                                    maxLength={24}
                                    style={{
                                        flex: 1,
                                        padding: '0.2rem 0.35rem',
                                        backgroundColor: '#05080a',
                                        color: 'var(--color-primary)',
                                        border: '1px solid var(--color-primary-dim)',
                                        fontFamily: 'inherit',
                                        fontWeight: 'bold'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => deleteBreachDepartment(department.id)}
                                    style={{
                                        padding: '0.2rem 0.45rem',
                                        backgroundColor: 'transparent',
                                        color: 'var(--color-alert)',
                                        border: '1px solid var(--color-alert)',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        fontSize: '0.68rem'
                                    }}
                                >
                                    DELETE
                                </button>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--color-primary-dim)' }}>
                                <span style={{ color: theme.accent }}>SQUADS: {assignedFolderIds.length}</span>
                                <span>UNITS: {assignedUnits}</span>
                            </div>

                            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.68rem', color: 'var(--color-primary-dim)' }}>
                                UI COLOR
                                <select
                                    value={department.themeColor}
                                    onChange={(e) => updateDepartmentSettings(department.id, { themeColor: e.target.value as BreachDepartment['themeColor'] })}
                                    style={{
                                        padding: '0.2rem 0.3rem',
                                        backgroundColor: '#05080a',
                                        color: theme.accent,
                                        border: `1px solid ${theme.border}`,
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    {DEPARTMENT_THEME_OPTIONS.map(option => (
                                        <option key={option.id} value={option.id}>{option.label}</option>
                                    ))}
                                </select>
                            </label>

                            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.68rem', color: 'var(--color-primary-dim)' }}>
                                DEFAULT SPEC
                                <select
                                    value={department.defaultSpec}
                                    onChange={(e) => updateDepartmentSettings(department.id, { defaultSpec: e.target.value as BreachDepartment['defaultSpec'] })}
                                    style={{
                                        padding: '0.2rem 0.3rem',
                                        backgroundColor: '#05080a',
                                        color: 'var(--color-primary)',
                                        border: '1px solid var(--color-primary-dim)',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    <option value="mixed">MIXED</option>
                                    <option value="fighter">FIGHTER</option>
                                    <option value="rogue">ROGUE</option>
                                    <option value="miner">MINER</option>
                                    <option value="summoner">SUMMONER</option>
                                    <option value="explorer">EXPLORER</option>
                                </select>
                            </label>

                            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.68rem', color: 'var(--color-primary-dim)' }}>
                                COMMAND SCRIPT
                                <select
                                    value={department.commandScript}
                                    onChange={(e) => updateDepartmentSettings(department.id, { commandScript: e.target.value as BreachDepartment['commandScript'] })}
                                    style={{
                                        padding: '0.2rem 0.3rem',
                                        backgroundColor: '#05080a',
                                        color: 'var(--color-primary)',
                                        border: '1px solid var(--color-primary-dim)',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    <option value="default">DEFAULT</option>
                                    <option value="scout">SCOUT</option>
                                    <option value="lockrun">LOCKRUN</option>
                                    <option value="harvest">HARVEST</option>
                                    <option value="hold">HOLD</option>
                                    <option value="deep-push">DEEP_PUSH</option>
                                </select>
                            </label>

                            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.68rem', color: 'var(--color-primary-dim)' }}>
                                ALLOCATION MODE
                                <select
                                    value={department.allocationMode}
                                    onChange={(e) => updateDepartmentSettings(department.id, { allocationMode: e.target.value as BreachDepartment['allocationMode'] })}
                                    style={{
                                        padding: '0.2rem 0.3rem',
                                        backgroundColor: '#05080a',
                                        color: 'var(--color-primary)',
                                        border: '1px solid var(--color-primary-dim)',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    <option value="balanced">BALANCED</option>
                                    <option value="expansion">EXPANSION</option>
                                    <option value="infrastructure">INFRASTRUCTURE</option>
                                </select>
                            </label>

                            <div style={{ display: 'flex', gap: '6px' }}>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, fontSize: '0.68rem', color: 'var(--color-primary-dim)' }}>
                                    FLOOR MIN
                                    <input
                                        type="number"
                                        min={1}
                                        max={250}
                                        value={department.targetFloorMin}
                                        onChange={(e) => updateDepartmentSettings(department.id, { targetFloorMin: Math.max(1, Number(e.target.value) || 1) })}
                                        style={{
                                            padding: '0.2rem 0.3rem',
                                            backgroundColor: '#05080a',
                                            color: 'var(--color-primary)',
                                            border: '1px solid var(--color-primary-dim)',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, fontSize: '0.68rem', color: 'var(--color-primary-dim)' }}>
                                    FLOOR MAX
                                    <input
                                        type="number"
                                        min={1}
                                        max={250}
                                        value={department.targetFloorMax}
                                        onChange={(e) => updateDepartmentSettings(department.id, { targetFloorMax: Math.max(1, Number(e.target.value) || department.targetFloorMax) })}
                                        style={{
                                            padding: '0.2rem 0.3rem',
                                            backgroundColor: '#05080a',
                                            color: 'var(--color-primary)',
                                            border: '1px solid var(--color-primary-dim)',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                </label>
                            </div>

                            <div style={{ fontSize: '0.64rem', color: 'var(--color-primary-dim)', opacity: 0.85 }}>
                                {getCommandScriptDescription(department.commandScript)}
                            </div>
                            <div style={{ fontSize: '0.64rem', color: 'var(--color-primary-dim)', opacity: 0.85 }}>
                                {getAllocationDescription(department.allocationMode)}
                            </div>
                        </div>
                    );
                })}

                <div style={{
                    borderTop: '1px solid rgba(56, 163, 160, 0.15)',
                    paddingTop: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}>
                    <div style={{ fontSize: '0.64rem', color: 'var(--color-primary-dim)', opacity: 0.85 }}>
                        UNGROUPED UNITS: {ungroupedUnitCount}
                    </div>
                    <div style={{ color: 'var(--color-accent)', fontSize: '0.72rem', letterSpacing: '1px' }}>
                        FOLDER ROUTING
                    </div>
                    {assignableFolders.length === 0 ? (
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-primary-dim)', opacity: 0.8 }}>
                            No custom folders yet. Create one above to route it here.
                        </div>
                    ) : assignableFolders.map(folder => {
                        const departmentId = departmentAssignments[folder.id] || UNASSIGNED_DEPARTMENT_ID;
                        const assignedDepartment = departmentById.get(departmentId);
                        const theme = getDepartmentTheme(assignedDepartment?.themeColor);
                        const unitCount = minimizedBreaches.filter(breach => (folderAssignments[breach.id] || UNGROUPED_FOLDER_ID) === folder.id).length;

                        return (
                            <div
                                key={folder.id}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    border: assignedDepartment ? `1px solid ${theme.border}` : '1px solid rgba(56, 163, 160, 0.16)',
                                    backgroundColor: assignedDepartment ? theme.surface : 'rgba(56, 163, 160, 0.03)',
                                    padding: '8px'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                        type="text"
                                        value={folder.name}
                                        onChange={(e) => renameBreachFolder(folder.id, e.target.value)}
                                        maxLength={24}
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            padding: '0.2rem 0.35rem',
                                            backgroundColor: '#05080a',
                                            color: 'var(--color-primary)',
                                            border: '1px solid var(--color-primary-dim)',
                                            fontFamily: 'inherit',
                                            fontSize: '0.72rem',
                                            fontWeight: 'bold'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => deleteBreachFolder(folder.id)}
                                        style={{
                                            padding: '0.2rem 0.45rem',
                                            backgroundColor: 'transparent',
                                            color: 'var(--color-alert)',
                                            border: '1px solid var(--color-alert)',
                                            cursor: 'pointer',
                                            fontFamily: 'inherit',
                                            fontSize: '0.68rem'
                                        }}
                                    >
                                        DELETE
                                    </button>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--color-primary-dim)' }}>
                                    <span>{unitCount} unit{unitCount === 1 ? '' : 's'}</span>
                                    <span style={{ color: departmentId === UNASSIGNED_DEPARTMENT_ID ? 'var(--color-primary-dim)' : theme.accent }}>
                                        {departmentId === UNASSIGNED_DEPARTMENT_ID ? 'UNASSIGNED' : 'ASSIGNED'}
                                    </span>
                                </div>

                                <select
                                    value={departmentId}
                                    onChange={(e) => assignFolderToDepartment(folder.id, e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.2rem 0.3rem',
                                        backgroundColor: '#05080a',
                                        color: 'var(--color-primary)',
                                        border: '1px solid var(--color-primary-dim)',
                                        fontFamily: 'inherit',
                                        fontSize: '0.68rem'
                                    }}
                                >
                                    {departmentOptions.map(option => (
                                        <option key={option.id} value={option.id}>{option.name}</option>
                                    ))}
                                </select>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div
                onMouseDown={onResizeMouseDown}
                style={{
                    position: 'absolute',
                    right: '4px',
                    bottom: '4px',
                    width: '14px',
                    height: '14px',
                    cursor: 'nwse-resize',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'flex-end',
                    color: isResizing ? 'var(--color-accent)' : 'var(--color-primary-dim)',
                    fontSize: '10px',
                    lineHeight: 1,
                    userSelect: 'none'
                }}
                title="Resize departments"
            >
                //
            </div>
        </div>
    );
};

export default PinnedDepartments;
