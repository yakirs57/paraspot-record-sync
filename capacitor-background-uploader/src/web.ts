import { WebPlugin } from '@capacitor/core';

import type { BackgroundUploaderPlugin } from './definitions';

export class BackgroundUploaderWeb extends WebPlugin implements BackgroundUploaderPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
}
