/**
 * Cipher utilities for PRGN_OS terminal decryption puzzles.
 * Supports: Shift (Caesar), Vigenère, and Latham (custom) ciphers.
 */

/** Caesar shift decryption: shifts each letter back by `shift` positions. */
export function shiftDecrypt(text: string, shift: number): string {
    return text.split('').map(ch => {
        if (ch >= 'a' && ch <= 'z') {
            return String.fromCharCode(((ch.charCodeAt(0) - 97 - shift + 26) % 26) + 97);
        }
        if (ch >= 'A' && ch <= 'Z') {
            return String.fromCharCode(((ch.charCodeAt(0) - 65 - shift + 26) % 26) + 65);
        }
        return ch;
    }).join('');
}

/** Caesar shift encryption: shifts each letter forward by `shift` positions. */
export function shiftEncrypt(text: string, shift: number): string {
    return text.split('').map(ch => {
        if (ch >= 'a' && ch <= 'z') {
            return String.fromCharCode(((ch.charCodeAt(0) - 97 + shift) % 26) + 97);
        }
        if (ch >= 'A' && ch <= 'Z') {
            return String.fromCharCode(((ch.charCodeAt(0) - 65 + shift) % 26) + 65);
        }
        return ch;
    }).join('');
}

/** Vigenère cipher decryption using a keyword. */
export function vigenereDecrypt(text: string, keyword: string): string {
    const key = keyword.toUpperCase();
    let keyIdx = 0;
    return text.split('').map(ch => {
        if (ch >= 'a' && ch <= 'z') {
            const shift = key.charCodeAt(keyIdx % key.length) - 65;
            keyIdx++;
            return String.fromCharCode(((ch.charCodeAt(0) - 97 - shift + 26) % 26) + 97);
        }
        if (ch >= 'A' && ch <= 'Z') {
            const shift = key.charCodeAt(keyIdx % key.length) - 65;
            keyIdx++;
            return String.fromCharCode(((ch.charCodeAt(0) - 65 - shift + 26) % 26) + 65);
        }
        return ch;
    }).join('');
}

/** Vigenère cipher encryption using a keyword. */
export function vigenereEncrypt(text: string, keyword: string): string {
    const key = keyword.toUpperCase();
    let keyIdx = 0;
    return text.split('').map(ch => {
        if (ch >= 'a' && ch <= 'z') {
            const shift = key.charCodeAt(keyIdx % key.length) - 65;
            keyIdx++;
            return String.fromCharCode(((ch.charCodeAt(0) - 97 + shift) % 26) + 97);
        }
        if (ch >= 'A' && ch <= 'Z') {
            const shift = key.charCodeAt(keyIdx % key.length) - 65;
            keyIdx++;
            return String.fromCharCode(((ch.charCodeAt(0) - 65 + shift) % 26) + 65);
        }
        return ch;
    }).join('');
}

/**
 * Latham cipher decryption: a proprietary cipher.
 * Algorithm: reverse the text, then apply a Caesar shift.
 * The key is a number (shift value).
 */
export function lathamDecrypt(text: string, key: number): string {
    const reversed = text.split('').reverse().join('');
    return shiftDecrypt(reversed, key);
}

/** Latham cipher encryption: apply Caesar shift, then reverse. */
export function lathamEncrypt(text: string, key: number): string {
    const shifted = shiftEncrypt(text, key);
    return shifted.split('').reverse().join('');
}
