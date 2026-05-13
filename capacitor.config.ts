import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mdrrmo.pulse911',
  appName: 'PULSE 911',
  webDir: 'src/frontend',
  loggingBehavior: 'debug',
  server: {
    allowNavigation: ['pulse.afkcube.com'],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
