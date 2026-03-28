import { useCallback, useRef, useEffect, useState } from 'react';
import React from 'react';
import { useGameState, type LogEntry } from '../context/GameStateContext';
import { useDungeon } from '../context/DungeonContext';
import { useSound } from './useSound';
import { storyData } from '../data/story';
import { shiftDecrypt, vigenereDecrypt, lathamDecrypt } from '../utils/cipherUtils';
import { generateHackingGame, getSimilarity, type HackingGame } from '../utils/hackingEngine';

export const useTerminal = () => {
    const { 
        unlockedFiles, archiveRestoration, computeUnits,
        spendComputeUnits, codexAgents, addCodexAgent, 
        getUpgradeCost, upgradeCrawler,
        reduceClutter, toggleAgentsPinned, toggleTerminalPinned, markFileAsRead, 
        unlockFile, addRestoration, systemClutter, 
        initiateRefactor, crawlerStats,
        terminalHistory, setTerminalHistory, terminalInput, setTerminalInput,
        defaultCrawlerSpec, setDefaultSpec
    } = useGameState();
    const { metaMap, breaches } = useDungeon();
    const { playSound } = useSound();
    
    const [hackingGame, setHackingGame] = useState<HackingGame | null>(null);
    const [hackingLogs, setHackingLogs] = useState<string[]>([]);

    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [terminalHistory]);

    const print = useCallback((content: string | React.ReactNode, type: LogEntry['type'] = 'output') => {
        setTerminalHistory(prev => [...prev, { type, content }]);
    }, [setTerminalHistory]);

    const clear = useCallback(() => setTerminalHistory([]), [setTerminalHistory]);

    const isFileAccessible = useCallback((fileId: string) => {
        const doc = storyData.find(d => d.id === fileId);
        return !!doc;
    }, []);

    const handleCommand = useCallback((cmd: string) => {
        const trimmed = cmd.trim();
        if (!trimmed) return;

        print(`> ${trimmed}`, 'input');
        playSound('success');

        const args = trimmed.split(/\s+/);
        const command = args[0].toLowerCase();

        switch (command) {
            case 'help':
                print(
                    <>
                        <div style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>SYSTEM COMMANDS:</div>
                        <div>- <strong>help</strong>: Show this message</div>
                        <div>- <strong>ls / dir</strong>: List accessible files</div>
                        <div>- <strong>read [filename]</strong>: Display file content</div>
                        <div>- <strong>clear</strong>: Clear terminal screen</div>
                        <div>- <strong>status</strong>: View comprehensive system status & stats</div>
                        <div>- <strong>defrag [amount]</strong>: Spend CU to reduce system clutter</div>
                        <div style={{ color: 'var(--color-primary)', fontWeight: 'bold', marginTop: '4px' }}>CRYPTANALYSIS:</div>
                        <div>- <strong>unlock [filename] [password]</strong>: Decrypt password-locked files</div>
                        <div>- <strong>decrypt [filename] [type] [key]</strong>: Run cipher decryption</div>
                        <div style={{ color: 'var(--color-primary)', fontWeight: 'bold', marginTop: '4px' }}>CODEX:</div>
                        <div>- <strong>codex</strong>: Access upgrades & agent management</div>
                        <div>- <strong>codex spec [type]</strong>: Set default crawler class</div>
                        <div style={{ color: 'var(--color-primary)', fontWeight: 'bold', marginTop: '4px' }}>INTERFACE:</div>
                        <div>- <strong>agents --pin</strong>: Toggle agent status window</div>
                        <div>- <strong>terminal --pin</strong>: Toggle global pinned terminal</div>
                    </>
                );
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
                print(<pre style={{ margin: 0 }}>{listStr}</pre>);
                break;
            }

            case 'history': {
                const inputs = terminalHistory.filter(h => h.type === 'input').map(h => h.content);
                print(inputs.length ? inputs.map((i, idx) => `${idx + 1}: ${i}`).join('\n') : 'No history found.');
                break;
            }

            case 'read':
            case 'open': {
                if (args.length < 2) {
                    print('Usage: read [filename]', 'error');
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
                    if (docToRead.secretContent) {
                        print(<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{docToRead.secretContent}</pre>);
                    } else {
                        print(<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{docToRead.content}</pre>);
                    }
                } else {
                    print(<pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--color-alert)' }}>[SYSTEM] ANOMALOUS ACCESS ATTEMPT LOGGED. THE TRUTH IS FRAGMENTED.</pre>, 'error');
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
                    const shiftNum = parseInt(decKey);
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
                } else if (decType === 'latham') {
                    const lathamKey = parseInt(decKey);
                    if (isNaN(lathamKey) || lathamKey < 1 || lathamKey > 25) {
                        print('LATHAM KEY MUST BE A NUMBER BETWEEN 1 AND 25.', 'error');
                        break;
                    }
                    decryptedText = lathamDecrypt(rawCipher, lathamKey);
                }

                print(`APPLYING ${decType.toUpperCase()} DECRYPTION TO ${decFile}...`, 'system');
                print(<pre style={{ margin: 0, color: 'var(--color-text)' }}>{decryptedText}</pre>, 'output');

                const keyMatches = decType === (docToDec.cipherType || 'shift') &&
                    decKey.toUpperCase() === docToDec.cipherKey.toUpperCase();

                if (keyMatches) {
                    unlockFile(docToDec.id);
                    markFileAsRead(docToDec.id);
                    addRestoration(15);
                    print('DECRYPTION VERIFIED. FILE UNLOCKED.', 'system');
                    if (docToDec.secretContent) {
                        const bonusLines = docToDec.secretContent.split('\n').filter(l => l.startsWith('['));
                        bonusLines.forEach(l => print(l, 'system'));
                    }
                } else {
                    print('OUTPUT DOES NOT MATCH KNOWN PLAINTEXT SIGNATURES. TRY A DIFFERENT KEY OR CIPHER TYPE.', 'error');
                }
                break;
            }

            case 'status': {
                print(`--- SYSTEM STATUS REPORT ---`);
                print(`[ARCHIVE] Restoration: ${Math.floor(archiveRestoration)}%`);
                print(`[COMPUTE] Units: ${computeUnits.toFixed(2)}`);
                print(`[CLUTTER] Level: ${systemClutter.toFixed(1)}%`);
                print(`[CRAWLER] LVL:${crawlerStats.baseDmg} DMG | HP:${100 + crawlerStats.maxHpBoost} | SPD:${crawlerStats.speedBoost} | WINDOWS:${crawlerStats.maxBreachWindows}`);
                break;
            }

            case 'defrag': {
                if (args.length < 2) {
                    print(`Usage: defrag [amount]\nCurrent Clutter: ${systemClutter.toFixed(1)}%`, 'error');
                    break;
                }
                const amt = parseFloat(args[1]);
                if (isNaN(amt) || amt <= 0) {
                    print('INVALID AMOUNT.', 'error');
                    break;
                }
                if (reduceClutter(amt)) {
                    print(`DEFRAG SUCCESSFUL. SYSTEM CLUTTER REDUCED BY ${amt.toFixed(1)}%.`, 'system');
                } else {
                    print(`INSUFFICIENT RESOURCES FOR DEFRAG.`, 'error');
                }
                break;
            }

            case 'hack': {
                if (hackingGame) {
                    print('HACKING SESSION ALREADY ACTIVE.', 'error');
                    break;
                }
                const game = generateHackingGame(archiveRestoration > 50 ? 8 : 6);
                setHackingGame(game);
                setHackingLogs(['INITIALIZING OVERRIDE...']);
                print('--- SECURITY OVERRIDE INITIATED ---', 'system');
                break;
            }

            case 'codex': {
                const dmgCost = getUpgradeCost('baseDmg');
                const healthCost = getUpgradeCost('maxHpBoost');
                const speedCost = getUpgradeCost('speedBoost');
                const procCost = getUpgradeCost('maxBreachWindows');
                const minerCost = getUpgradeCost('minerYield');

                if (args.length === 1) {
                    print(`--- PRGN_OS CODEX ---`);
                    print(`CURRENT BALANCE: ${computeUnits.toFixed(2)} CUs`);
                    print(`1. [DAMAGE]   - Cost: ${dmgCost} CU`);
                    print(`2. [SHIELDS]  - Cost: ${healthCost} CU`);
                    print(`3. [OVERCLOCK] - Cost: ${speedCost} CU`);
                    print(`4. [PARALLEL] - Cost: ${procCost} CU`);
                    print(`5. [MINING]   - Cost: ${minerCost} CU`);
                    print(`\nUsage: codex buy [1-5] | codex spec [type] | codex agent | codex refactor`);
                } else if (args[1] === 'buy') {
                    const item = args[2];
                    if (item === '1') upgradeCrawler('baseDmg');
                    else if (item === '2') upgradeCrawler('maxHpBoost');
                    else if (item === '3') upgradeCrawler('speedBoost');
                    else if (item === '4') upgradeCrawler('maxBreachWindows');
                    else if (item === '5') upgradeCrawler('minerYield');
                    print(`UPGRADE PURCHASED.`, 'system');
                } else if (args[1] === 'spec') {
                    const spec = (args[2] || '').toLowerCase() as any;
                    if (['fighter', 'rogue', 'miner', 'summoner'].includes(spec)) {
                        setDefaultSpec(spec);
                        print(`TEMPLATE UPDATED TO ${spec.toUpperCase()}.`, 'system');
                    } else {
                        print(`Usage: codex spec [fighter|rogue|miner|summoner]`, 'error');
                    }
                } else if (args[1] === 'refactor') {
                    if (args.length === 2) {
                        print(`--- SYSTEM REFACTOR PROTOCOL ---`);
                        print(`codex refactor [cuYield|fragmentRate]`);
                    } else {
                        const type = args[2] as any;
                        if (initiateRefactor(type)) {
                            print(`SYSTEM REFACTORED.`, 'system');
                        } else {
                            print(`REFACTOR FAILED.`, 'error');
                        }
                    }
                } else if (args[1] === 'agent') {
                    const agentBuyCost = 500 + (codexAgents.length * 1000);
                    if (args.length === 2) {
                        print(`--- AGENT INTERFACE ---`);
                        codexAgents.forEach(a => print(`${a.name.padEnd(10)} [${a.strategy.toUpperCase()}]`));
                        print(`\n- codex agent buy [strat] : ${agentBuyCost} CU`);
                        print(`STRATS: responsible, brave, random, parallel, defrag, scrapper, mechanic, disabled`);
                    } else if (args[2] === 'buy') {
                        const strat = (args[3] || 'random').toLowerCase() as any;
                        addCodexAgent(strat);
                        print(`AGENT RECRUITED.`, 'system');
                    }
                }
                break;
            }
            
            case 'terminal': {
                if (args[1] === '--pin') {
                    toggleTerminalPinned();
                    print('TERMINAL PIN STATUS TOGGLED.', 'system');
                } else {
                    print('Usage: terminal --pin', 'error');
                }
                break;
            }

            case 'agents': {
                if (args[1] === '--pin') {
                    toggleAgentsPinned();
                    print('AGENT WINDOW TOGGLED.', 'system');
                } else {
                    print(`ACTIVE AGENTS: ${codexAgents.length}`);
                    codexAgents.forEach(a => print(`- ${a.name}: ${a.strategy} (${a.lastAction || 'IDLE'})`));
                }
                break;
            }

            default:
                print(`UNKNOWN COMMAND: ${command}. Type "help" for a list of available commands.`, 'error');
        }
    }, [
        print, playSound, unlockedFiles, archiveRestoration, computeUnits, 
        systemClutter, crawlerStats, codexAgents, isFileAccessible, 
        markFileAsRead, unlockFile, addRestoration, 
        upgradeCrawler, addCodexAgent, reduceClutter, 
        toggleAgentsPinned, toggleTerminalPinned, terminalHistory,
        getUpgradeCost, initiateRefactor, setDefaultSpec, hackingGame
    ]);

    const handleHacking = useCallback((guess: string) => {
        if (!hackingGame) return;
        const upperGuess = guess.toUpperCase();
        const found = hackingGame.words.find(w => w.word === upperGuess);

        if (!found) {
            setHackingLogs(prev => [...prev, `ERR: Word '${upperGuess}' not found in stack.`]);
            playSound('error');
            return;
        }

        if (upperGuess === hackingGame.correctPassword) {
            playSound('success');
            addRestoration(10);
            print(`OVERRIDE SUCCESSFUL. ACCESS GRANTED TO SECTOR NULL.`, 'system');
            setHackingGame(null);
        } else {
            const sim = getSimilarity(upperGuess, hackingGame.correctPassword);
            playSound('error');
            setHackingGame(prev => {
                const next = { ...prev!, attemptsRemaining: prev!.attemptsRemaining - 1 };
                if (next.attemptsRemaining <= 0) {
                    print(`OVERRIDE CRITICAL FAILURE. LOCKOUT INITIATED.`, 'error');
                    setHackingGame(null);
                } else {
                    setHackingLogs(l => [...l, `GUESS: ${upperGuess} - SIMILARITY: ${sim}/${hackingGame.correctPassword.length}`]);
                }
                return next;
            });
        }
    }, [hackingGame, playSound, addRestoration, print]);

    return {
        history: terminalHistory,
        inputVal: terminalInput,
        setInputVal: setTerminalInput,
        handleCommand,
        print,
        clear,
        endRef,
        hackingGame,
        hackingLogs,
        handleHacking
    };
};
