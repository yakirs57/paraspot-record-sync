import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { storageService } from './StorageService';
import { uploadService } from './UploadService';
import { UploadJob } from '../types';

// Background uploader types
interface StartParams {
  fileUrl?: string;             
  data?: string;                // base64 data as alternative to fileUrl
  uploadUrl: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  field?: string;              
}

interface StartResult { 
  uploadId: string;
}

type ProgressEvent  = { uploadId: string; progress: number };
type CompletedEvent = { uploadId: string; status?: number };
type ErrorEvent     = { uploadId: string; message: string };

interface BackgroundUploaderPlugin {
  startUpload(opts: StartParams): Promise<StartResult>;
  cancel(opts: { uploadId: string }): Promise<void>;
  addListener(eventName: 'progress',  cb: (e: ProgressEvent)  => void): Promise<{ remove: () => void }>;
  addListener(eventName: 'completed', cb: (e: CompletedEvent) => void): Promise<{ remove: () => void }>;
  addListener(eventName: 'error',     cb: (e: ErrorEvent)     => void): Promise<{ remove: () => void }>;
}

const BackgroundUploader = registerPlugin<BackgroundUploaderPlugin>('BackgroundUploader');

class BackgroundUploadService {
  private activeUploads = new Map<string, { uploadId: string; chunkIndex: number; totalChunks: number }>(); // jobId_chunkIndex -> uploadDetails
  private jobChunkProgress = new Map<string, number[]>(); // jobId -> chunk progress array
  private notificationId = 1000;

