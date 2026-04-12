import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mdrrmo.pulse911',
  appName: 'PULSE 911',
  webDir: 'src/frontend',
  server: {
    // Allow mixed content and cleartext for dev server
    cleartext: true,
    allowNavigation: ['76.13.215.54'],
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
