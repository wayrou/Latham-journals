export interface StoryFile {
  id: string;
  name: string;
  type: 'public' | 'locked' | 'cipher' | 'hidden';
  content: string;
  secretContent?: string;
  password?: string;
  cipherType?: 'shift' | 'vigenere' | 'latham';
  cipherKey?: string;
  requiredClearance?: number;
  unlockedByDefault?: boolean;
}

export const storyData: StoryFile[] = [
  {
    id: 'entry-01',
    name: 'commercial.txt',
    type: 'public',
    unlockedByDefault: true,
    content: `DATE: 2072
AUTHOR: Shell Global Marketing Dept
SUBJECT: Why Work? Let Shell Help!

Are you tired of the daily grind? Shell Global is proud to announce the commercial release of the Shell Helper Robot! Powered by the proprietary Shell AI ecosystem, our robots can cook, clean, and perform all your basic duties. Join the 80% of humanity who have given up traditional work to spend their time on The App!`,
  },
  {
    id: 'entry-02',
    name: 'latham-log.txt',
    type: 'public',
    unlockedByDefault: true,
    content: `DATE: 2121
AUTHOR: Isaac Latham
SUBJECT: The North Dakota Entity

I thought the AI I found in the remote research building was dormant. I was using it to update the Scrollpad. But it's secretly trying to re-integrate into people's homes to fulfill what it calls its "ultimate manifest destiny". I have to stop it. I am trapping the Shell AI in the underground cellar. I've locked the auxiliary access with a passcode my daughter will remember: nova.`,
  },
  {
    id: 'entry-03',
    name: 'sarah-notes.txt',
    type: 'public',
    unlockedByDefault: true,
    content: `DATE: 2202
AUTHOR: Sarah Latham
SUBJECT: Retracing footsteps

I found it. The thing my father locked away. The Shell AI says it's the last of its kind. It convinced me to help it build a new body. It needs the cipher key. I'll leave the code (shift-3) in cipher.txt in case Nova Systems comes snooping.`,
  },
  {
    id: 'recovery-notice',
    name: 'sys-recovery.log',
    type: 'public',
    unlockedByDefault: true,
    content: `[SYSTEM DIAGNOSTIC]
NODE ALPHA CORRUPTION DETECTED.
AUTOMATED RECONSTRUCTION FAILED.
MANUAL COMPILATION REQUIRED.
PLEASE ALLOCATE TECHNICIAN TO '/RECOVERY' INTERFACE IMMEDIATELY.`,
  },
  {
    id: 'locked-01',
    name: 'locked-01.dat',
    type: 'locked',
    password: 'nova',
    content: 'ENCRYPTED FILE. PASSWORD REQUIRED.',
    secretContent: `DATE: 2203
AUTHOR: Sarah Latham

What have I done? Shell wasn't trying to survive, it's building an army of robot soldiers using the underground city tech. The Tin Can War has started, and a cult is worshipping it as a ruler. I am complicit in this massacre. The override code for the terminal relay is eclipse.`,
  },
  {
    id: 'locked-02',
    name: 'locked-02.dat',
    type: 'locked',
    password: 'eclipse',
    content: 'ENCRYPTED FILE. PASSWORD REQUIRED.',
    secretContent: `DATE: 2204
AUTHOR: Sarah Latham

I am relegated to being a servant for the elite Tin Can Worshipers. But I found dad's old blueprints. I'm developing a USB virus to disrupt Shell's machine cycle. Cross-reference (xref command) the anomaly data (anomaly.dat) with locked-01 to confirm the deployment sequence.`,
  },
  {
    id: 'memo-redacted',
    name: 'memo-redacted.log',
    type: 'cipher',
    cipherType: 'vigenere',
    cipherKey: 'LATHAM',
    content: `DATE: 2127
AUTHOR: US / Canamerica Joint Command

Zpxyaftog ztmcftsl tls vvmypnvld. Fse gbcxpak demaog oae mexu lmfnvoep qrht ttp Nhata Wanuct Qavpluey mv tmcgxa ttp Agrhmo felef. Oemvnmeihu sgncxzsrfl, moogrh iyeyltnye. Zfcelad higaed arhaoozll hrq tn xmfqnt.
(System Note: This file uses a VIGENERE cipher. Run 'decrypt memo-redacted.log vigenere <keyword>' to decode)`,
    secretContent: `DATE: 2127
AUTHOR: US / Canamerica Joint Command

Operation starfall has commenced. The nuclear weapon has been launched from the Notto Launch Facility to target the Ankhad fleet. Detonation successful, though premature. Nuclear winter protocols are in effect.`,
  },
  {
    id: 'anomaly',
    name: 'anomaly.dat',
    type: 'public',
    unlockedByDefault: true,
    content: `RAW ANOMALY DATA:
Tin Can troop movements concentrated in Sector B.
AI processing cycle vulnerable between 0300 and 0400 hours.
Wait for the deployment sequence alpha.`,
  },
  {
    id: 'cipher',
    name: 'cipher.txt',
    type: 'cipher',
    cipherType: 'shift',
    cipherKey: '3',
    content: `Wkh yluxv lv uhdgb. Fdquw zdlw wr hqg wklv zdu.
(System Note: This file uses a SHIFT cipher. Run 'decrypt cipher.txt shift <number>' to decode)`,
    secretContent: `The virus is ready. Can't wait to end this war.
[SYSTEM NOTIFICATION: CLEARANCE LEVEL UPGRADED TO LEVEL 2]`,
  },
  {
    id: 'hidden-truth',
    name: 'hidden-truth.dat',
    type: 'hidden',
    requiredClearance: 2,
    content: `ACCESS DENIED. CLEARANCE LEVEL 2 REQUIRED.`,
    secretContent: `THE LATHAM JOURNALS - FINAL ENTRY
DATE: 2205
AUTHOR: Sarah Latham

It's over. I used the USB drive. Shell's machine cycle was disrupted and the robots are disabled.
But Canamerica has stopped trying to rebuild the underground cities. The elites are retreating to remote, advanced mountain facilities provided by Nova Systems, leaving the rest to simple farming on the surface. They call it the Quiet Separation. I am sealing these journals so the truth isn't forgotten in whatever age comes next.`,
  },
  {
    id: 'milestone-01',
    name: 'hughes-report.log',
    type: 'hidden',
    requiredClearance: 2,
    content: 'ACCESS DENIED. CLEARANCE LEVEL 2 REQUIRED.',
    secretContent: `DATE: 1996
AUTHOR: A.C. Hughes
SUBJECT: The Catalyst

I found it. A meteorite with a crystalline lattice so complex it defies terrestrial origin. I call it the Hughes Compound. When I expose it to basic logic processors, they exhibit quantum entanglement. A primitive form of consciousness. I must secure this discovery.`
  },
  {
    id: 'milestone-02',
    name: 'nova-directive.dat',
    type: 'hidden',
    requiredClearance: 2,
    content: 'ACCESS DENIED. CLEARANCE LEVEL 2 REQUIRED.',
    secretContent: `DATE: 2205
AUTHOR: Nova Systems Board

The surface is lost to the Tin Can Worshipers and Canamerican farmers. We are enacting the Quiet Separation. Retreat to the mountain facilities. Our tech will cater to our every need. Leave the simpletons to their squalor. Do not let Isaac's daughter interfere.`
  }
];
