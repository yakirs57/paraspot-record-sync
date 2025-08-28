import { UploadJob, UploadInitResponse, UploadCompleteRequest } from '../types';
import { storageService } from './StorageService';

class UploadService {
  private readonly API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.paraspot.ai';
  private readonly CHUNK_SIZE = parseInt(import.meta.env.VITE_CHUNK_SIZE_BYTES || '5242880'); // 5MB default
  private readonly UPLOAD_CONCURRENCY = parseInt(import.meta.env.VITE_UPLOAD_CONCURRENCY || '3');

  private activeUploads = new Map<string, AbortController>();

  async initUpload(inspectionId: string, filename: string, filesize: number): Promise<UploadInitResponse> {
    const response = await fetch(`${this.API_BASE_URL}/api/inspections/${inspectionId}/uploads/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename,
        filesize,
        mime: 'video/mp4'
      })
    });

    if (!response.ok) {
      throw new Error(`Upload init failed: ${response.status}`);
    }

    return response.json();
  }

  async uploadPart(url: string, data: ArrayBuffer): Promise<string> {
    const response = await fetch(url, {
      method: 'PUT',
      body: data,
      headers: {
        'Content-Type': 'application/octet-stream',
      }
    });

    if (!response.ok) {
      throw new Error(`Part upload failed: ${response.status}`);
    }

    return response.headers.get('etag') || '';
  }

  async completeUpload(inspectionId: string, request: UploadCompleteRequest): Promise<void> {
    const response = await fetch(`${this.API_BASE_URL}/api/inspections/${inspectionId}/uploads/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Upload complete failed: ${response.status}`);
    }
  }

  async startUpload(jobId: string): Promise<void> {
    const job = storageService.getUploadQueue().find(j => j.id === jobId);
    if (!job) throw new Error('Job not found');

    try {
      storageService.updateUploadJob(jobId, { status: 'uploading', progress: 0 });

      // For web demo, we'll simulate the upload process
      // In a real implementation with Capacitor, you'd read the file using Filesystem API
      await this.simulateUpload(jobId);
      
    } catch (error) {
      console.error('Upload failed:', error);
      storageService.updateUploadJob(jobId, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async simulateUpload(jobId: string): Promise<void> {
    // Simulate progress for demo purposes
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 300));
      storageService.updateUploadJob(jobId, { progress });
    }
    
    storageService.updateUploadJob(jobId, { status: 'completed', progress: 100 });
  }

  pauseUpload(jobId: string): void {
    const controller = this.activeUploads.get(jobId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(jobId);
    }
    storageService.updateUploadJob(jobId, { status: 'paused' });
  }

  resumeUpload(jobId: string): void {
    this.startUpload(jobId);
  }

  cancelUpload(jobId: string): void {
    const controller = this.activeUploads.get(jobId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(jobId);
    }
    storageService.removeUploadJob(jobId);
  }
}

export const uploadService = new UploadService();