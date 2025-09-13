import { registerPlugin } from '@capacitor/core';

import type { StartParams, StartResult, ProgressEvent, CompletedEvent, ErrorEvent, MultipartParams } from './definitions';

export interface BackgroundUploaderPlugin {
  startUpload(opts: StartParams): Promise<StartResult>;
  startMultipartFromFile(opts: MultipartParams): Promise<StartResult>;
  cancel(opts: { uploadId: string }): Promise<void>;
  addListener(eventName: 'progress',  cb: (e: ProgressEvent)  => void): Promise<{ remove: () => void }>;
  addListener(eventName: 'completed', cb: (e: CompletedEvent) => void): Promise<{ remove: () => void }>;
  addListener(eventName: 'error',     cb: (e: ErrorEvent)     => void): Promise<{ remove: () => void }>;
}

export const BackgroundUploader = registerPlugin<BackgroundUploaderPlugin>('BackgroundUploader');

export * from './definitions';
