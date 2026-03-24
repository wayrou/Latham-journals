export interface StoryFile {
  id: string;
  name: string;
  type: 'public' | 'locked' | 'redacted' | 'cipher' | 'hidden';
  content: string; // The text to read (or ciphertext, or redacted version)
  secretContent?: string; // The unlocked/reconstructed/decrypted version
  password?: string;
  missingTerms?: string[];
  cipherKey?: string;
  requiredClearance?: number;
  unlockedByDefault?: boolean;
}

export const storyData: StoryFile[] = [
  {
    id: 'entry-01',
    name: 'entry-01.txt',
    type: 'public',
    unlockedByDefault: true,
    content: `DATE: 2094-03-12
AUTHOR: Isaac Latham
SUBJECT: Routine System Audit

The new security mandates are a nightmare. They've updated the encryption on the legacy drives. If the system locks me out of the auxiliary files again, the passcode is just my mother's maiden name: latham. Keep this off the official logs.`,
  },
  {
    id: 'entry-02',
    name: 'entry-02.txt',
    type: 'public',
    unlockedByDefault: true,
    content: `DATE: 2094-03-15
AUTHOR: Isaac Latham
SUBJECT: Incident Report 88-A

They took Jenkins yesterday. The official report says he was reassigned to the orbital station, but I saw the terminal logs. Project Solaris is bleeding. If a reactor breach happens, we reach critical. We need to be prepared for total evacuation.`,
  },
  {
    id: 'entry-03',
    name: 'entry-03.txt',
    type: 'public',
    unlockedByDefault: true,
    content: `DATE: 2094-03-18
AUTHOR: Isaac Latham
SUBJECT: Final preparations

I am leaving the cipher file intact for the next shift. The encryption is standard shift-3, just like the old days. Use the decrypt command with the correct shift value if you need to read it.`,
  },
  {
    id: 'locked-01',
    name: 'locked-01.dat',
    type: 'locked',
    password: 'latham',
    content: 'ENCRYPTED FILE. PASSWORD REQUIRED.',
    secretContent: `Project Solaris status: FAILED. 
Containment breached in Sector 4. The Director's override code for the auxiliary relay is eclipse. Use this if the main terminal goes dark.`,
  },
  {
    id: 'locked-02',
    name: 'locked-02.dat',
    type: 'locked',
    password: 'eclipse',
    content: 'ENCRYPTED FILE. PASSWORD REQUIRED.',
    secretContent: `Aux relay activated. 
I've managed to hide the truth in the archival system. You'll need to cross-reference (xref command) the main anomaly log (anomaly.dat) with the locked-01 file to see the connections.`,
  },
  {
    id: 'memo-redacted',
    name: 'memo-redacted.log',
    type: 'redacted',
    missingTerms: ['breach', 'critical'],
    content: `The [REDACTED] has entered the [REDACTED] phase. All personnel must evacuate immediately.`,
    secretContent: `The breach has entered the critical phase. All personnel must evacuate immediately.`,
  },
  {
    id: 'anomaly',
    name: 'anomaly.dat',
    type: 'public',
    unlockedByDefault: true,
    content: `RAW ANOMALY DATA:
Sector 4 energy spike detected.
Vibration frequency mismatch.
Temporal distortion ratio: 1.0442`,
  },
  {
    id: 'cipher',
    name: 'cipher.txt',
    type: 'cipher',
    cipherKey: '3',
    content: `Wkh vhfuhw lv exulhg xqghu wkh whuplqdo. Dffhvv judqwhg.
(System Note: Run 'decrypt cipher.txt <shift_number>' to decode)`,
    secretContent: `The secret is buried under the terminal. Access granted.
[SYSTEM NOTIFICATION: CLEARANCE LEVEL UPGRADED TO LEVEL 2]`,
  },
  {
    id: 'hidden-truth',
    name: 'hidden-truth.dat',
    type: 'hidden',
    requiredClearance: 2,
    content: `ACCESS DENIED. CLEARANCE LEVEL 2 REQUIRED.`,
    secretContent: `THE LATHAM JOURNALS - FINAL ENTRY
AUTHOR: Isaac Latham

If you are reading this, Project Solaris wasn't a reactor. It was a localized chronological inversion field. We didn't build a bomb; we built a bridge. And something came across it. I am destroying the terminal to seal the bridge. 
God help us.`,
  }
];
