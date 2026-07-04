// Hero section content and configuration
export const heroContent = {
  title: "Monaliens.",
  subtitle: "A whole new EXPERIENCE of NFT",
  
  // Marketplace links
  marketplaceLinks: [
    {
      id: 'opensea',
      href: "https://opensea.io/collection/monaliens-952480516",
      label: "Buy now on\nOpenSea",
      logo: '/assets/images/opensea.png',
      alt: "OpenSea"
    }
  ],

  // Social media links
  socialLinks: [
    {
      id: 'x',
      type: 'social',
      href: "https://x.com/monaliens",
      icon: "X",
      alt: "X"
    },
    {
      id: 'discord',
      type: 'social',
      href: "https://discord.gg/monaliens",
      icon: "Discord",
      alt: "Discord"
    }
  ]
};

// Color constants
export const COLORS = {
  creatusOrange: "#FF6B6B",
  creatusRed: "#ff4d4d", 
  creatusPurple: "#6930c3"
};

// Animation timing constants
export const ANIMATION_TIMING = {
  typing: {
    titleSpeed: 75,    // ms per character
    subtitleSpeed: 75, // ms per character
    titleDelay: 150    // delay between title and subtitle
  },
  glitch: {
    interval: 100,     // glitch change interval
    duration: 1000,    // total glitch duration
    minDelay: 1000,    // minimum delay between glitches
    maxDelay: 5000     // maximum delay between glitches
  },
  marketplaceDelay: 6000 // delay before showing marketplace buttons
};

// Glitch characters for random generation
export const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*<>/\\|';

// Text highlighting configuration
export const TEXT_HIGHLIGHT = {
  keyword: "EXPERIENCE",
  specialWords: ["EXPERIENCE"]
}; 