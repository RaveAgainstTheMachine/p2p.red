export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    category: 'Added' | 'Improved' | 'Fixed' | 'Security';
    description: string;
  }[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '1.3.17',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'Redesigned the version badge into an interactive, expanding pill.' },
      { category: 'Improved', description: 'Simplified footer by hiding deployment color and timestamp until hover.' }
    ]
  },
  {
    version: '1.3.16',
    date: '2026-04-20',
    changes: [
      { category: 'Added', description: 'Added interactive Change Log page accessible via the version badge.' },
      { category: 'Improved', description: 'Formalized the release process to include mandatory changelog updates.' },
      { category: 'Improved', description: 'Applied "Liquid Glass" styling to all secondary system pages (Info, Legal, Changelog).' }
    ]
  },
  {
    version: '1.3.15',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'Implemented premium "Liquid Glass" aesthetic across the entire UI.' },
      { category: 'Improved', description: 'Updated color palette to vibrant Indigo-to-Purple gradients for better contrast and feel.' },
      { category: 'Improved', description: 'Enhanced corner rounding with squircle-inspired 40px radii for a more fluid look.' }
    ]
  },
  {
    version: '1.3.14',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'Integrated bot challenge status messages directly into the main UI container.' },
      { category: 'Added', description: 'Added 10+ new quirky success and status messages (Security Moose approved).' },
      { category: 'Improved', description: 'Removed distracting bottom-toast notifications for a cleaner experience.' }
    ]
  },
  {
    version: '1.3.13',
    date: '2026-04-18',
    changes: [
      { category: 'Fixed', description: 'Resolved an issue where bot challenges could block short-link generation.' },
      { category: 'Improved', description: 'Optimized challenge execution to bypass browser-level throttling.' }
    ]
  },
  {
    version: '1.3.12',
    date: '2026-04-15',
    changes: [
      { category: 'Improved', description: 'Hardened production deployment workflow with automated environment health checks.' },
      { category: 'Fixed', description: 'Resolved transient network timeout issues during container initialization.' }
    ]
  }
];
