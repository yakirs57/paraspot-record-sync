export interface BackgroundUploaderPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}

export interface StartParams {
  fileUrl: string;             // e.g. file:///…  (Android can also be content:// if you adapt later)
  uploadUrl: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  field?: string;              // multipart field name (POST only), default 'file'
}

export interface StartResult { uploadId: string }
export type ProgressEvent  = { uploadId: string; progress: number }
export type CompletedEvent = { uploadId: string; status?: number }
export type ErrorEvent     = { uploadId: string; message: string }
