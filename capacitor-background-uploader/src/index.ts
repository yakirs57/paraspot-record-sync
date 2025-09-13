import { registerPlugin } from '@capacitor/core';
import type { BackgroundUploaderPlugin } from './definitions';

export const BackgroundUploader = registerPlugin<BackgroundUploaderPlugin>('BackgroundUploader');

export * from './definitions';
