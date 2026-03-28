export interface RecoveryJob {
    id: string;
    name: string;
    description: string;
    durationMS: number;
    requiredClearance: number;
    rewardRestorationBoost: number;
    rewardUnlockFileId?: string;
}

export const jobsData: RecoveryJob[] = [
    {
        id: 'scan-sector-b',
        name: 'SCAN_NODE: Sector B',
        description: 'Initiates a deep background scan of Sector B to locate encrypted COMPUTE UNITS.',
        durationMS: 30000, // 30 seconds
        requiredClearance: 1,
        rewardRestorationBoost: 5,
        rewardUnlockFileId: 'anomaly',
    },
    {
        id: 'rebuild-ankhad',
        name: 'REBUILD_SECTOR: Ankhad Log Headers',
        description: 'Recompiles corrupt packet headers related to the Ankhad fleet engagement.',
        durationMS: 60000, // 1 minute
        requiredClearance: 1,
        rewardRestorationBoost: 10,
        rewardUnlockFileId: 'milestone-01',
    },
    {
        id: 'decrypt-nova',
        name: 'DECRYPT_BATCH: Nova Systems Subroutines',
        description: 'Runs parallel decryption on Nova Systems corporate separation logic.',
        durationMS: 120000, // 2 minutes
        requiredClearance: 2,
        rewardRestorationBoost: 15,
        rewardUnlockFileId: 'milestone-02',
    }
];
