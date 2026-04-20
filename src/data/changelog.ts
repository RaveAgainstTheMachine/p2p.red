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
    version: '1.4.0',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'Gave the changelog a personality transplant. Less corporate jargon, more moose energy.' },
      { category: 'Added', description: 'New Feedback form! Tell us what you think (or just say hi, bud).' },
      { category: 'Improved', description: 'Cleaned up the top navigation for a more focused "drop and go" experience.' },
      { category: 'Improved', description: 'Footer refinements: "Info" is now "About", and Support is a shiny new coffee badge.' },
      { category: 'Improved', description: 'Repositioned the Canadian flag and updated the footer branding for Stevem Frost.' },
      { category: 'Added', description: 'Interactive "Anubis" anti-bot challenges that actually look good.' }
    ]
  },
  {
    version: '1.3.19',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'Fixed the bot challenge UI. It was looking a bit too "Default Green". Now it glows with Indigo pride.' },
      { category: 'Improved', description: 'Legal pages now look like they actually belong to this site. Homogeneity, eh?' }
    ]
  },
  {
    version: '1.3.18',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'That version number at the bottom? It expands now! Hover over it if you want the technical details.' }
    ]
  },
  {
    version: '1.3.16',
    date: '2026-04-20',
    changes: [
      { category: 'Added', description: 'This very "Evolution" page! Watch the site grow in real-time.' },
      { category: 'Improved', description: 'Liquid Glass everywhere. High blurs, squircle corners, and premium vibes.' }
    ]
  },
  {
    version: '1.3.15',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'Aesthetic overhaul. We went full Apple-style Liquid Glass. It is quite shiny now.' }
    ]
  },
  {
    version: '1.3.14',
    date: '2026-04-19',
    changes: [
      { category: 'Improved', description: 'Status messages are now front and center. No more squinting at toasts.' },
      { category: 'Added', description: 'Security Moose joined the team. He approves your links and deters the robots.' }
    ]
  },
  {
    version: '1.3.5',
    date: '2026-04-19',
    changes: [
      { category: 'Fixed', description: 'Killed a nasty bug where the tunnel would hang. Folders should fly now.' }
    ]
  },
  {
    version: '1.3.3',
    date: '2026-04-19',
    changes: [
      { category: 'Added', description: 'Generative art backgrounds. Why have a static site when it can be alive?' }
    ]
  },
  {
    version: '1.3.1',
    date: '2026-04-18',
    changes: [
      { category: 'Improved', description: 'Selective animation. We turn the fancy stuff down during big transfers so your CPU can breathe.' }
    ]
  }
];
