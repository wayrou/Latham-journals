import React, { useState, useRef, useEffect } from 'react';
import { useGameState } from '../context/GameStateContext';
import { useSound } from '../hooks/useSound';
import { storyData } from '../data/story';
import { generateHackingGame, getSimilarity, type HackingGame } from '../utils/hackingEngine';
import { shiftDecrypt, vigenereDecrypt, lathamDecrypt } from '../utils/cipherUtils';

interface LogEntry {
    type: 'input' | 'output' | 'error' | 'system';
    content: string | React.ReactNode;
}

const TerminalApp: React.FC = () => {
    const {
        unlockedFiles, markFileAsRead, unlockFile,
        addRestoration,
        fragments, spendFragments, upgradeCrawler
    } = useGameState();
    const { playSound } = useSound();
    const [inputVal, setInputVal] = useState('');
    const [hackingGame, setHackingGame] = useState<HackingGame | null>(null);
    const [hackingLogs, setHackingLogs] = useState<string[]>([]);
    const [history, setHistory] = useState<LogEntry[]>([
        { type: 'system', content: 'PRGN_OS SECURE TERMINAL v4.2.1 CONNECTED.' },
        { type: 'system', content: 'ENTER COMMAND OR "help" FOR SYSTEM ASSISTANCE.' }
    ]);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const print = (content: string | React.ReactNode, type: LogEntry['type'] = 'output') => {
        setHistory(prev => [...prev, { type, content }]);
    };

    const clear = () => setHistory([]);

    const isFileAccessible = (fileId: string) => {
        const doc = storyData.find(d => d.id === fileId);
        return !!doc;
    };

    const handleCommand = (cmd: string) => {
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
                        <div>SYSTEM COMMANDS:</div>
                        <div>- <strong>help</strong>: Show this message</div>
                        <div>- <strong>ls / dir</strong>: List accessible files</div>
                        <div>- <strong>read [filename]</strong>: Display file content</div>
                        <div>- <strong>clear</strong>: Clear terminal screen</div>
                        <div>- <strong>history</strong>: View executed commands history</div>
                        <div>CRYPTANALYSIS:</div>
                        <div>- <strong>unlock [filename] [password]</strong>: Decrypt password-locked files</div>
                        <div>- <strong>decrypt [filename] [type] [key]</strong>: Run cipher decryption (shift/vigenere/latham)</div>
                        <div>- <strong>force-decrypt [filename]</strong>: Spend 100 FRAG to brute-force a cipher file</div>
                        <div>- <strong>xref [file1] [file2]</strong>: Cross-reference data between two files</div>
                        <div>CODEX:</div>
                        <div>- <strong>codex</strong>: Access the Codex for Breach upgrades</div>
                    </>
                );
                break;

            case 'clear':
                clear();
                break;

            case 'ls':
            case 'dir':
                const visibleDocs = storyData.filter(d => isFileAccessible(d.id));
                const listStr = visibleDocs.map(d => {
                    const unlocked = d.unlockedByDefault || unlockedFiles.includes(d.id);
                    const lockStatus = unlocked ? '[CLEARED]' : '[ENCRYPTED]';
                    return `${d.name.padEnd(20)} ${lockStatus}`;
                }).join('\n');
                print(<pre style={{ margin: 0 }}>{listStr}</pre>);
                break;

            case 'history':
                const inputs = history.filter(h => h.type === 'input').map(h => h.content);
                print(inputs.length ? inputs.map((i, idx) => `${idx + 1}: ${i}`).join('\n') : 'No history found.');
                break;



            case 'read':
            case 'open':
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

            case 'unlock':
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




            case 'xref':
                if (args.length < 3) {
                    print('Usage: xref [file1] [file2]', 'error');
                    break;
                }
                const f1 = args[1];
                const f2 = args[2];

                const isAnomaly = [f1, f2].some(f => f.includes('anomaly'));
                const isLocked1 = [f1, f2].some(f => f.includes('locked-01'));

                if (isAnomaly && isLocked1) {
                    const locked1Doc = storyData.find(d => d.id === 'locked-01');
                    if (locked1Doc && unlockedFiles.includes(locked1Doc.id)) {
                        unlockFile('xref'); // Provide a virtual xref success state
                        markFileAsRead('xref');
                        addRestoration(5);
                        print('XREF MATCH: Containment protocol implies sequence alpha. The hidden cipher determines max clearance.', 'system');
                    } else {
                        print('XREF FAILED: One or more files are encrypted or lack sufficient context.', 'error');
                    }
                } else {
                    print('XREF FAILED: No correlation found between these files.', 'error');
                }
                break;

            case 'decrypt':
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

                // Extract cipher text (strip system notes)
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

                // Check if the key matches
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

            case 'force-decrypt':
                if (args.length < 2) {
                    print('Usage: force-decrypt [filename]', 'error');
                    print('Cost: 100 FRAGMENTS (earned via BREACH operations)', 'error');
                    break;
                }
                const forceFile = args[1];
                const forceDoc = storyData.find(d => d.name === forceFile || d.id === forceFile);

                if (!forceDoc || !isFileAccessible(forceDoc.id)) {
                    print(`File not found: ${forceFile}`, 'error');
                    break;
                }

                if (forceDoc.type !== 'cipher') {
                    print(`File ${forceFile} does not use cipher protocol. Use 'unlock' for password files.`, 'error');
                    break;
                }

                if (unlockedFiles.includes(forceDoc.id)) {
                    print(`File ${forceFile} is already decrypted.`, 'system');
                    break;
                }

                print(`BRUTE FORCE DECRYPTION REQUIRES 100 FRAGMENTS.`, 'system');
                print(`CURRENT BALANCE: ${fragments} FRAGMENTS`, 'system');

                if (spendFragments(100)) {
                    unlockFile(forceDoc.id);
                    markFileAsRead(forceDoc.id);
                    addRestoration(15);
                    print(`ALLOCATING COMPUTE CYCLES... BRUTE FORCE COMPLETE.`, 'system');
                    print(<pre style={{ margin: 0, color: 'var(--color-text)' }}>{forceDoc.secretContent}</pre>, 'output');
                } else {
                    print(`INSUFFICIENT FRAGMENTS. Mine more via BREACH operations.`, 'error');
                }
                break;

            case 'vendor':
            case 'codex':
                if (args.length === 1) {
                    print(`--- PRGN_OS CODEX ---`);
                    print(`CURRENT BALANCE: ${fragments} FRAGMENTS`);
                    print(`\nAVAILABLE UPGRADES:`);
                    print(`1. [DAMAGE] : Stabilize strike vectors (+1 Base Dmg) - Cost: 50 FRAG`);
                    print(`2. [SHIELDS]: Reinforce chassis latency (+5 Max HP) - Cost: 50 FRAG`);
                    print(`\nUsage: codex buy [1|2]`);
                } else if (args[1] === 'buy') {
                    const item = args[2];
                    if (item === '1') {
                        if (spendFragments(50)) {
                            upgradeCrawler('baseDmg');
                            print(`UPGRADE INSTALLED: BASE DAMAGE INCREASED.`, 'system');
                        } else {
                            print(`INSUFFICIENT FRAGMENTS. COLLECTION REQUIRED.`, 'error');
                        }
                    } else if (item === '2') {
                        if (spendFragments(50)) {
                            upgradeCrawler('maxHpBoost');
                            print(`UPGRADE INSTALLED: MAX HEALTH CAPACITY INCREASED.`, 'system');
                        } else {
                            print(`INSUFFICIENT FRAGMENTS. COLLECTION REQUIRED.`, 'error');
                        }
                    } else {
                        print(`UNKNOWN ITEM ID: ${item}`, 'error');
                    }
                }
                break;

            case 'override':
                if (args.length < 2) {
                    print('Usage: override [node_id]', 'error');
                    break;
                }
                const nodeToHack = args[1];
                // For now, any node name works to trigger the game
                setHackingGame(generateHackingGame());
                setHackingLogs([`[INITIALIZING OVERRIDE ON ${nodeToHack.toUpperCase()}]`, `[SEARCHING FOR ENTROPY... GEN_3_VECTORS_FOUND]`]);
                playSound('boot');
                break;

            default:
                print(`Command not recognized: ${command}. Type "help" for a list of commands.`, 'error');
                break;
        }
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cmd = inputVal.trim();
        if (!cmd) return;

        if (hackingGame) {
            handleHackingInput(cmd);
        } else {
            handleCommand(cmd);
        }
        setInputVal('');
    };

    const handleHackingInput = (guess: string) => {
        const upperGuess = guess.toUpperCase();
        const found = hackingGame!.words.find(w => w.word === upperGuess);

        if (!found) {
            setHackingLogs(prev => [...prev, `ERR: Word '${upperGuess}' not found in stack.`]);
            playSound('error');
            return;
        }

        if (upperGuess === hackingGame!.correctPassword) {
            playSound('success');
            addRestoration(10);
            print(`OVERRIDE SUCCESSFUL. ACCESS GRANTED TO SECTOR NULL.`, 'system');
            setHackingGame(null);
        } else {
            const sim = getSimilarity(upperGuess, hackingGame!.correctPassword);
            playSound('error');
            setHackingGame(prev => {
                const next = { ...prev!, attemptsRemaining: prev!.attemptsRemaining - 1 };
                if (next.attemptsRemaining <= 0) {
                    print(`OVERRIDE CRITICAL FAILURE. LOCKOUT INITIATED.`, 'error');
                    setHackingGame(null);
                } else {
                    setHackingLogs(l => [...l, `GUESS: ${upperGuess} - SIMILARITY: ${sim}/${hackingGame!.correctPassword.length}`]);
                }
                return next;
            });
        }
    };

    const renderHackingGrid = () => {
        if (!hackingGame) return null;
        return (
            <div style={{ padding: '1rem', border: '1px solid var(--color-accent)', backgroundColor: 'rgba(56, 163, 160, 0.05)' }}>
                <div style={{ color: 'var(--color-accent)', marginBottom: '1rem', borderBottom: '1px solid var(--color-accent)' }}>
                    {hackingGame.attemptsRemaining} ATTEMPT(S) REMAINING
                </div>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <div style={{ flex: 1 }}>
                        {hackingGame.grid.map((row, y) => (
                            <div key={y} style={{ display: 'flex', gap: '8px', lineHeight: '1.2' }}>
                                <span style={{ opacity: 0.5, marginRight: '10px' }}>0x{y.toString(16).toUpperCase()}8F</span>
                                {row.map((char, x) => (
                                    <span key={x} style={{
                                        color: /[A-Z]/.test(char) ? 'var(--color-text)' : 'var(--color-primary-dim)',
                                        fontWeight: /[A-Z]/.test(char) ? 'bold' : 'normal',
                                        cursor: /[A-Z]/.test(char) ? 'pointer' : 'default'
                                    }}>
                                        {char}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                    <div style={{ width: '250px', fontSize: '0.8rem', color: 'var(--color-accent)' }}>
                        {hackingLogs.map((log, i) => (
                            <div key={i} style={{ marginBottom: '4px' }}>&gt; {log}</div>
                        ))}
                    </div>
                </div>
                <div style={{ marginTop: '1rem', color: 'var(--color-primary-dim)', fontSize: '0.8rem' }}>
                    [ TYPE WORD TO SELECT ]
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            {hackingGame ? (
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
                    {renderHackingGrid()}
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
                    {history.map((entry, i) => (
                        <div key={i} style={{
                            marginBottom: '0.5rem',
                            color: entry.type === 'error' ? 'var(--color-alert)' :
                                entry.type === 'system' ? 'var(--color-accent)' :
                                    entry.type === 'input' ? 'var(--color-text)' : 'var(--color-primary)'
                        }}>
                            {typeof entry.content === 'string' ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>{entry.content}</pre> : entry.content}
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>
            )}

            <form onSubmit={onSubmit} style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text)', marginRight: '0.5rem' }}>{'>'}</span>
                <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => {
                        setInputVal(e.target.value);
                        playSound('click');
                    }}
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1rem',
                        outline: 'none'
                    }}
                />
            </form>
        </div>
    );
};

export default TerminalApp;
