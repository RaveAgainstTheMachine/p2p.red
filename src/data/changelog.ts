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
    version: '1.5.6',
    date: '2026-04-22',
    changes: [
      { category: 'Added', description: 'Introduced the official Security Moose mascot as a high-fidelity footer sticker.' },
      { category: 'Improved', description: 'Stabilized signaling infrastructure with Vite proxy routing for seamless dev/prod parity.' },
      { category: 'Fixed', description: 'Resolved a race condition in the global file picker that caused selection failures.' },
      { category: 'Fixed', description: 'Corrected text visibility and contrast for all Light Mode elements.' },
      { category: 'Added', description: 'Comprehensive development stabilization documentation.' }
    ]
  },
  {
    version: '1.5.5',
    date: '2026-04-21',
    changes: [
      { category: 'Fixed', description: 'Restored the full-screen "click-to-pick" area for the DropZone.' }
    ]
  },
  {
    version: '1.5.4',
    date: '2026-04-21',
    changes: [
      { category: 'Improved', description: 'Re-imagined the default "System" theme as "Brighter Dark" with a custom Moon-Sun hybrid icon.' },
      { category: 'Improved', description: 'Reordered theme brightness options for a more logical Light -> Brighter Dark -> Dark progression.' },
      { category: 'Added', description: 'Brighter Dark is now the default theme for new visitors, providing perfect contrast without eye-strain.' },
      { category: 'Fixed', description: 'Corrected theme picker icon visibility and improved layout consistency across brightness modes.' }
    ]
  },
  {
    version: '1.5.3',
    date: '2026-04-21',
    changes: [
      { category: 'Added', description: 'New high-impact brand headline in the sticky header: "SEND FILES SECURELY AND PRIVATELY".' },
      { category: 'Improved', description: 'Main layout standardization for pixel-perfect centering and high-performance scroll transitions.' },
      { category: 'Improved', description: 'Security messaging updated to "YOUR FILES ARE ENCRYPTED IN YOUR BROWSER BEFORE SENDING" for technical clarity.' },
      { category: 'Improved', description: 'Header is now sticky with backdrop blur, keeping brand controls always accessible.' },
      { category: 'Fixed', description: 'Standardized theme-aware logo contrast for high visibility in both Light and Obsidian modes.' }
    ]
  },
  {
    version: '1.5.2',
    date: '2026-04-21',
    changes: [
      { category: 'Improved', description: 'Restored the full Liquid Glass aesthetic with improved stability.' },
      { category: 'Added', description: 'Dynamic color palettes are back! Customize your sharing experience with the new theme switcher.' },
      { category: 'Fixed', description: 'The drop icon now points down (Download) instead of up (Upload). Gravity exists again.' },
      { category: 'Improved', description: 'Production deployment configuration refactored for better secrets management.' }
    ]
  },
  {
    version: '1.4.0',
    date: '2026-04-20',
    changes: [
      { category: 'Improved', description: 'Gave the changelog a personality transplant. Less corporate jargon, more moose energy.' },
      { category: 'Added', description: 'New Feedback form! Tell us what you think (or just say hi, bud).' },
      { category: 'Improved', description: 'Cleaned up the top navigation for a more focused "drop and go" experience.' },
      { category: 'Improved', description: 'Footer refinements: "Info" is now "About", and Support is a shiny new coffee badge.' },
      { category: 'Improved', description: 'Repositioned the Canadian flag and updated the footer branding for Steven Frost.' },
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
