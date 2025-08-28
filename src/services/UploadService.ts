import { UploadJob, UploadInitResponse, UploadCompleteRequest } from '../types';
import { storageService } from './StorageService';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Utility functions from your original code
const getFileExtFromBlobType = (blobType: string): string => {
  if (blobType.includes("video/webm")) return ".webm";
  if (blobType.includes("video/mp4")) return ".mp4";
  if (blobType.includes("video/x-matroska")) return ".mkv";
  return "." + blobType.split("video/")[1].split(";")[0];
};

const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const postReqOptBuilder = (data: any, isForm = false, headers = {}): RequestInit => {
  return {
    method: 'POST',
    headers: {
      'Content-Type': isForm ? 'multipart/form-data' : 'application/json',
      ...headers
    },
    body: isForm ? data : JSON.stringify(data),
    credentials: 'include'
  };
};

class UploadService {
  private readonly API_BASE_URL = 'https://www.paraspot.ai/api';
  private readonly CHUNK_SIZE = parseInt(import.meta.env.VITE_CHUNK_SIZE_BYTES || '5242880'); // 5MB default
  private readonly UPLOAD_CONCURRENCY = parseInt(import.meta.env.VITE_UPLOAD_CONCURRENCY || '3');

  private activeUploads = new Map<string, AbortController>();

  async fetchPresignedUrls(inspectionId: string, filename: string, totalParts: number, fileType: string, retryCount = 0): Promise<{ presigned_urls: string[] } | null> {
    const data = {
      total_parts: totalParts,
      id: inspectionId,
      filename: filename,
      filetype: fileType,
    };

    const onFail = (): Promise<{ presigned_urls: string[] } | null> => {
      return new Promise((resolve) => {
        setTimeout(async () => {
          const result = await this.fetchPresignedUrls(inspectionId, filename, totalParts, fileType, retryCount + 1);
          resolve(result);
        }, 5000 + (retryCount * 2000));
      });
    };

    try {
      const resp = await fetch(`${this.API_BASE_URL}/media/generate_presigned_url`, postReqOptBuilder(data));
      const jsonResponse = await resp.json();
      console.log("Presigned URL response:", jsonResponse);
      
      if (jsonResponse.status === 200) {
        return {
          presigned_urls: jsonResponse.result.presign_urls,
        };
      } else {
        console.log("Failed generating presigned url");
        if (retryCount < 5) {
          return await onFail();
        }
        return null;
      }
    } catch (error) {
      console.error("An error occurred:", error);
      if (retryCount < 5) {
        return await onFail();
      }
      return null;
    }
  }

  async uploadFileChunk(presignedUrl: string, blob: Blob, retryCount = 0): Promise<boolean> {
    if (retryCount > 0 && retryCount < 5) {
      console.log("Checking network connection");
      try {
        const testResp = await fetch(this.API_BASE_URL, { credentials: "include" });
        if (!testResp.ok) {
          await delay(1000 + (retryCount * 1000));
          return await this.uploadFileChunk(presignedUrl, blob, retryCount + 1);
        }
      } catch {
        await delay(1000 + (retryCount * 1000));
        return await this.uploadFileChunk(presignedUrl, blob, retryCount + 1);
      }
    } else if (retryCount === 5) {
      console.log("Failed to upload chunk after 5 retries");
      return false;
    }

    try {
      const response = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: blob,
      });

