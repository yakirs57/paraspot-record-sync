
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.lovable.paraspot',
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
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav",
    }
  }
};

export default config;
