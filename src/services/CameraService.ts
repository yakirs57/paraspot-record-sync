import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { storageService } from './StorageService';
import { UploadJob } from '../types';

class CameraService {
  private isRecording = false;
  private videoStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  async checkPermissions(): Promise<{ hasPermission: boolean; hasBackCamera: boolean }> {
    try {
      // Check if we can access camera and specifically back camera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      });
      stream.getTracks().forEach(track => track.stop());
      return { hasPermission: true, hasBackCamera: true };
    } catch (error: any) {
      // Check if it's a permission error or no back camera
      if (error.name === 'NotAllowedError') {
        return { hasPermission: false, hasBackCamera: true };
      }
      if (error.name === 'OverconstrainedError' || error.name === 'NotFoundError') {
        return { hasPermission: true, hasBackCamera: false };
      }
      return { hasPermission: false, hasBackCamera: false };
    }
  }

  async requestPermissions(): Promise<{ hasPermission: boolean; hasBackCamera: boolean }> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      });
      stream.getTracks().forEach(track => track.stop());
      return { hasPermission: true, hasBackCamera: true };
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        return { hasPermission: false, hasBackCamera: true };
      }
      if (error.name === 'OverconstrainedError' || error.name === 'NotFoundError') {
        return { hasPermission: true, hasBackCamera: false };
      }
      return { hasPermission: false, hasBackCamera: false };
    }
  }

  async startRecording(videoElement: HTMLVideoElement): Promise<void> {
    if (this.isRecording) return;

    const settings = storageService.getCameraSettings();
    
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: settings.resolution === '4K' ? 3840 : settings.resolution === '1080p' ? 1920 : 1280,
          height: settings.resolution === '4K' ? 2160 : settings.resolution === '1080p' ? 1080 : 720,
          frameRate: settings.frameRate,
          facingMode: 'environment' // Always use back camera
        },
        audio: true
      });

      videoElement.srcObject = this.videoStream;
      
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(this.videoStream);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording(inspectionId: string): Promise<UploadJob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('Not recording'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: 'video/mp4' });
          const filename = `inspection_${inspectionId}_${Date.now()}.mp4`;
          
          // In a real Capacitor app, we'd save to filesystem
          // For web demo, we'll create a job with blob URL
          const fileUri = URL.createObjectURL(blob);
          
          const job: UploadJob = {
            id: `job_${Date.now()}`,
            inspectionId,
            fileUri,
            fileName: filename,
            size: blob.size,
            createdAt: Date.now(),
            status: 'pending',
            progress: 0
          };

          storageService.addUploadJob(job);
          
          // Cleanup
          if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
          }
          this.isRecording = false;
          this.recordedChunks = [];

          resolve(job);
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  // Camera switching removed - only back camera supported
}

export const cameraService = new CameraService();