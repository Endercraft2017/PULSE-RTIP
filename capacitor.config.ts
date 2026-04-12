import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mdrrmo.pulse911',
  appName: 'PULSE 911',
  webDir: 'src/frontend',
  server: {
    allowNavigation: ['pulse.afkcube.com'],
  },
};

export default config;
