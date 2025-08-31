
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { uploadService } from './UploadService';
import { storageService } from './StorageService';
import { UploadJob } from '../types';

class BackgroundUploadService {
  private intervalId?: NodeJS.Timeout;
  private isProcessing = false;
  private notificationId = 1000;

  async initialize() {
    // Request notification permissions
    await LocalNotifications.requestPermissions();
    
    // Start processing queue
    this.startProcessing();
    
    // Handle app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        // App went to background, continue processing
        this.startProcessing();
      }
    });
  }

  async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    // Process uploads immediately
    this.processUploadQueue();
    
    // Set up interval for continuous processing
    this.intervalId = setInterval(() => {
      this.processUploadQueue();
    }, 10000); // Check every 10 seconds
  }

  private async processUploadQueue() {
    while (this.isProcessing) {
      const queue = storageService.getUploadQueue();
      const pendingJobs = queue.filter(job => 
        job.status === 'pending' || job.status === 'paused'
      );

      if (pendingJobs.length === 0) {
        await this.delay(5000); // Wait 5 seconds before checking again
        continue;
      }

      // Process jobs one at a time to avoid overwhelming the device
      for (const job of pendingJobs) {
        if (!this.isProcessing) break;
        
        try {
          await this.processJob(job);
        } catch (error) {
          console.error('Failed to process job:', error);
          storageService.updateUploadJob(job.id, { 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      await this.delay(2000); // Brief pause between queue checks
    }
  }

  private async processJob(job: UploadJob) {
    console.log(`Processing upload job: ${job.id}`);
    
    // Show notification that upload started
    await this.showUploadNotification(job, 'starting');
    
    // Set up progress tracking
    const originalUpdateJob = storageService.updateUploadJob.bind(storageService);
    storageService.updateUploadJob = (jobId: string, updates: Partial<UploadJob>) => {
      originalUpdateJob(jobId, updates);
      
      // Update notification with progress
      if (jobId === job.id && updates.progress !== undefined) {
        this.updateProgressNotification(job, updates.progress);
      }
      
      // Handle completion
      if (jobId === job.id && updates.status === 'completed') {
        this.showUploadNotification({ ...job, ...updates }, 'completed');
      }
      
      // Handle failure
      if (jobId === job.id && updates.status === 'failed') {
        this.showUploadNotification({ ...job, ...updates }, 'failed');
      }
    };

    // Start the actual upload
    await uploadService.startUpload(job.id);
    
    // Restore original function
    storageService.updateUploadJob = originalUpdateJob;
  }

  private async showUploadNotification(job: UploadJob, type: 'starting' | 'completed' | 'failed') {
    const notificationId = this.notificationId++;
    
    let title = '';
    let body = '';
    
    switch (type) {
      case 'starting':
        title = 'Upload Started';
        body = `Uploading ${job.inspectionId}`;
        break;
      case 'completed':
        title = 'Upload Complete';
        body = `Successfully uploaded ${job.inspectionId}`;
        break;
      case 'failed':
        title = 'Upload Failed';
        body = `Failed to upload ${job.inspectionId}`;
        break;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: notificationId,
          ongoing: type === 'starting',
          autoCancel: type !== 'starting'
        }
      ]
    });

    // Store notification ID for updates
    if (type === 'starting') {
      storageService.updateUploadJob(job.id, { 
        notificationId 
      });
    }
  }

  private async updateProgressNotification(job: UploadJob, progress: number) {
    const notificationId = (job as any).notificationId;
    if (!notificationId) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          title: 'Uploading...',
          body: `${job.inspectionId} - ${progress}% complete`,
          id: notificationId,
          ongoing: true,
          autoCancel: false
        }
      ]
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stopProcessing() {
    this.isProcessing = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}

export const backgroundUploadService = new BackgroundUploadService();