      if (response.ok) {
        return true;
      } else {
        await delay(1000 + (retryCount * 1000));
        return await this.uploadFileChunk(presignedUrl, blob, retryCount + 1);
      }
    } catch (error) {
      console.error("Chunk upload failed:", error);
      await delay(1000 + (retryCount * 1000));
      return await this.uploadFileChunk(presignedUrl, blob, retryCount + 1);
    }
  }

  async finalizeUpload(inspectionId: string, fileName: string, totalChunks: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/media/upload_video`, postReqOptBuilder({
        expectedSize: totalChunks,
        id: inspectionId,
        filename: fileName
      }));
      
      const jsonResponse = await response.json();
      
      if (jsonResponse.status === 200) {
        // Send scan started notification
        try {
          await fetch(`${this.API_BASE_URL}/scan/scanStarted`, postReqOptBuilder(
            inspectionId.includes('_') 
              ? { pid: inspectionId.split("_")[2], scanType: 'checkout' }
              : { pid: inspectionId, scanType: 'baseline' }
          ));
        } catch (error) {
          console.error("Failed to send scanStarted notification:", error);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Failed to finalize upload:", error);
      return false;
    }
  }

  async startUpload(jobId: string): Promise<void> {
    const job = storageService.getUploadQueue().find(j => j.id === jobId);
    if (!job) throw new Error('Job not found');

    try {
      storageService.updateUploadJob(jobId, { status: 'uploading', progress: 0 });
      
      // Get recorded blobs from storage (this would be from your video recording)
      const recordedBlobs = await this.getRecordedBlobs(job.fileUri);
      const totalChunks = recordedBlobs.length;
      
      if (totalChunks === 0) {
        throw new Error('No video data found');
      }

      // Get presigned URLs
      const urlResponse = await this.fetchPresignedUrls(
        job.inspectionId, 
        job.fileName, 
        totalChunks, 
        'video/mp4'
      );

      if (!urlResponse) {
        throw new Error('Failed to get presigned URLs');
      }

      // Upload chunks with batch processing
      const success = await this.uploadChunksWithBatching(
        jobId,
        recordedBlobs,
        urlResponse.presigned_urls,
        totalChunks
      );

      if (success) {
        // Finalize upload
        const finalized = await this.finalizeUpload(job.inspectionId, job.fileName, totalChunks);
        
        if (finalized) {
          storageService.updateUploadJob(jobId, { status: 'completed', progress: 100 });
        } else {
          throw new Error('Failed to finalize upload');
        }
      } else {
        throw new Error('Failed to upload chunks');
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
      storageService.updateUploadJob(jobId, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async uploadChunksWithBatching(
    jobId: string, 
    recordedBlobs: Blob[], 
    presignedUrls: string[], 
    totalChunks: number
  ): Promise<boolean> {
    const BATCH_SIZE = 4;
    const results: boolean[] = [];
    let failsCount = 0;
    let lastTimeOnline = new Date();

    while (results.length < totalChunks) {
      if (navigator.onLine) {
        lastTimeOnline = new Date();
        
        const batch: Array<{ presignedUrl: string; blob: Blob }> = [];
        
        for (let i = 0; i < BATCH_SIZE && results.length + i < totalChunks; i++) {
          const chunkIndex = results.length + i;
          batch.push({
            presignedUrl: presignedUrls[chunkIndex],
            blob: recordedBlobs[chunkIndex]
          });
        }

        const batchResults = await Promise.all(
          batch.map(({ presignedUrl, blob }) => this.uploadFileChunk(presignedUrl, blob))
        );

        const successfulResults = batchResults.filter(r => r === true);
        results.push(...successfulResults);
        failsCount += batchResults.filter(r => r === false).length;

        // Update progress
        const progress = Math.floor((results.length / totalChunks) * 100);
        storageService.updateUploadJob(jobId, { progress });

        if (failsCount > 10) {
          console.error("Too many failed chunks - stopping upload");
          return false;
        }
      } else {
        // Handle offline scenario
        if (new Date().getTime() - lastTimeOnline.getTime() >= 120000) { // 2 minutes
          console.error("Network offline for too long - stopping upload");
          return false;
        } else {
          console.log("Network offline - waiting for connection...");
          await delay(5000);
        }
      }
    }

    return results.length === totalChunks;
  }

  private async getRecordedBlobs(fileUri: string): Promise<Blob[]> {
    try {
      // Read the video file from filesystem
      const result = await Filesystem.readFile({
        path: fileUri,
        directory: Directory.Data
      });
      
      // Convert base64 to blob
      const base64Data = result.data as string;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const fullBlob = new Blob([byteArray], { type: 'video/mp4' });
      
      // Chunk the blob into optimal sizes for concurrent upload
      const chunks: Blob[] = [];
      const chunkSize = this.CHUNK_SIZE;
      let offset = 0;
      
      while (offset < fullBlob.size) {
        const chunk = fullBlob.slice(offset, offset + chunkSize);
        chunks.push(chunk);
        offset += chunkSize;
      }
      
      return chunks;
    } catch (error) {
      console.error('Failed to read video file:', error);
      throw new Error('Failed to read video file from storage');
    }
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