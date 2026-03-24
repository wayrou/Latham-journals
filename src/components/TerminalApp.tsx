import React, { useState, useRef, useEffect } from 'react';
import { useGameState } from '../context/GameStateContext';
import { storyData } from '../data/story';

interface LogEntry {
    type: 'input' | 'output' | 'error' | 'system';
    content: string | React.ReactNode;
}

const TerminalApp: React.FC = () => {
    const { unlockedFiles, clearanceLevel, unlockFile, setClearance } = useGameState();
    const [inputVal, setInputVal] = useState('');
    const [history, setHistory] = useState<LogEntry[]>([
        { type: 'system', content: 'PEREGRINE TECHNOLOGIES TERMINAL v4.2.1 CONNECTED.' },
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
        if (!doc) return false;
        if (doc.type === 'hidden' && clearanceLevel < (doc.requiredClearance || 99)) return false;
        return true;
    };

    const handleCommand = (cmd: string) => {
        const trimmed = cmd.trim();
        if (!trimmed) return;

        print(`> ${trimmed}`, 'input');

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
                        <div>- <strong>clearance</strong>: Check current clearance level</div>
                        <div>ADVANCED COMMANDS:</div>
                        <div>- <strong>unlock [filename] [password]</strong>: Decrypt password-locked files</div>
                        <div>- <strong>reconstruct [filename] [word1] [word2]...</strong>: Fill redacted phrases sequentially</div>
                        <div>- <strong>xref [file1] [file2]</strong>: Cross-reference data between two files</div>
                        <div>- <strong>decrypt [filename] [shift_key]</strong>: Run cipher breakdown algorithm</div>
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

            case 'clearance':
                print(`CURRENT CLEARANCE LEVEL: ${clearanceLevel}`);
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
                    if (docToRead.secretContent) {
                        print(<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{docToRead.secretContent}</pre>);
                    } else {
                        print(<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{docToRead.content}</pre>);
                    }
                } else {
                    print(<pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--color-alert)' }}>{docToRead.content}</pre>);
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
                    print(`FILE DECRYPTED: ${unlockFileTarget}\n${docToUnlock.secretContent}`, 'system');
                } else {
                    print('PASSWORD REJECTED.', 'error');
                }
                break;

            case 'reconstruct':
                if (args.length < 3) {
                    print('Usage: reconstruct [filename] [word1] [word2]...', 'error');
                    break;
                }
                const reconFileTarget = args[1];
                const attemptTerms = args.slice(2).map(t => t.toLowerCase());

                const docToRecon = storyData.find(d => d.name === reconFileTarget || d.id === reconFileTarget);

                if (!docToRecon || !isFileAccessible(docToRecon.id)) {
                    print(`File not found: ${reconFileTarget}`, 'error');
                    break;
                }

                if (docToRecon.type !== 'redacted' || !docToRecon.missingTerms) {
                    print(`File ${reconFileTarget} cannot be reconstructed.`, 'error');
                    break;
                }

                // Check if words match exactly
                let match = true;
                if (docToRecon.missingTerms.length !== attemptTerms.length) {
                    match = false;
                } else {
                    for (let i = 0; i < attemptTerms.length; i++) {
                        if (docToRecon.missingTerms[i] !== attemptTerms[i]) {
                            match = false;
                            break;
                        }
                    }
                }

                if (match) {
                    unlockFile(docToRecon.id);
                    print(`RECONSTRUCTION SUCCESSFUL: ${reconFileTarget}\n\n${docToRecon.secretContent}`, 'system');
                } else {
                    print('RECONSTRUCTION FAILED. TERM MISMATCH OR INCORRECT SEQUENCE.', 'error');
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
                        print('XREF MATCH: Containment protocol implies sequence alpha. The hidden cipher determines max clearance.', 'system');
                    } else {
                        print('XREF FAILED: One or more files are encrypted or lack sufficient context.', 'error');
                    }
                } else {
                    print('XREF FAILED: No correlation found between these files.', 'error');
                }
                break;

            case 'decrypt':
                if (args.length < 3) {
                    print('Usage: decrypt [filename] [shift_key]', 'error');
                    break;
                }
                const decFile = args[1];
                const decKey = args[2];

                const docToDec = storyData.find(d => d.name === decFile || d.id === decFile);

                if (!docToDec || !isFileAccessible(docToDec.id)) {
                    print(`File not found: ${decFile}`, 'error');
                    break;
                }

                if (docToDec.type !== 'cipher' || !docToDec.cipherKey) {
                    print(`File ${decFile} does not use standard cipher protocol.`, 'error');
                    break;
                }

                if (docToDec.cipherKey === decKey) {
                    unlockFile(docToDec.id);
                    setClearance(2);
                    print(`DECRYPTION SUCCESSFUL: ${decFile}\n\n${docToDec.secretContent}`, 'system');
                } else {
                    print('DECRYPTION ALGORITHM FAILED. INCORRECT KEY.', 'error');
                }
                break;

            default:
                print(`Command not recognized: ${command}. Type "help" for a list of commands.`, 'error');
                break;
        }
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleCommand(inputVal);
        setInputVal('');
    };

    return (
        <div style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
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

            <form onSubmit={onSubmit} style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text)', marginRight: '0.5rem' }}>{'>'}</span>
                <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
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
