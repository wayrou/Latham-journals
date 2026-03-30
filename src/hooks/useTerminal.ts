import { useCallback, useRef, useEffect } from 'react';
import { OS_MODULE_DEFINITIONS, getOSModuleDefinition, type LogEntry, type OSModuleId, useGameState } from '../context/GameStateContext';
import { useDungeon } from '../context/DungeonContext';
import { useSound } from './useSound';
import { storyData } from '../data/story';
import { shiftDecrypt, vigenereDecrypt, lathamDecrypt } from '../utils/cipherUtils';
import { formatComputeUnits } from '../utils/numberFormat';
import { getDefragCost } from '../utils/degradation';

const AGENT_STRATEGIES = ['responsible', 'brave', 'disabled', 'parallel', 'defrag', 'scrapper', 'mechanic', 'manager', 'builder'] as const;
type AgentStrategy = typeof AGENT_STRATEGIES[number];

const HELP_TEXT =
    `SYSTEM COMMANDS:\n` +
    `- help                          : Show this message\n` +
    `- clear                         : Clear terminal screen\n` +
    `- history                       : Show entered command history\n` +
    `- ls / dir                      : List accessible files\n` +
    `- read [filename]               : Display file content\n` +
    `- open [filename]               : Alias for read\n` +
    `- status                        : View comprehensive system status & stats\n` +
    `- defrag [amount]               : Spend CU to reduce system clutter\n` +
    `- bricked                       : Inspect current salvageable node\n` +
    `- bricked repair                : Repair the active bricked node\n` +
    `- bricked scrap                 : Scrap the active bricked node\n` +
    `- claim floor [N]               : Claim a fully unlocked floor\n` +
    `- claim list                    : Show floor claim status\n` +
    `- build floor [N] [type]        : Build infrastructure on a claimed floor\n` +
    `- build list [N]                : Show infrastructure details for a floor\n\n` +
    `- notifications [on|off]        : Turn system notifications on or off\n\n` +
    `CRYPTANALYSIS:\n` +
    `- unlock [file] [pass]          : Decrypt password-locked files\n` +
    `- decrypt [file] [sys] [key]    : Run cipher decryption\n` +
    `- ciphers                       : View fragment progress for Protocols\n` +
    `- crack [prot] [pass]           : Solve a CORE Protocol cipher\n\n` +
    `CODEX:\n` +
    `- codex                         : View upgrades and agent tools\n` +
    `- codex buy [1-5] [qty|max]     : Buy one or more crawler upgrades\n` +
    `- codex spec [type]             : Set default crawler class\n` +
    `- codex spec all [type]         : Re-spec all active crawlers\n` +
    `- codex refactor [bonus]        : Perform a system refactor\n` +
    `- codex agent                   : View agent interface\n` +
    `- codex agent buy [strategy]    : Recruit a CODEX agent\n` +
    `- codex agent set [N] [mode]    : Change an agent behavior\n\n` +
    `INTERFACE:\n` +
    `- agents                        : List active agents\n` +
    `- agents --pin                  : Toggle agent status window\n` +
    `- agents set [N] [mode]         : Change an agent behavior\n` +
    `- wallets                       : View agent wallet balances\n` +
    `- wallets --pin                 : Toggle agent wallet trackers\n` +
    `- wallets refill [N] [A]        : Transfer CU to agent wallet\n` +
    `- wallets set-budget [N] [A]    : Set agent max budget\n` +
    `- wallets set-refill [N] [A]    : Set agent wallet refill rate\n` +
    `- inbox --pin                   : Toggle pinned inbox window\n` +
    `- archive --pin                 : Toggle pinned archive window\n` +
    `- metamap                       : Show the discovered dungeon layout\n` +
    `- metamap --pin                 : Toggle global dungeon layout\n` +
    `- departments --pin             : Toggle departments operations menu\n` +
    `- build --pin                   : Toggle infrastructure build menu\n` +
    `- breach --pin                  : Toggle pinned breach CLI menu\n` +
    `- modules                       : Show permanent OS modules\n` +
    `- modules unlock [id]           : Spend tokens on an OS module\n` +
    `- modules --pin                 : Toggle pinned OS modules menu\n` +
    `- ledger                        : Show recent ops ledger events\n` +
    `- ledger --pin                  : Toggle pinned ops ledger\n` +
    `- ledger clear                  : Clear ops ledger history\n` +
    `- terminal --pin                : Toggle global pinned terminal`;

