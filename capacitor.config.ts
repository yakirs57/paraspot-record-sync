
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.paraspot.ai',
  appName: 'Paraspot AI',
  webDir: 'dist',
  server: {
    url: 'https://www.paraspot.ai',
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
