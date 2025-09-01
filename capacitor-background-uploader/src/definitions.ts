export interface BackgroundUploaderPlugin {
  startUpload(opts: StartParams): Promise<StartResult>;
  startMultipartFromFile(opts: MultipartParams): Promise<StartResult>;
  cancel(opts: { uploadId: string }): Promise<void>;
  addListener(eventName: 'progress',  cb: (e: ProgressEvent)  => void): Promise<{ remove: () => void }>;
  addListener(eventName: 'completed', cb: (e: CompletedEvent) => void): Promise<{ remove: () => void }>;
  addListener(eventName: 'error',     cb: (e: ErrorEvent)     => void): Promise<{ remove: () => void }>;
}

export interface StartParams {
  fileUrl: string;             // e.g. file:///…  (Android can also be content:// if you adapt later)
  uploadUrl: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  field?: string;              // multipart field name (POST only), default 'file'
}

export interface MultipartParams {
  fileUrl: string;
  parts: Array<{ uploadUrl: string; size: number }>;
  notificationTitle?: string;
}

export interface StartResult { uploadId: string }
export type ProgressEvent  = { uploadId: string; progress: number }
export type CompletedEvent = { uploadId: string; status?: number }
export type ErrorEvent     = { uploadId: string; message: string }
