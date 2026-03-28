// Cipher Fragment & CORE Puzzle System

export interface CipherFragment {
    id: string;
    cipherId: string;
    content: string;       // partial hint text
    discoveredAt: number;
    roomCoords: string;
}

export interface CipherDefinition {
    id: string;
    name: string;
    requiredFragments: number;
    password: string;
    rewardFileId: string;
    hints: string[];
}

// Pre-defined ciphers for the CORE narrative
export const CIPHER_DEFINITIONS: CipherDefinition[] = [
    {
        id: 'cipher-alpha',
        name: 'PROTOCOL_ALPHA',
        requiredFragments: 3,
        password: 'peregrine',
        rewardFileId: 'hidden-alpha',
        hints: [
            'The bird that never rests...',
            '...named for its speed...',
            '...a falcon by another name.'
        ]
    },
    {
        id: 'cipher-beta',
        name: 'PROTOCOL_BETA',
        requiredFragments: 4,
        password: 'latham',
        rewardFileId: 'hidden-beta',
        hints: [
            'The family at the center...',
            '...whose name graces these archives...',
            '...six letters, a surname...',
            '...begins and ends with consonants.'
        ]
    },
    {
        id: 'cipher-gamma',
        name: 'PROTOCOL_GAMMA',
        requiredFragments: 5,
        password: 'archival',
        rewardFileId: 'hidden-gamma',
        hints: [
            'What this system preserves...',
            '...the act of preservation itself...',
            '...seven letters, an adjective...',
            '...related to records and memory...',
            '...the purpose of PRGN_OS.'
        ]
    },
    {
        id: 'cipher-delta',
        name: 'PROTOCOL_DELTA',
        requiredFragments: 6,
        password: 'refactor',
        rewardFileId: 'hidden-delta',
        hints: [
            'To rebuild without changing purpose...',
            '...a programmer\'s ritual...',
            '...clean code demands it...',
            '...eight letters, a verb...',
            '...the system\'s reset mechanism...',
            '...sometimes you must tear down to build up.'
        ]
    }
];

/**
 * Roll for a cipher fragment drop. Returns a fragment or null.
 * @param dropRate Base drop rate (0-1), default 0.15
 * @param existingFragments Already collected fragments
 * @param roomCoords Room coordinates string for provenance
 */
export function rollCipherDrop(
    dropRate: number,
    existingFragments: CipherFragment[],
    roomCoords: string
): CipherFragment | null {
    if (Math.random() > dropRate) return null;

    // Find incomplete ciphers
    const incomplete = CIPHER_DEFINITIONS.filter(cd => {
        const found = existingFragments.filter(f => f.cipherId === cd.id).length;
        return found < cd.requiredFragments;
    });

    if (incomplete.length === 0) return null;

    // Weight toward ciphers with fewer found fragments
    const weights = incomplete.map(cd => {
        const found = existingFragments.filter(f => f.cipherId === cd.id).length;
        return { cipher: cd, weight: cd.requiredFragments - found };
    });
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * totalWeight;
    
    let chosen = weights[0].cipher;
    for (const w of weights) {
        roll -= w.weight;
        if (roll <= 0) { chosen = w.cipher; break; }
    }

    const foundCount = existingFragments.filter(f => f.cipherId === chosen.id).length;
    const hint = chosen.hints[foundCount] || '[ DATA CORRUPTED ]';

    return {
        id: `frag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        cipherId: chosen.id,
        content: hint,
        discoveredAt: Date.now(),
        roomCoords
    };
}

/**
 * Check if a cipher password is correct.
 */
export function validateCipherPassword(input: string, attempt: string): boolean {
    const cipher = CIPHER_DEFINITIONS.find(c => 
        c.id.toLowerCase() === input.toLowerCase() || 
        c.name.toLowerCase() === input.toLowerCase()
    );
    if (!cipher) return false;
    return attempt.toLowerCase().trim() === cipher.password;
}
