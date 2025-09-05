import { WebPlugin } from '@capacitor/core';
import type { BackgroundUploaderPlugin, StartParams, StartResult, MultipartParams } from './definitions';

export class BackgroundUploaderWeb extends WebPlugin implements BackgroundUploaderPlugin {
  private activeUploads = new Map<string, XMLHttpRequest>();
  private uploadCounter = 0;

  async startUpload(options: StartParams): Promise<StartResult> {
    if (!options.uploadUrl) {
      throw new Error('uploadUrl is required');
    }

    if (!options.fileUrl && !options.data) {
      throw new Error('fileUrl or data is required');
    }

    const uploadId = (++this.uploadCounter).toString();
    const method = options.method || 'POST';
    const headers = options.headers || {};

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this.activeUploads.set(uploadId, xhr);

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          this.notifyListeners('progress', { uploadId, progress });
        }
      });

      xhr.addEventListener('load', () => {
        this.activeUploads.delete(uploadId);
        this.notifyListeners('completed', { uploadId, status: xhr.status });
      });

      xhr.addEventListener('error', () => {
        this.activeUploads.delete(uploadId);
        this.notifyListeners('error', { uploadId, message: 'Upload failed' });
      });

      xhr.open(method, options.uploadUrl);
      
      // Set headers
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      let body: any;

      if (options.data) {
        // Handle base64 data
        const binaryString = atob(options.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        body = bytes.buffer;
      } else if (options.fileUrl) {
        // For web, we can't access file:// URLs directly
        throw new Error('fileUrl not supported in web, use data instead');
      }

      xhr.send(body);
      resolve({ uploadId });
    });
  }

  async startMultipartFromFile(options: MultipartParams): Promise<StartResult> {
    throw new Error('Multipart upload not implemented for web');
  }

  async cancel(options: { uploadId: string }): Promise<void> {
    const xhr = this.activeUploads.get(options.uploadId);
    if (xhr) {
      xhr.abort();
      this.activeUploads.delete(options.uploadId);
    }
  }
}
