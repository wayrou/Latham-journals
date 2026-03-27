export interface InboxMessage {
    id: string;
    sender: string;
    subject: string;
    date: string;
    content: string;
    unlockCondition: { type: 'default' } | { type: 'restoration', threshold: number };
}

export const inboxData: InboxMessage[] = [
    {
        id: 'msg-01',
        sender: 'Alan [Peregrine Archival Dept]',
        subject: 'Welcome to the Latham Project',
        date: '3555-10-14 09:00',
        content: `Alright, we’ve granted you access to all the Latham stuff. Your terminal will now have access to all the surviving available remnants of what we’re calling “Project Solaris”- it was all recovered from Separation-era junk. 

Most of the records are fragmented, redacted or encrypted with some kind of proprietary cipher. What we’re asking you to do is put a full timeline together and try to decrypt everything you can.

Thanks!
-Alan`,
        unlockCondition: { type: 'default' },
    },
    {
        id: 'msg-02',
        sender: 'IT-Automated',
        subject: 'NOTICE: Background Jobs Active',
        date: '3555-10-15 11:22',
        content: `User, we see you've initiated some background recovery sweeps over the network. Please note that restoring deep-crust fragments requires significant processing power. 

Monitor your jobs via the 'jobs' terminal command. Let Alan know if the mainframe starts throwing errors about corrupted 'Node Alpha' compilations again.`,
        unlockCondition: { type: 'restoration', threshold: 5 },
    },
    {
        id: 'msg-03',
        sender: 'J. Haris [Information Security]',
        subject: 'WARNING: Unauthorized Clearance',
        date: '3555-10-16 02:14',
        content: `I'm seeing anomalous activity from your terminal session. It looks like you've accessed Level 2 restricted files regarding the "Nova Directive". 

I'm flagging this for review. Do not attempt to dig deeper into the "Quiet Separation". That data is strictly Need To Know for the board executives. Consider this a formal warning.`,
        unlockCondition: { type: 'restoration', threshold: 50 }, // By the time they hit 50 or solve the cipher they get this
    }
];
