export interface InspectionRecord {
  id: string;
  scan_id: string;
  type: string;
  cbeName: string;
  pid: string;
  clientLogoURL: string;
  clientName: string;
  unitAddress: string;
  lastUsedAt: number;
}

export interface UploadJob {
  id: string;
  inspectionId: string;
  inspectionRecord: InspectionRecord;
  fileUri: string;
  fileName: string;
  size: number;
  createdAt: number;
  status: 'pending' | 'uploading' | 'paused' | 'failed' | 'completed';
  progress: number;
  uploadId?: string;
  partSize?: number;
  nextPart?: number;
  parts?: Array<{
    part: number;
    etag?: string;
    sent: boolean;
  }>;
  error?: string;
  notificationId?: number;
}

export interface CameraSettings {
  resolution: '720p' | '1080p' | '4K';
  frameRate: 30 | 60;
  camera: 'front' | 'back';
  flash: 'on' | 'off' | 'auto';
}

export interface UploadInitResponse {
  upload_id: string;
  part_size: number;
  urls: Array<{
    part: number;
    url: string;
  }>;
}

export interface UploadCompleteRequest {
  upload_id: string;
  parts: Array<{
    part: number;
    etag: string;
  }>;
}
