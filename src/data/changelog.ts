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
    version: '1.3.19',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'Overhauled bot-challenge (Anubis) UI to match Liquid Glass aesthetic.' },
      { category: 'Improved', description: 'Refactored Legal page for 100% design homogeneity across the site.' },
      { category: 'Improved', description: 'Deeply populated the Evolution page with historical version data.' }
    ]
  },
  {
    version: '1.3.18',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'Interactive expanding version pill added to the footer.' }
    ]
  },
  {
    version: '1.3.17',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'Simplified footer by hiding deployment metadata until hover.' }
    ]
  },
  {
    version: '1.3.16',
    date: '2026-04-20',
    changes: [
      { category: 'Added', description: 'Added interactive Change Log (Evolution) page.' },
      { category: 'Improved', description: 'Applied "Liquid Glass" styling to all system pages.' }
    ]
  },
  {
    version: '1.3.15',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'Implemented premium "Liquid Glass" aesthetic across the entire UI.' },
      { category: 'Improved', description: 'Enhanced corner rounding with squircle-inspired 40px radii.' }
    ]
  },
  {
    version: '1.3.14',
    date: '2026-04-19',
    changes: [
      { category: 'Improved', description: 'Integrated bot challenge status messages directly into the main UI container.' },
      { category: 'Added', description: 'Added 10+ new quirky success and status messages (Security Moose approved).' }
    ]
  },
  {
    version: '1.3.8',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'Reverted UI changes back to the signature purple palette for brand consistency.' }
    ]
  },
  {
    version: '1.3.7',
    date: '2026-04-19',
    changes: [
      { category: 'Improved', description: 'UI modernization: Night palette with ruby accents and refined typography.' }
    ]
  },
  {
    version: '1.3.5',
    date: '2026-04-19',
    changes: [
      { category: 'Fixed', description: 'Resolved "Preparing Tunnel" hang and optimized large folder processing.' }
    ]
  },
  {
    version: '1.3.3',
    date: '2026-04-19',
    changes: [
      { category: 'Added', description: 'Added generative art backgrounds to transfer screens for visual interest.' }
    ]
  },
  {
    version: '1.3.1',
    date: '2026-04-18',
    changes: [
      { category: 'Improved', description: 'Optimized performance by selectively disabling heavy background animations during active transfers.' }
    ]
  }
];
