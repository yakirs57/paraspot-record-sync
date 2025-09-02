import { InspectionRecord, UploadJob } from '../types';

class StorageService {
  private readonly RECENT_INSPECTIONS_KEY = 'recent_inspections';
  private readonly UPLOAD_QUEUE_KEY = 'upload_queue';
  private readonly MAX_RECENT_INSPECTIONS = 10;

  // Recent Inspections Management
  getRecentInspections(): InspectionRecord[] {
    try {
      const stored = localStorage.getItem(this.RECENT_INSPECTIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  getInspectionId(scanId: string, inspectionType: string, cbeName: string): string | null {
    if (!scanId || !inspectionType || !cbeName) return null;

    // Create a unique ID based on the inspection details
    return `${inspectionType}:${cbeName}:${scanId}`;
  }

  getInspectionData(id: string): InspectionRecord {
    try {
      const records = this.getRecentInspections();
      const found = records.find(r => r.id === id);
      return found ? found : null;
    } catch {
      return null;
    }
  }

  addRecentInspection({pid, scan_id, clientLogoURL, clientName, unitAddress, id, type, cbeName}: InspectionRecord): void {
    const records = this.getRecentInspections();
    const existing = records.find(r => r.id === id);

    if (existing) {
      existing.lastUsedAt = Date.now();
    } else {
      records.unshift({
        pid,
        scan_id,
        clientLogoURL,
        clientName,
        unitAddress,
        type,
        cbeName,
        id,
        lastUsedAt: Date.now()
      });
    }

    // Keep only last MAX_RECENT_INSPECTIONS
    const updated = records
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, this.MAX_RECENT_INSPECTIONS);

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

  private onJobAddedCallback?: (job: UploadJob) => void;

  setOnJobAddedCallback(callback: (job: UploadJob) => void): void {
    this.onJobAddedCallback = callback;
  }

  addUploadJob(job: UploadJob): void {
    const queue = this.getUploadQueue();
    queue.push(job);
    localStorage.setItem(this.UPLOAD_QUEUE_KEY, JSON.stringify(queue));
    
    // Trigger immediate processing if callback is set
    if (this.onJobAddedCallback) {
      this.onJobAddedCallback(job);
    }
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

  saveCameraSettings(settings): void {
    localStorage.setItem('camera_settings', JSON.stringify(settings));
  }
}

export const storageService = new StorageService();
