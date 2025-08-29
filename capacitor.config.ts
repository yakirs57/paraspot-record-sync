import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.9961a020850f4c489072671abe7cc755',
  appName: 'Paraspot AI',
  webDir: 'dist',
  server: {
    url: 'https://9961a020-850f-4c48-9072-671abe7cc755.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'microphone'],
    },
    FileSystem: {
      permissions: ['storage'],
    }
  }
};

export default config;