  async initialize() {
    try {
      // Request notification permissions
      await LocalNotifications.requestPermissions();
      
      // Set up background uploader listeners
      await this.setupBackgroundUploaderListeners();
      
      // Set up callback to trigger processing when new jobs are added
      storageService.setOnJobAddedCallback((job) => {
        this.processSingleJob(job);
      });
      
      // Start processing when app goes to background
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          // Process any pending jobs when app goes to background
          const pendingJobs = storageService.getUploadQueue().filter(job => job.status === 'pending');
          for (const job of pendingJobs) {
            this.processSingleJob(job);
          }
        }
      });
      
      // Start processing immediately if there are pending uploads
      const pendingJobs = storageService.getUploadQueue().filter(job => job.status === 'pending');
      for (const job of pendingJobs) {
        this.processSingleJob(job);
      }
    } catch (error) {
      console.error('Failed to initialize BackgroundUploadService:', error);
    }
  }

  private async setupBackgroundUploaderListeners() {
    // Listen for upload progress
    BackgroundUploader.addListener('progress', (event) => {
      const { jobId, chunkIndex } = this.findJobByUploadId(event.uploadId);
      if (jobId) {
        this.updateChunkProgress(jobId, chunkIndex, event.progress);
      }
    });

    // Listen for upload completion
    BackgroundUploader.addListener('completed', (event) => {
      const { jobId, chunkIndex, totalChunks } = this.findJobByUploadId(event.uploadId);
      console.log(`At BackgroundUploader.L.completed for job ${jobId}, chunk ${chunkIndex} of ${totalChunks}`);
      if (jobId) {
        this.handleChunkCompleted(jobId, chunkIndex, totalChunks, event.status || 200);
        this.activeUploads.delete(`${jobId}_I_${chunkIndex}`);
      }
    });

    // Listen for upload errors
    BackgroundUploader.addListener('error', (event) => {
      const { jobId, chunkIndex } = this.findJobByUploadId(event.uploadId);
      if (jobId) {
        console.error(`Chunk ${chunkIndex} failed for job ${jobId}:`, event.message);
        storageService.updateUploadJob(jobId, { 
          status: 'failed', 
          error: `Chunk ${chunkIndex} failed: ${event.message}`
        });
        this.showUploadNotification(jobId, 'failed', `Upload failed: ${event.message}`);
        this.activeUploads.delete(`${jobId}_I_${chunkIndex}`);
        this.jobChunkProgress.delete(jobId);
      }
    });
  }

  private findJobByUploadId(uploadId: string): { jobId: string; chunkIndex: number; totalChunks: number } {
    for (const [key, value] of this.activeUploads.entries()) {
      if (value.uploadId === uploadId) {
        console.log(`[findJobByUploadId] Key: ${key} | Value:`, JSON.stringify(value));
        const [jobId, chunkIndexStr] = key.split('_I_');
        return { 
          jobId, 
          ...value
        };
      }
    }
    return { jobId: '', chunkIndex: -1, totalChunks: 0 };
  }

  private updateChunkProgress(jobId: string, chunkIndex: number, progress: number) {
    if (!this.jobChunkProgress.has(jobId)) return;
    
    const chunkProgresses = this.jobChunkProgress.get(jobId)!;
    chunkProgresses[chunkIndex] = progress;
    
    // Calculate overall progress
    const totalProgress = Math.floor(chunkProgresses.reduce((sum, p) => sum + p, 0) / chunkProgresses.length);
    
    // Update job progress
    storageService.updateUploadJob(jobId, { progress: totalProgress });
    this.updateProgressNotification(jobId, totalProgress);
  }

  private async handleChunkCompleted(jobId: string, chunkIndex: number, totalChunks: number, status: number) {
    console.log(`[handleChunkCompleted] jobId: ${jobId}, status: ${status}, chunkIndex: ${chunkIndex}, totalChunks: ${totalChunks}`);
    if (status < 200 || status >= 300) {
      storageService.updateUploadJob(jobId, { 
        status: 'failed', 
        error: `Chunk ${chunkIndex} failed with HTTP ${status}`
      });
      this.showUploadNotification(jobId, 'failed', `Upload failed: HTTP ${status}`);
      return;
    }

    console.log(`[handleChunkCompleted/J-${jobId}] this.jobChunkProgress: ${JSON.stringify(this.jobChunkProgress)}`);

    // Mark chunk as completed
    if (this.jobChunkProgress.has(jobId)) {
      console.log(`[handleChunkCompleted/J-${jobId}] jobChunkProgress has jobId`);
      const chunkProgresses = this.jobChunkProgress.get(jobId)!;
      chunkProgresses[chunkIndex] = 100;
      
      // Check if all chunks are completed
      const allCompleted = chunkProgresses.every(p => p === 100);
      console.log(`[handleChunkCompleted/J-${jobId}] allCompleted: ${allCompleted}`);
      const overallProgress = Math.floor(chunkProgresses.reduce((sum, p) => sum + p, 0) / chunkProgresses.length);
      console.log(`[handleChunkCompleted/J-${jobId}] overallProgress: ${overallProgress}`);
      
      storageService.updateUploadJob(jobId, { progress: overallProgress });
      this.updateProgressNotification(jobId, overallProgress);
      
      if (allCompleted) {
        console.log(`[handleChunkCompleted/J-${jobId}] All chunks completed, finalizing upload`);
        // All chunks completed, finalize upload
        await this.finalizeJobUpload(jobId, totalChunks);
      }
    } else {
      console.log(`[HandleChunkCompleted/J-${jobId}] jobId not in jobChunkProgress`);
    }
  }

  private async finalizeJobUpload(jobId: string, totalChunks: number) {
    console.log(`At finalizeJobUpload for job ${jobId}, total chunks ${totalChunks}`);
    const job = storageService.getUploadQueue().find(j => j.id === jobId);
    if (!job) return;

    try {
      // Build proper inspection upload ID (same as UploadService)
      const inspectionUploadId = (
        job.audioSupport ? 
        `${job.inspectionRecord.scan_id}XXAUDIOXX_${job.inspectionRecord.type}_${job.inspectionRecord.pid}` : 
        `${job.inspectionRecord.scan_id}_${job.inspectionRecord.type}_${job.inspectionRecord.pid}`
      );
      
      const success = await uploadService.finalizeUpload(
        inspectionUploadId, 
        job.fileName, 
        totalChunks
      );
      
      if (success) {
        storageService.updateUploadJob(jobId, { status: 'completed', progress: 100 });
        this.showUploadNotification(jobId, 'completed', `Upload completed of ${job.inspectionRecord.type.replace(/_/g, ' ')} inspection at ${job.inspectionRecord.unitAddress}: ${job.fileName}`);
      } else {
        throw new Error('Failed to finalize upload');
      }
    } catch (error) {
      storageService.updateUploadJob(jobId, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Failed to finalize upload'
      });
      this.showUploadNotification(jobId, 'failed', `Upload failed: ${error instanceof Error ? error.message : 'Failed to finalize upload'}`);
    } finally {
      this.jobChunkProgress.delete(jobId);
    }
  }

  private async processSingleJob(job: UploadJob) {
    // Skip if job is already being processed or not pending
    if (job.status !== 'pending' || this.jobChunkProgress.has(job.id)) {
      return;
    }

    try {
      await this.processJob(job);
      console.log(`Finished processJob successfully for job ${job.id}`);
    } catch (error) {
      console.error('Failed to process job:', error);
      storageService.updateUploadJob(job.id, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.showUploadNotification(job.id, 'failed', `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processJob(job: UploadJob) {
    console.log(`Processing upload job: ${job.id}`);
    
    // Show upload starting notification
    await this.showUploadNotification(job.id, 'started', `Starting upload of ${(job?.inspectionRecord || {})?.unitAddress || job.fileName}`);
    
    // Update job status
    storageService.updateUploadJob(job.id, { status: 'uploading', progress: 0 });

    try {
      // Start chunked background upload
      await this.startChunkedBackgroundUpload(job);
    } catch (error) {
      throw error;
    }
  }

  private async startChunkedBackgroundUpload(job: UploadJob) {
    // Build proper inspection upload ID (same as UploadService)
    const inspectionUploadId = (
      job.audioSupport ? 
      `${job.inspectionRecord.scan_id}XXAUDIOXX_${job.inspectionRecord.type}_${job.inspectionRecord.pid}` : 
      `${job.inspectionRecord.scan_id}_${job.inspectionRecord.type}_${job.inspectionRecord.pid}`
    );
    
    // Get presigned URLs for chunks
    const chunks = await uploadService.getFileChunks(job.fileUri);
    const urlResponse = await uploadService.fetchPresignedUrls(
      inspectionUploadId, 
      job.fileName, 
      chunks.length, 
      'video/mp4'
    );

    if (!urlResponse) {
      throw new Error('Failed to get presigned URLs');
    }

    // Initialize chunk progress tracking
    this.jobChunkProgress.set(job.id, new Array(chunks.length).fill(0));

    // Start background uploads for each chunk
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Upload chunk ${i + 1} of ${chunks.length}`);
      const chunk = chunks[i];
      const presignedUrl = urlResponse.presigned_urls[i];
      
      // Convert chunk to base64 data
      const chunkData = await this.convertChunkToBase64(chunk);
      
      try {
        // Start background upload for this chunk
        const result = await BackgroundUploader.startUpload({
          data: chunkData,
          uploadUrl: presignedUrl,
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream'
          }
        });
        console.log("Finished API call for chunk upload");

        // Store the mapping of job+chunk to upload ID
        this.activeUploads.set(`${job.id}_I_${i}`, {
          uploadId: result.uploadId,
          chunkIndex: i,
          totalChunks: chunks.length
        });
      } catch (error) {
        console.error(`Failed to start background upload for chunk ${i}:`, error);
        throw error;
      }
    }
  }

  private async convertChunkToBase64(chunk: Blob): Promise<string> {
    try {
      // Use FileReader to convert blob to base64 efficiently
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix (e.g., "data:application/octet-stream;base64,")
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(chunk);
      });
    } catch (error) {
      console.error('Failed to convert chunk to base64:', error);
      throw new Error(`Failed to prepare chunk for upload: ${error}`);
    }
  }

  private async showUploadNotification(jobId: string, type: 'started' | 'completed' | 'failed', message: string) {
    const notificationId = this.notificationId++;
    
    let title = '';
    
    switch (type) {
      case 'started':
        title = 'Upload Started';
        break;
      case 'completed':
        title = 'Upload Complete';
        break;
      case 'failed':
        title = 'Upload Failed';
        break;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body: message,
          id: notificationId,
          ongoing: type === 'started',
          autoCancel: type !== 'started'
        }
      ]
    });

    // Store notification ID for updates
    if (type === 'started') {
      storageService.updateUploadJob(jobId, { 
        notificationId 
      });
    }
  }

  private async updateProgressNotification(jobId: string, progress: number) {
    const job = storageService.getUploadQueue().find(j => j.id === jobId);
    if (!job || !job.notificationId) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          title: 'Uploading...',
          body: `${job.fileName} - ${progress}% complete`,
          id: job.notificationId,
          ongoing: true,
          autoCancel: false
        }
      ]
    });
  }

  stopProcessing() {
    // Cancel all active uploads
    for (const [key, value] of this.activeUploads.entries()) {
      BackgroundUploader.cancel({ uploadId: value.uploadId });
    }
    
    this.activeUploads.clear();
    this.jobChunkProgress.clear();
  }
}

export const backgroundUploadService = new BackgroundUploadService();