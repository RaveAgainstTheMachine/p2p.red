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
    version: '1.0.0',
    date: '2026-05-11',
    changes: [
      { category: 'Added', description: 'Initial public open-source release.' },
      { category: 'Added', description: 'High-performance WebRTC DataChannel engine with AES-GCM encryption.' },
      { category: 'Added', description: 'Zero-knowledge metadata API with Redis caching.' },
      { category: 'Added', description: 'Streaming direct-to-disk support for unlimited file sizes.' },
      { category: 'Improved', description: 'Sanitized documentation and infrastructure templates for self-hosting.' },
    ],
  }
];
