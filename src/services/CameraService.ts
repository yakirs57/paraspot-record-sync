import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { storageService } from './StorageService';
import { UploadJob } from '../types';

class CameraService {
  private isRecording = false;
  private videoStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  async checkPermissions(): Promise<boolean> {
    try {
      // For web, check navigator permissions
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state === 'granted';
    } catch {
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
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
          facingMode: settings.camera === 'front' ? 'user' : 'environment'
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

  async switchCamera(): Promise<void> {
    const settings = storageService.getCameraSettings();
    const newCamera = settings.camera === 'front' ? 'back' : 'front';
    storageService.saveCameraSettings({ ...settings, camera: newCamera });
    
    // Restart stream with new camera
    if (this.videoStream && !this.isRecording) {
      this.videoStream.getTracks().forEach(track => track.stop());
      // Would restart with new settings
    }
  }
}

export const cameraService = new CameraService();