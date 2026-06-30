export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '1.6.15',
    date: '2026-06-29',
    changes: [
      'Implemented security hardening across metadata-api services and cryptographic salt generation.',
    ],
  },
  {
    version: '1.6.14',
    date: '2026-06-29',
    changes: [
      'Corrected and simplified data integrity copy in Info page.',
    ],
  },
  {
    version: '1.6.13',
    date: '2026-06-29',
    changes: [
      'Changed theme/color palette menu trigger from hover to click/touch.',
    ],
  },
];
