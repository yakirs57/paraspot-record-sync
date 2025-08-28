import { InspectionRecord, UploadJob } from '../types';

class StorageService {
  private readonly RECENT_INSPECTIONS_KEY = 'recent_inspections';
  private readonly UPLOAD_QUEUE_KEY = 'upload_queue';

  // Recent Inspections Management
  getRecentInspections(): InspectionRecord[] {
    try {
      const stored = localStorage.getItem(this.RECENT_INSPECTIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  addRecentInspection(inspectionId: string): void {
    const records = this.getRecentInspections();
    const existing = records.find(r => r.id === inspectionId);

    if (existing) {
      existing.lastUsedAt = Date.now();
    } else {
      records.unshift({
        id: inspectionId,
        lastUsedAt: Date.now()
      });
    }

    // Keep only last 5
    const updated = records
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, 5);

    localStorage.setItem(this.RECENT_INSPECTIONS_KEY, JSON.stringify(updated));
  }

  removeRecentInspection(inspectionId: string): void {
    const records = this.getRecentInspections();
    const filtered = records.filter(r => r.id !== inspectionId);
    localStorage.setItem(this.RECENT_INSPECTIONS_KEY, JSON.stringify(filtered));
  }

  // Upload Queue Management
  getUploadQueue(): UploadJob[] {
    try {
      const stored = localStorage.getItem(this.UPLOAD_QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  addUploadJob(job: UploadJob): void {
    const queue = this.getUploadQueue();
    queue.push(job);
    localStorage.setItem(this.UPLOAD_QUEUE_KEY, JSON.stringify(queue));
  }

  updateUploadJob(jobId: string, updates: Partial<UploadJob>): void {
    const queue = this.getUploadQueue();
    const index = queue.findIndex(job => job.id === jobId);
    
    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      localStorage.setItem(this.UPLOAD_QUEUE_KEY, JSON.stringify(queue));
    }
  }

  removeUploadJob(jobId: string): void {
    const queue = this.getUploadQueue();
    const filtered = queue.filter(job => job.id !== jobId);
    localStorage.setItem(this.UPLOAD_QUEUE_KEY, JSON.stringify(filtered));
  }

  // Settings
  getCameraSettings() {
    try {
      const stored = localStorage.getItem('camera_settings');
      return stored ? JSON.parse(stored) : {
        resolution: '1080p',
        frameRate: 30,
        camera: 'back',
        flash: 'off'
      };
    } catch {
      return {
        resolution: '1080p',
        frameRate: 30,
        camera: 'back',
        flash: 'off'
      };
    }
  }

  saveCameraSettings(settings: any): void {
    localStorage.setItem('camera_settings', JSON.stringify(settings));
  }
}

export const storageService = new StorageService();