export const useTerminal = () => {
    const {
        unlockedFiles, archiveRestoration, computeUnits, protocolTokens,
        codexAgents, addCodexAgent,
        getUpgradeCost, upgradeCrawler, upgradeCrawlerBulk,
        reduceClutter, toggleAgentsPinned, toggleTerminalPinned, toggleMetaMapPinned, toggleWalletsPinned, toggleBuildPinned, toggleBreachCliPinned,
        toggleDepartmentsPinned, toggleInboxPinned, toggleArchivePinned,
        toggleLedgerPinned, toggleModulesPinned, opsLedger, clearOpsLedger,
        markFileAsRead, unlockFile, addRestoration, systemClutter,
        initiateRefactor, crawlerStats,
        terminalHistory, setTerminalHistory, terminalInput, setTerminalInput,
        setDefaultSpec, scrapBrickedNode, repairBrickedNode, activeBrickedNode,
        getCipherProgress, attemptCipherUnlock,
        setAgentStrategy, setAgentBudget, setAgentRefillRate, refillAgent,
        osModules, getOSModuleCost, unlockOSModule, getMaxClaimCount,
        notificationsEnabled, setNotificationsEnabled, dismissAlert
    } = useGameState();
    const { metaMap, breaches, currentFloor, setBreachSpec, availableFloors, claimFloor, claimedFloors, getClaimCost, getFloorProgress, getInfrastructureCost, getClaimedFloor, buildInfrastructure, isFloorClaimed } = useDungeon();
    const { playSound } = useSound();

    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [terminalHistory]);

    const print = useCallback((content: string, type: LogEntry['type'] = 'output', specialType?: LogEntry['specialType']) => {
        setTerminalHistory(prev => [...prev, { type, content, specialType }]);
    }, [setTerminalHistory]);

    const clear = useCallback(() => setTerminalHistory([]), [setTerminalHistory]);

    const isFileAccessible = useCallback((fileId: string) => {
        const doc = storyData.find(d => d.id === fileId);
        return !!doc;
    }, []);

    const handleCommand = useCallback((cmd: string) => {
        const trimmed = cmd.trim();
        if (!trimmed) return;

        print(trimmed, 'input');
        playSound('success');

        const args = trimmed.split(/\s+/);
        const command = args[0].toLowerCase();

        const findAgent = (identifier?: string) => {
            if (!identifier) return undefined;
            return codexAgents.find(agent =>
                agent.name.toLowerCase() === identifier.toLowerCase() ||
                agent.nickname?.toLowerCase() === identifier.toLowerCase() ||
                agent.id === identifier
            );
        };

        const isValidStrategy = (value?: string): value is AgentStrategy =>
            !!value && AGENT_STRATEGIES.includes(value as AgentStrategy);

        const setAgentBehavior = (agentIdentifier?: string, strategyIdentifier?: string) => {
            const agent = findAgent(agentIdentifier);
            const strategy = strategyIdentifier?.toLowerCase();

            if (!agent || !isValidStrategy(strategy)) {
                print(`Usage: agents set [agent_name] [${AGENT_STRATEGIES.join('|')}]`, 'error');
                return;
            }

            setAgentStrategy(agent.id, strategy);
            print(`BEHAVIOR FOR ${agent.name} SET TO ${strategy.toUpperCase()}.`, 'system');
        };

        switch (command) {
            case 'help':
                print(HELP_TEXT, 'output', 'help');
                break;

            case 'clear':
                clear();
                break;

            case 'ls':
            case 'dir': {
                const visibleDocs = storyData.filter(d => isFileAccessible(d.id));
                const listStr = visibleDocs.map(d => {
                    const unlocked = d.unlockedByDefault || unlockedFiles.includes(d.id);
                    const lockStatus = unlocked ? '[CLEARED]' : '[ENCRYPTED]';
                    return `${d.name.padEnd(20)} ${lockStatus}`;
                }).join('\n');
                print(listStr);
                break;
            }

            case 'history': {
                const inputs = terminalHistory.filter(h => h.type === 'input').map(h => h.content);
                print(inputs.length ? inputs.map((input, idx) => `${idx + 1}: ${input}`).join('\n') : 'No history found.');
                break;
            }

            case 'read':
            case 'open': {
                if (args.length < 2) {
                    print(`Usage: ${command} [filename]`, 'error');
                    break;
                }

                const fileToRead = args[1];
                const docToRead = storyData.find(d => d.name === fileToRead || d.id === fileToRead);

                if (!docToRead || !isFileAccessible(docToRead.id)) {
                    print(`File not found: ${fileToRead}`, 'error');
                    break;
                }

                const isUnlocked = docToRead.unlockedByDefault || unlockedFiles.includes(docToRead.id);

                if (isUnlocked) {
                    markFileAsRead(docToRead.id);
                    print(docToRead.secretContent || docToRead.content);
                } else {
                    print('[SYSTEM] ANOMALOUS ACCESS ATTEMPT LOGGED. THE TRUTH IS FRAGMENTED.', 'error');
                }
                break;
            }

            case 'unlock': {
                if (args.length < 3) {
                    print('Usage: unlock [filename] [password]', 'error');
                    break;
                }

                const unlockFileTarget = args[1];
                const passAttempt = args.slice(2).join(' ').toLowerCase();
                const docToUnlock = storyData.find(d => d.name === unlockFileTarget || d.id === unlockFileTarget);

                if (!docToUnlock || !isFileAccessible(docToUnlock.id)) {
                    print(`File not found: ${unlockFileTarget}`, 'error');
                    break;
                }

                if (docToUnlock.type !== 'locked') {
                    print(`File ${unlockFileTarget} does not require a password unlock.`, 'error');
                    break;
                }

                if (docToUnlock.password === passAttempt) {
                    unlockFile(docToUnlock.id);
                    markFileAsRead(docToUnlock.id);
                    addRestoration(5);
                    print(`FILE DECRYPTED: ${unlockFileTarget}\n${docToUnlock.secretContent}`, 'system');
                } else {
                    print('PASSWORD REJECTED.', 'error');
                }
                break;
            }

            case 'decrypt': {
                if (args.length < 4) {
                    print('Usage: decrypt [filename] [type] [key]', 'error');
                    print('Types: shift, vigenere, latham', 'error');
                    break;
                }

                const decFile = args[1];
                const decType = args[2].toLowerCase();
                const decKey = args.slice(3).join(' ');

                if (!['shift', 'vigenere', 'latham'].includes(decType)) {
                    print(`UNKNOWN CIPHER TYPE: ${decType}. Use: shift, vigenere, or latham.`, 'error');
                    break;
                }

                const docToDec = storyData.find(d => d.name === decFile || d.id === decFile);

                if (!docToDec || !isFileAccessible(docToDec.id)) {
                    print(`File not found: ${decFile}`, 'error');
                    break;
                }

                if (docToDec.type !== 'cipher' || !docToDec.cipherKey) {
                    print(`File ${decFile} does not use cipher protocol.`, 'error');
                    break;
                }

                const rawCipher = docToDec.content.split('\n').filter(line => !line.startsWith('(System')).join('\n');

                let decryptedText = '';
                if (decType === 'shift') {
                    const shiftNum = parseInt(decKey, 10);
                    if (isNaN(shiftNum) || shiftNum < 1 || shiftNum > 25) {
                        print('SHIFT KEY MUST BE A NUMBER BETWEEN 1 AND 25.', 'error');
                        break;
                    }
                    decryptedText = shiftDecrypt(rawCipher, shiftNum);
                } else if (decType === 'vigenere') {
                    if (!decKey || !/^[a-zA-Z]+$/.test(decKey)) {
                        print('VIGENERE KEY MUST BE AN ALPHABETIC KEYWORD.', 'error');
                        break;
                    }
                    decryptedText = vigenereDecrypt(rawCipher, decKey.toUpperCase());
                } else {
                    const lathamKey = parseInt(decKey, 10);
                    if (isNaN(lathamKey) || lathamKey < 1 || lathamKey > 25) {
                        print('LATHAM KEY MUST BE A NUMBER BETWEEN 1 AND 25.', 'error');
                        break;
                    }
                    decryptedText = lathamDecrypt(rawCipher, lathamKey);
                }

                print(`APPLYING ${decType.toUpperCase()} DECRYPTION TO ${decFile}...`, 'system');
                print(decryptedText);

                const keyMatches =
                    decType === (docToDec.cipherType || 'shift') &&
                    decKey.toUpperCase() === docToDec.cipherKey.toUpperCase();

                if (keyMatches) {
                    unlockFile(docToDec.id);
                    markFileAsRead(docToDec.id);
                    addRestoration(15);
                    print('DECRYPTION VERIFIED. FILE UNLOCKED.', 'system');
                    if (docToDec.secretContent) {
                        const bonusLines = docToDec.secretContent.split('\n').filter(line => line.startsWith('['));
                        bonusLines.forEach(line => print(line, 'system'));
                    }
                } else {
                    print('OUTPUT DOES NOT MATCH KNOWN PLAINTEXT SIGNATURES. TRY A DIFFERENT KEY OR CIPHER TYPE.', 'error');
                }
                break;
            }

            case 'status':
                print('--- SYSTEM STATUS REPORT ---');
                print(`[ARCHIVE] Restoration: ${Math.floor(archiveRestoration)}%`);
                print(`[COMPUTE] Units: ${formatComputeUnits(computeUnits)}`);
                print(`[TOKENS] Admin Tokens: ${protocolTokens}`);
                print(`[NOTIFY] ${notificationsEnabled ? 'ON' : 'OFF'}`);
                print(`[CLUTTER] Level: ${systemClutter.toFixed(1)}%`);
                print(`[CRAWLER] LVL:${crawlerStats.baseDmg} DMG | HP:${100 + crawlerStats.maxHpBoost} | SPD:${crawlerStats.speedBoost} | WINDOWS:${crawlerStats.maxBreachWindows}`);
                print(`[CLAIMS] ${claimedFloors.length}/${getMaxClaimCount()} floor slots in use`);
                const activeModules = OS_MODULE_DEFINITIONS
                    .map(module => ({ module, level: osModules[module.id] || 0 }))
                    .filter(entry => entry.level > 0);
                if (activeModules.length > 0) {
                    print(`[MODULES] ${activeModules.map(entry => `${entry.module.id}:${entry.level}`).join(' | ')}`);
                }
                if (activeBrickedNode) {
                    print(`[!] BRICKED NODE DETECTED IN SECTOR ${activeBrickedNode.roomCoords}`, 'system');
                }
                break;

            case 'notifications': {
                const mode = args[1]?.toLowerCase();
                if (mode === 'on') {
                    setNotificationsEnabled(true);
                    print('SYSTEM NOTIFICATIONS ENABLED.', 'system');
                } else if (mode === 'off') {
                    setNotificationsEnabled(false);
                    dismissAlert();
                    print('SYSTEM NOTIFICATIONS DISABLED.', 'system');
                } else {
                    print('Usage: notifications [on|off]', 'error');
                }
                break;
            }

            case 'bricked':
                if (!activeBrickedNode) {
                    print('NO BRICKED NODES DETECTED IN VICINITY.', 'error');
                } else if (args[1] === 'scrap') {
                    scrapBrickedNode();
                    print('NODE DISMANTLED. RESOURCES RECOVERED.', 'system');
                } else if (args[1] === 'repair') {
                    if (repairBrickedNode()) {
                        print('REPAIR SEQUENCE INITIATED.', 'system');
                    } else {
                        print('INSUFFICIENT RESOURCES FOR REPAIR.', 'error');
                    }
                } else {
                    print('--- BRICKED NODE DETECTED ---');
                    print(`SECTOR: ${activeBrickedNode.roomCoords}`);
                    print(`REPAIR COST: ${activeBrickedNode.repairCost} CU`);
                    print(`SCRAP VALUE: ${activeBrickedNode.scrapValue} CU`);
                    print('\nUsage: bricked repair | bricked scrap');
                }
                break;

            case 'claim':
                if (args[1]?.toLowerCase() === 'list') {
                    if (availableFloors.length === 0) {
                        print('NO FLOORS AVAILABLE.', 'error');
                        break;
                    }

                    print('--- FLOOR CLAIM REGISTRY ---');
                    print(`CLAIM CAPACITY: ${claimedFloors.length}/${getMaxClaimCount()}`);
                    availableFloors.forEach(floor => {
                        const progress = getFloorProgress(floor);
                        const cost = getClaimCost(floor);
                        const claimed = getClaimedFloor(floor);
                        const status = isFloorClaimed(floor)
                            ? 'CLAIMED'
                            : progress.locksOpened.length >= 3
                                ? 'CLAIMABLE'
                                : 'LOCKED';
                        const miningRigCount = claimed?.infrastructure.filter(item => item.type === 'mining-rig').length || 0;
                        const passiveCU = miningRigCount > 0 ? `${miningRigCount * (5 + floor * 2)} CU/tick` : '0 CU/tick';
                        print(`F${floor}: ${status} | LOCKS ${progress.locksOpened.length}/3 | COST ${formatComputeUnits(cost.cu)} CU / ${cost.tokens} TOK | PASSIVE ${passiveCU}`);
                    });
                    break;
                }

                if (args[1]?.toLowerCase() === 'floor') {
                    const floor = parseInt(args[2] || '', 10);
                    if (Number.isNaN(floor) || floor < 1) {
                        print('Usage: claim floor [N]', 'error');
                        break;
                    }

                    const cost = getClaimCost(floor);
                    if (claimFloor(floor)) {
                        print(`FLOOR ${floor} CLAIMED. COST: ${formatComputeUnits(cost.cu)} CU / ${cost.tokens} TOK`, 'system');
                    } else {
                        const progress = getFloorProgress(floor);
                        if (isFloorClaimed(floor)) {
                            print(`FLOOR ${floor} IS ALREADY CLAIMED.`, 'error');
                        } else if (claimedFloors.length >= getMaxClaimCount()) {
                            print(`CLAIM CAP REACHED. NEED MORE CLAIM AUTHORITY MODULES.`, 'error');
                        } else if (progress.locksOpened.length < 3) {
                            print(`FLOOR ${floor} IS NOT CLAIMABLE YET. OPEN ALL 3 LOCKS FIRST.`, 'error');
                        } else {
                            print(`INSUFFICIENT RESOURCES TO CLAIM FLOOR ${floor}. NEED ${formatComputeUnits(cost.cu)} CU / ${cost.tokens} TOK`, 'error');
                        }
                    }
                    break;
                }

                print('Usage: claim floor [N] | claim list', 'error');
                break;

            case 'build': {
                const sub = args[1]?.toLowerCase();
                if (sub === '--pin') {
                    toggleBuildPinned();
                    print('BUILD MENU PIN STATUS TOGGLED.', 'system');
                    break;
                }
                if (sub === 'list') {
                    const floor = parseInt(args[2] || '', 10);
                    if (Number.isNaN(floor) || floor < 1) {
                        print('Usage: build list [N]', 'error');
                        break;
                    }

                    const claimed = getClaimedFloor(floor);
                    if (!claimed) {
                        print(`FLOOR ${floor} IS NOT CLAIMED.`, 'error');
                        break;
                    }

                    const rigCost = getInfrastructureCost(floor, 'mining-rig');
                    const relayCost = getInfrastructureCost(floor, 'relay-uplink');
                    const scannerCost = getInfrastructureCost(floor, 'scanner-tower');
                    print(`--- FLOOR ${floor} INFRASTRUCTURE ---`);
                    print(`SLOTS USED: ${claimed.infrastructure.length}/4`);
                    print(`ACTIVE: ${claimed.infrastructure.length ? claimed.infrastructure.map(item => `${item.type}@${item.roomX},${item.roomY}`).join(', ') : 'NONE'}`);
                    print(`mining-rig    : ${formatComputeUnits(rigCost.cu)} CU / ${rigCost.tokens} TOK | passive CU output`);
                    print(`relay-uplink  : ${formatComputeUnits(relayCost.cu)} CU / ${relayCost.tokens} TOK | extra auto-crawl movement`);
                    print(`scanner-tower : ${formatComputeUnits(scannerCost.cu)} CU / ${scannerCost.tokens} TOK | reveals rooms over time`);
                    break;
                }

                if (sub === 'floor') {
                    const floor = parseInt(args[2] || '', 10);
                    const type = (args[3] || '').toLowerCase() as 'mining-rig' | 'relay-uplink' | 'scanner-tower';
                    if (Number.isNaN(floor) || floor < 1 || !['mining-rig', 'relay-uplink', 'scanner-tower'].includes(type)) {
                        print('Usage: build floor [N] [mining-rig|relay-uplink|scanner-tower]', 'error');
                        break;
                    }

                    const cost = getInfrastructureCost(floor, type);
                    if (buildInfrastructure(floor, type)) {
                        print(`BUILT ${type.toUpperCase()} ON FLOOR ${floor}. COST: ${formatComputeUnits(cost.cu)} CU / ${cost.tokens} TOK`, 'system');
                    } else {
                        const claimed = getClaimedFloor(floor);
                        if (!claimed) {
                            print(`FLOOR ${floor} IS NOT CLAIMED.`, 'error');
                        } else if (claimed.infrastructure.length >= 4) {
                            print(`FLOOR ${floor} HAS NO FREE INFRASTRUCTURE SLOTS.`, 'error');
                        } else {
                            print(`INSUFFICIENT RESOURCES TO BUILD ${type.toUpperCase()} ON FLOOR ${floor}. NEED ${formatComputeUnits(cost.cu)} CU / ${cost.tokens} TOK`, 'error');
                        }
                    }
                    break;
                }

                print('Usage: build --pin | build floor [N] [mining-rig|relay-uplink|scanner-tower] | build list [N]', 'error');
                break;
            }

            case 'departments':
                if (args[1] === '--pin') {
                    toggleDepartmentsPinned();
                    print('DEPARTMENTS MENU PIN STATUS TOGGLED.', 'system');
                } else {
                print('Usage: departments --pin', 'error');
                }
                break;

            case 'breach':
                if (args[1] === '--pin') {
                    toggleBreachCliPinned();
                    print('BREACH CLI PIN STATUS TOGGLED.', 'system');
                } else {
                    print('Usage: breach --pin', 'error');
                }
                break;

            case 'modules':
                if (args[1] === '--pin') {
                    toggleModulesPinned();
                    print('OS MODULES PIN STATUS TOGGLED.', 'system');
                } else if (args[1] === 'unlock') {
                    const moduleId = (args[2] || '').toLowerCase() as OSModuleId;
                    const definition = getOSModuleDefinition(moduleId);
                    if (!definition) {
                        print(`Usage: modules unlock [${OS_MODULE_DEFINITIONS.map(module => module.id).join('|')}]`, 'error');
                        break;
                    }
                    const currentLevel = osModules[moduleId] || 0;
                    if (currentLevel >= definition.maxLevel) {
                        print(`${definition.name} IS ALREADY AT MAX LEVEL.`, 'error');
                        break;
                    }
                    const cost = getOSModuleCost(moduleId);
                    if (unlockOSModule(moduleId)) {
                        print(`${definition.name} UPGRADED TO LV ${currentLevel + 1}. COST: ${cost} TOK`, 'system');
                    } else {
                        print(`INSUFFICIENT TOKENS. NEED ${cost} TOK FOR ${definition.name}.`, 'error');
                    }
                } else {
                    print('--- PERMANENT OS MODULES ---');
                    print(`TOKENS AVAILABLE: ${protocolTokens}`);
                    OS_MODULE_DEFINITIONS.forEach(module => {
                        const level = osModules[module.id] || 0;
                        const nextCost = level >= module.maxLevel ? 'MAX' : `${getOSModuleCost(module.id)} TOK`;
                        print(`${module.id.padEnd(20)} LV ${level}/${module.maxLevel} | NEXT ${nextCost}`);
                        print(`  ${module.description}`);
                    });
                }
                break;

            case 'ledger':
                if (args[1] === '--pin') {
                    toggleLedgerPinned();
                    print('OPS LEDGER PIN STATUS TOGGLED.', 'system');
                } else if (args[1] === 'clear') {
                    clearOpsLedger();
                    print('OPS LEDGER CLEARED.', 'system');
                } else {
                    const recent = opsLedger.slice(-12);
                    if (recent.length === 0) {
                        print('OPS LEDGER EMPTY.');
                    } else {
                        print('--- OPS LEDGER ---');
                        recent.forEach(entry => {
                            const stamp = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            const details = [
                                entry.floor !== undefined ? `F${entry.floor}` : '',
                                entry.amountCU !== undefined ? `CU ${entry.amountCU > 0 ? '+' : ''}${entry.amountCU}` : '',
                                entry.amountTokens !== undefined ? `TOK ${entry.amountTokens > 0 ? '+' : ''}${entry.amountTokens}` : ''
                            ].filter(Boolean).join(' | ');
                            print(`${stamp} | ${entry.type.toUpperCase()} | ${entry.message}${details ? ` | ${details}` : ''}`);
                        });
                    }
                }
                break;

            case 'ciphers': {
                const progress = getCipherProgress();
                print('--- CORE PROTOCOL CIPHERS ---');
                progress.forEach(progressItem => {
                    print(`${progressItem.name.padEnd(12)}: [${progressItem.found}/${progressItem.required}] FRAGMENTS FOUND`);
                });
                break;
            }

            case 'crack': {
                if (args.length < 3) {
                    print('Usage: crack [protocol_name] [key]', 'error');
                    break;
                }

                const protocol = args[1].toUpperCase();
                const key = args[2];
                if (attemptCipherUnlock(protocol, key)) {
                    print(`PROTOCOL ${protocol} BYPASSED. SYSTEM STABILITY INCREASING.`, 'system');
                } else {
                    print('DECRYPTION FAILED. KEY INVALID.', 'error');
                }
                break;
            }

            case 'defrag': {
                if (args.length < 2) {
                    print(`Usage: defrag [amount]\nCurrent Clutter: ${systemClutter.toFixed(1)}%`, 'error');
                    break;
                }

                const amount = parseFloat(args[1]);
                if (isNaN(amount) || amount <= 0) {
                    print('INVALID AMOUNT.', 'error');
                    break;
                }

                if (reduceClutter(amount)) {
                    print(`DEFRAG SUCCESSFUL. SYSTEM CLUTTER REDUCED BY ${amount.toFixed(1)}%.`, 'system');
                } else {
                    const cost = getDefragCost(amount);
                    print(`INSUFFICIENT RESOURCES FOR DEFRAG. NEED: ${formatComputeUnits(cost)} CU | HAVE: ${formatComputeUnits(computeUnits)} CU`, 'error');
                }
                break;
            }

            case 'codex': {
                const dmgCost = getUpgradeCost('baseDmg');
                const healthCost = getUpgradeCost('maxHpBoost');
                const speedCost = getUpgradeCost('speedBoost');
                const procCost = getUpgradeCost('maxBreachWindows');
                const minerCost = getUpgradeCost('minerYield');
                const sub = args[1]?.toLowerCase();

                if (!sub) {
                    print('--- PRGN_OS CODEX ---');
                    print(`CURRENT BALANCE: ${formatComputeUnits(computeUnits)} CUs`);
                    print(`1. [DAMAGE]   - Cost: ${dmgCost} CU`);
                    print(`2. [SHIELDS]  - Cost: ${healthCost} CU`);
                    print(`3. [OVERCLOCK] - Cost: ${speedCost} CU`);
                    print(`4. [PARALLEL] - Cost: ${procCost} CU`);
                    print(`5. [MINING]   - Cost: ${minerCost} CU`);
                    print('\nUsage: codex buy [1-5] [qty|max] | codex spec [type] | codex agent | codex refactor');
                } else if (sub === 'buy') {
                    const itemArg = args[2]?.toLowerCase();
                    const quantityArg = args[3]?.toLowerCase();
                    const item = ['1', '2', '3', '4', '5'].includes(itemArg || '')
                        ? itemArg
                        : ['1', '2', '3', '4', '5'].includes(quantityArg || '')
                            ? quantityArg
                            : undefined;
                    const quantityToken = quantityArg === 'max' || /^\d+$/.test(quantityArg || '')
                        ? quantityArg
                        : itemArg === 'max'
                            ? 'max'
                            : undefined;
                    const quantity = quantityToken === 'max'
                        ? 'max'
                        : quantityToken
                            ? parseInt(quantityToken, 10)
                            : 1;
                    let purchased = 0;
                    if (item === '1') purchased = quantity === 1 ? (upgradeCrawler('baseDmg') ? 1 : 0) : upgradeCrawlerBulk('baseDmg', quantity);
                    else if (item === '2') purchased = quantity === 1 ? (upgradeCrawler('maxHpBoost') ? 1 : 0) : upgradeCrawlerBulk('maxHpBoost', quantity);
                    else if (item === '3') purchased = quantity === 1 ? (upgradeCrawler('speedBoost') ? 1 : 0) : upgradeCrawlerBulk('speedBoost', quantity);
                    else if (item === '4') purchased = quantity === 1 ? (upgradeCrawler('maxBreachWindows') ? 1 : 0) : upgradeCrawlerBulk('maxBreachWindows', quantity);
                    else if (item === '5') purchased = quantity === 1 ? (upgradeCrawler('minerYield') ? 1 : 0) : upgradeCrawlerBulk('minerYield', quantity);

                    if (!['1', '2', '3', '4', '5'].includes(item || '')) {
                        print('Usage: codex buy [1-5] [qty|max]', 'error');
                    } else if (quantity !== 'max' && (typeof quantity !== 'number' || quantity <= 0 || Number.isNaN(quantity))) {
                        print('Quantity must be a positive integer or "max".', 'error');
                    } else if (purchased > 0) {
                        print(`PURCHASED ${purchased} UPGRADE${purchased === 1 ? '' : 'S'}.`, 'system');
                    } else if (quantity === 'max') {
                        print('NO AFFORDABLE UPGRADES REMAIN FOR THAT SLOT.', 'error');
                    } else {
                        print('INSUFFICIENT COMPUTE UNITS FOR THIS UPGRADE.', 'error');
                    }
                } else if (sub === 'spec') {
                    const scope = (args[2] || '').toLowerCase();
                    const spec = (scope === 'all' ? args[3] : args[2] || '').toLowerCase() as 'fighter' | 'rogue' | 'miner' | 'summoner' | 'explorer';
                    if (['fighter', 'rogue', 'miner', 'summoner', 'explorer'].includes(spec)) {
                        if (scope === 'all') {
                            breaches.forEach(breach => setBreachSpec(breach.id, spec));
                            print(`ALL ACTIVE CRAWLERS RE-SPECED TO ${spec.toUpperCase()}.`, 'system');
                            break;
                        }
                        setDefaultSpec(spec);
                        print(`TEMPLATE UPDATED TO ${spec.toUpperCase()}.`, 'system');
                    } else {
                        print('Usage: codex spec [fighter|rogue|miner|summoner|explorer] | codex spec all [fighter|rogue|miner|summoner|explorer]', 'error');
                    }
                } else if (sub === 'refactor') {
                    if (args.length === 2) {
                        print('--- SYSTEM REFACTOR PROTOCOL ---');
                        print('codex refactor [cuYield|fragmentRate]');
                    } else {
                        const type = args[2] as 'cuYield' | 'fragmentRate';
                        if (initiateRefactor(type)) {
                            print('SYSTEM REFACTORED.', 'system');
                        } else {
                            print('REFACTOR FAILED.', 'error');
                        }
                    }
                } else if (sub === 'agent') {
                    const agentBuyCost = 500 + (codexAgents.length * 1000);
                    const agentSub = args[2]?.toLowerCase();

                    if (!agentSub) {
                        print('--- AGENT INTERFACE ---');
                        codexAgents.forEach(agent => {
                            const agentLabel = agent.nickname ? `${agent.nickname} // ${agent.name}` : agent.name;
                            print(`${agentLabel.padEnd(22)} [${agent.strategy.toUpperCase()}]`);
                        });
                        print(`\n- codex agent buy [strat] : ${agentBuyCost} CU`);
                        print('- codex agent set [name] [strat]');
                        print(`STRATS: ${AGENT_STRATEGIES.join(', ')}`);
                    } else if (agentSub === 'buy') {
                        const strategy = (args[3] || 'random').toLowerCase();
                        if (!isValidStrategy(strategy)) {
                            print(`Usage: codex agent buy [${AGENT_STRATEGIES.join('|')}]`, 'error');
                        } else if (addCodexAgent(strategy)) {
                            print('AGENT RECRUITED.', 'system');
                        } else {
                            print('INSUFFICIENT COMPUTE UNITS TO RECRUIT AGENT.', 'error');
                        }
                    } else if (agentSub === 'set' || agentSub === 'behavior') {
                        setAgentBehavior(args[3], args[4]);
                    } else {
                        print('Usage: codex agent | codex agent buy [strategy] | codex agent set [agent] [strategy]', 'error');
                    }
                } else {
                    print('Usage: codex | codex buy [1-5] | codex spec [type] | codex agent | codex refactor [bonus]', 'error');
                }
                break;
            }

            case 'terminal':
                if (args[1] === '--pin') {
                    toggleTerminalPinned();
                    print('TERMINAL PIN STATUS TOGGLED.', 'system');
                } else {
                    print('Usage: terminal --pin', 'error');
                }
                break;

            case 'inbox':
                if (args[1] === '--pin') {
                    toggleInboxPinned();
                    print('INBOX PIN STATUS TOGGLED.', 'system');
                } else {
                    print('Usage: inbox --pin', 'error');
                }
                break;

            case 'archive':
                if (args[1] === '--pin') {
                    toggleArchivePinned();
                    print('ARCHIVE PIN STATUS TOGGLED.', 'system');
                } else {
                    print('Usage: archive --pin', 'error');
                }
                break;

            case 'agents': {
                const sub = args[1]?.toLowerCase();
                if (sub === '--pin') {
                    toggleAgentsPinned();
                    print('AGENT WINDOW TOGGLED.', 'system');
                } else if (sub === 'set' || sub === 'behavior') {
                    setAgentBehavior(args[2], args[3]);
                } else {
                    print(`ACTIVE AGENTS: ${codexAgents.length}`);
                    codexAgents.forEach(agent => {
                        const agentLabel = agent.nickname ? `${agent.nickname} // ${agent.name}` : agent.name;
                        print(`- ${agentLabel}: ${agent.strategy} (${agent.lastAction || 'IDLE'})`);
                    });
                }
                break;
            }

            case 'metamap':
                if (args[1] === '--pin') {
                    toggleMetaMapPinned();
                    print('METAMAP PIN STATUS TOGGLED.', 'system');
                } else if (metaMap) {
                    const gridString = metaMap.map((row, y) => (
                        row.map((room, x) => {
                            const hasBreach = breaches.some(breach => breach.floor === currentFloor && breach.roomX === x && breach.roomY === y);
                            if (hasBreach) return '@';
                            if (room.isDiscovered) {
                                if (room.specialType?.startsWith('K')) return 'K';
                                if (room.specialType?.startsWith('L')) return 'L';
                                if (room.specialType === 'mining_boost') return 'M';
                                return room.isBoss ? 'B' : 'X';
                            }
                            return '.';
                        }).join(' ')
                    )).join('\n');
                    print(`--- SECTOR METAMAP F${currentFloor} ---\n${gridString}`, 'output', 'ascii-grid');
                }
                break;

            case 'wallets': {
                const sub = args[1]?.toLowerCase();
                const sub2 = args[2]?.toLowerCase();

                if (sub === '--pin') {
                    toggleWalletsPinned();
                    print('WALLETS PIN STATUS TOGGLED.', 'system');
                } else if (sub === 'set-budget' || (sub === 'agent' && sub2 === 'set') || (sub === 'set' && sub2 === 'budget')) {
                    const isThreePart = (sub === 'agent' && sub2 === 'set') || (sub === 'set' && sub2 === 'budget');
                    const name = isThreePart ? args[3] : args[2];
                    const amount = parseFloat(isThreePart ? args[4] : args[3]);
                    const agent = findAgent(name);

                    if (!agent || isNaN(amount) || amount < 0) {
                        const correctSub = sub === 'agent' ? 'agent set' : (sub === 'set' ? 'set budget' : 'set-budget');
                        print(`Usage: wallets ${correctSub} [agent_name] [amount]`, 'error');
                    } else {
                        setAgentBudget(agent.id, amount);
                        print(`BUDGET FOR ${agent.name} SET TO ${amount} CU.`, 'system');
                    }
                } else if (sub === 'set-refill') {
                    const agent = findAgent(args[2]);
                    const amount = parseFloat(args[3]);
                    if (!agent || isNaN(amount) || amount < 0) {
                        print('Usage: wallets set-refill [agent_name] [amount]', 'error');
                    } else {
                        setAgentRefillRate(agent.id, amount);
                        print(`REFILL RATE FOR ${agent.name} SET TO ${amount} CU/tick.`, 'system');
                    }
                } else if (sub === 'refill') {
                    const agent = findAgent(args[2]);
                    const amount = parseFloat(args[3]);
                    if (!agent || isNaN(amount) || amount <= 0) {
                        print('Usage: wallets refill [agent_name] [amount]', 'error');
                    } else {
                        const transferred = refillAgent(agent.id, amount);
                        if (transferred > 0) {
                            print(`TRANSFERRED ${transferred} CU TO ${agent.name}.`, 'system');
                        } else {
                            print(`INSUFFICIENT FUNDS OR AGENT AT CAPACITY. (Balance: ${formatComputeUnits(computeUnits)})`, 'error');
                        }
                    }
                } else {
                    print('--- AGENT WALLET VIEW: ACTIVE ---');
                    codexAgents.forEach(agent => {
                        const agentLabel = agent.nickname ? `${agent.nickname} // ${agent.name}` : agent.name;
                        print(`${agentLabel.padEnd(22)} | BUDGET: ${agent.budget.toFixed(1)} / ${agent.maxBudget} | REFILL: ${agent.refillRate}/tick`);
                    });
                    print('\nUsage: wallets --pin | wallets refill [agent] [amount] | wallets set-budget [agent] [amount] | wallets set-refill [agent] [amount]');
                }
                break;
            }

            default:
                print(`UNKNOWN COMMAND: ${command}. Type "help" for a list of available commands.`, 'error');
        }
    }, [
        print, playSound, unlockedFiles, computeUnits, codexAgents,
        getUpgradeCost, upgradeCrawler, reduceClutter, toggleAgentsPinned, toggleTerminalPinned,
        toggleMetaMapPinned, toggleWalletsPinned, toggleBuildPinned, toggleDepartmentsPinned, toggleInboxPinned, toggleArchivePinned, toggleLedgerPinned, opsLedger, clearOpsLedger, markFileAsRead, unlockFile, addRestoration,
        toggleBreachCliPinned, systemClutter, initiateRefactor, crawlerStats, terminalHistory, setDefaultSpec,
        scrapBrickedNode, repairBrickedNode, activeBrickedNode, getCipherProgress,
        attemptCipherUnlock, setAgentStrategy, setAgentBudget, setAgentRefillRate,
        refillAgent, isFileAccessible, addCodexAgent, metaMap, breaches, currentFloor, setBreachSpec, clear,
        notificationsEnabled, setNotificationsEnabled, dismissAlert
    ]);

    return {
        history: terminalHistory,
        inputVal: terminalInput,
        setInputVal: setTerminalInput,
        handleCommand,
        print,
        clear,
        endRef
    };
};
