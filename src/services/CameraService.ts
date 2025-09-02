import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { storageService } from './StorageService';
import { UploadJob } from '../types';

class CameraService {
  private isRecording = false;
  private videoStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  async checkPermissions(): Promise<{ hasPermission: boolean; hasBackCamera: boolean }> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Camera plugin for native platforms
        const permissions = await Camera.checkPermissions();
        console.log('Camera permissions check result:', permissions);
        return { 
          hasPermission: permissions.camera === 'granted', 
          hasBackCamera: true // Assume back camera exists on mobile devices
        };
      } else {
        // Use web APIs for web platform
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, 
          audio: true 
        });
        stream.getTracks().forEach(track => track.stop());
        return { hasPermission: true, hasBackCamera: true };
      }
    } catch (error) {
      console.error('Camera permission check error:', error);
      if (Capacitor.isNativePlatform()) {
        return { hasPermission: false, hasBackCamera: true };
      } else {
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
  }

  async requestPermissions(): Promise<{ hasPermission: boolean; hasBackCamera: boolean }> {
    try {
      if (Capacitor.isNativePlatform()) {
        console.log('Requesting camera permissions on native platform...');
        // First check current permissions
        const currentPermissions = await Camera.checkPermissions();
        console.log('Current permissions:', currentPermissions);
        
        if (currentPermissions.camera !== 'granted') {
          // Request permissions using Capacitor Camera plugin
          console.log('Requesting new permissions...');
          const permissions = await Camera.requestPermissions();
          console.log('Permission request result:', permissions);
          return { 
            hasPermission: permissions.camera === 'granted', 
            hasBackCamera: true
          };
        } else {
          return { 
            hasPermission: true, 
            hasBackCamera: true
          };
        }
      } else {
        // Use web APIs for web platform
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, 
          audio: true 
        });
        stream.getTracks().forEach(track => track.stop());
        return { hasPermission: true, hasBackCamera: true };
      }
    } catch (error) {
      console.error('Camera permission request error:', error);
      if (Capacitor.isNativePlatform()) {
        return { hasPermission: false, hasBackCamera: true };
      } else {
        if (error.name === 'NotAllowedError') {
          return { hasPermission: false, hasBackCamera: true };
        }
        if (error.name === 'OverconstrainedError' || error.name === 'NotFoundError') {
          return { hasPermission: true, hasBackCamera: false };
        }
        return { hasPermission: false, hasBackCamera: false };
      }
    }
  }

  async openCamera(videoElement: HTMLVideoElement, audioSupport: boolean): Promise<void> {
    if (this.videoStream) {
      console.log('Camera already open, reusing stream');
      videoElement.srcObject = this.videoStream;
      return;
    }

    const settings = storageService.getCameraSettings();
    
    try {
      console.log('Opening camera with settings:', settings);
      console.log('Audio support:', audioSupport);
      console.log('Is native platform:', Capacitor.isNativePlatform());
      console.log('Video element:', videoElement);
      
      // Use getUserMedia for both web and native platforms since Capacitor WebView supports it
      // Use lower resolution settings to prevent lag on mobile devices
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 }, // Max 1080p to prevent lag
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 }, // Cap at 30fps for smoother recording
          facingMode: 'environment'
        },
        audio: audioSupport
      });

      console.log('Got video stream:', this.videoStream);
      console.log('Video stream tracks:', this.videoStream.getTracks());
      
      videoElement.srcObject = this.videoStream;
      
      // Wait for video to load
      await new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          videoElement.play().then(resolve).catch(reject);
        };
        videoElement.onerror = reject;
      });
      
      console.log('Camera opened and playing successfully');
      
    } catch (error) {
      console.error('Failed to open camera:', error);
      throw error;
    }
  }

  async startRecording(): Promise<void> {
    if (this.isRecording || !this.videoStream) return;

    try {
      console.log('Starting recording...');
      
      this.recordedChunks = [];
      
      // Configure MediaRecorder with explicit options for better compatibility
      const options: MediaRecorderOptions = {
        mimeType: 'video/mp4', // Prefer MP4 for better compatibility
        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality without excessive size
        audioBitsPerSecond: 128000   // 128 kbps for audio
      };
      
      // Try different MIME types if the preferred one isn't supported
      let selectedMimeType = 'video/mp4';
      if (!MediaRecorder.isTypeSupported('video/mp4')) {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          selectedMimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          selectedMimeType = 'video/webm';
        }
        options.mimeType = selectedMimeType;
      }
      
      this.mediaRecorder = new MediaRecorder(this.videoStream, options);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      console.log('Recording started successfully');
      
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
          const filename = `inspection_${inspectionId.split(":").slice(-1)[0]}_${Date.now()}.mp4`;
          const filePath = `Paraspot/${filename}`;
          
          // Convert blob to base64 for filesystem storage
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const base64Data = (reader.result as string).split(',')[1];
              
              // Ensure Paraspot directory exists in Documents (public directory)
              try {
                await Filesystem.mkdir({
                  path: 'Paraspot',
                  directory: Directory.Documents,
                  recursive: true
                });
              } catch (error) {
                // Directory might already exist, ignore error
                console.log('Paraspot directory already exists or creation failed:', error);
              }
              
              // Save to public Documents directory under Paraspot folder
              await Filesystem.writeFile({
                path: filePath,
                data: base64Data,
                directory: Directory.Documents
              });
              
              const job: UploadJob = {
                id: `job_${Date.now()}`,
                inspectionId,
                inspectionRecord: storageService.getInspectionData(inspectionId),
                fileUri: filePath, // Store filesystem path instead of blob URL
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
              console.error('Failed to save video to filesystem:', error);
              reject(error);
            }
          };
          
          reader.onerror = () => {
            reject(new Error('Failed to convert video to base64'));
          };
          
          reader.readAsDataURL(blob);
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