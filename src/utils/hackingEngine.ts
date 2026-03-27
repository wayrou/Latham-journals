export interface HackingGame {
    grid: string[][];
    words: { word: string; pos: { x: number; y: number } }[];
    correctPassword: string;
    attemptsRemaining: number;
}

const SYMBOLS = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '[', ']', '{', '}', '<', '>', '/', '?', ';', ':'];
const WORD_POOL = [
    'OVERRIDE', 'PROTOCOL', 'SOLARIS', 'LATHAM', 'PEREGRINE',
    'RESTORE', 'ARCHIVE', 'CONTAIN', 'SENTINEL', 'ISOLATE',
    'CRITICAL', 'SECURITY', 'TERMINAL', 'SYSTEMS', 'SYNERGY'
];

export const generateHackingGame = (difficulty: number = 1): HackingGame => {
    const size = 12;
    const grid: string[][] = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
    );

    const numWords = 5 + difficulty;
    const selectedWords: string[] = [];
    const wordsWithPos: { word: string; pos: { x: number; y: number } }[] = [];

    // Select random words from pool
    const pool = [...WORD_POOL];
    for (let i = 0; i < numWords; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        selectedWords.push(pool.splice(idx, 1)[0]);
    }

    const correctPassword = selectedWords[Math.floor(Math.random() * selectedWords.length)];

    // Place words in grid
    selectedWords.forEach(word => {
        let placed = false;
        while (!placed) {
            const x = Math.floor(Math.random() * (size - word.length));
            const y = Math.floor(Math.random() * size);

            // Basic check if space is occupied by another word (for simplicity, we just overwrite symbols)
            // In a better engine we'd check for collisions, but symbols are fine to overwrite.
            for (let i = 0; i < word.length; i++) {
                grid[y][x + i] = word[i];
            }
            wordsWithPos.push({ word, pos: { x, y } });
            placed = true;
        }
    });

    return {
        grid,
        words: wordsWithPos,
        correctPassword,
        attemptsRemaining: 4
    };
};

export const getSimilarity = (word1: string, word2: string): number => {
    let similarity = 0;
    const len = Math.min(word1.length, word2.length);
    for (let i = 0; i < len; i++) {
        if (word1[i] === word2[i]) similarity++;
    }
    return similarity;
};
