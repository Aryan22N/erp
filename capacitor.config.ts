import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mechworks.app',
  appName: 'MECHWORKS',
  webDir: 'public',
  "server": {
    "url": "https://erp-black-beta.vercel.app",
    "cleartext": true
  }
};

export default config;
