import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileButton } from "@/components/mobile/MobileButton";
import { MobileCard } from "@/components/mobile/MobileCard";
import { StatusBadge } from "@/components/mobile/StatusBadge";
import { TopBar } from "@/components/mobile/TopBar";
import { storageService } from "@/services/StorageService";
import { uploadService } from "@/services/UploadService";
import { UploadJob } from "@/types";
import { ArrowLeft, Play, Pause, RotateCcw, Trash2, FileVideo, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function UploadQueueScreen() {
  const [uploadQueue, setUploadQueue] = useState<UploadJob[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadQueue();
    
    // Refresh queue periodically to show progress updates
    const interval = setInterval(loadQueue, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = () => {
    setUploadQueue(storageService.getUploadQueue());
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const handleResume = async (job: UploadJob) => {
    try {
      await uploadService.resumeUpload(job.id);
      toast({
        title: "Upload Resumed",
        description: `Resuming upload for ${job.inspectionId}`,
      });
    } catch (error) {
      toast({
        title: "Resume Failed",
        description: "Unable to resume upload",
        variant: "destructive"
      });
    }
  };

  const handlePause = (job: UploadJob) => {
    uploadService.pauseUpload(job.id);
    toast({
      title: "Upload Paused",
      description: `Paused upload for ${job.inspectionId}`,
    });
  };

  const handleRetry = async (job: UploadJob) => {
    try {
      await uploadService.startUpload(job.id);
      toast({
        title: "Upload Retrying",
        description: `Retrying upload for ${job.inspectionId}`,
      });
    } catch (error) {
      toast({
        title: "Retry Failed",
        description: "Unable to retry upload",
        variant: "destructive"
      });
    }
  };

  const handleCancel = (job: UploadJob) => {
    uploadService.cancelUpload(job.id);
    loadQueue();
    toast({
      title: "Upload Cancelled",
      description: `Cancelled upload for ${job.inspectionId}`,
    });
  };

  const handleViewVideo = async (job: UploadJob) => {
    if (!job.fileUri) {
      toast({
        title: "Video Not Available",
        description: "Video file not found",
        variant: "destructive"
      });
      return;
    }

    try {
      // Read file content and create blob URL to avoid security restrictions
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      
      console.log('Reading video file:', job.fileUri);
      
      // Read the file as base64
      const fileData = await Filesystem.readFile({
        directory: Directory.Documents,
        path: job.fileUri
      });
      
      console.log('File read successfully, creating blob...');
      
      // Convert base64 to ArrayBuffer for better compatibility
      const binaryString = atob(fileData.data as string);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create blob with proper MIME type
      const blob = new Blob([bytes], { type: 'video/mp4' });
      const videoUrl = URL.createObjectURL(blob);
      
      console.log('Created video blob URL:', videoUrl);
      
      // Create video element and play in-app
      const videoElement = document.createElement('video');
      videoElement.controls = true;
      videoElement.preload = 'metadata';
      videoElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: black;
        z-index: 9999;
        object-fit: contain;
      `;
      
      // Add close button
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '✕';
      closeButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        font-size: 20px;
        cursor: pointer;
      `;
      
      const cleanup = () => {
        console.log('Cleaning up video player');
        URL.revokeObjectURL(videoUrl); // Clean up memory
        if (document.body.contains(videoElement)) document.body.removeChild(videoElement);
        if (document.body.contains(closeButton)) document.body.removeChild(closeButton);
      };
      
      closeButton.onclick = cleanup;
      videoElement.onended = cleanup;
      
      // Handle video loading errors
      videoElement.onerror = (error) => {
        console.error('Video element error:', error);
        cleanup();
        toast({
          title: "Video Playback Error",
          description: "The video format may not be supported",
          variant: "destructive"
        });
      };
      
      // Set source after all event handlers are attached
      videoElement.src = videoUrl;
      
      document.body.appendChild(videoElement);
      document.body.appendChild(closeButton);
      
      console.log('Video player created, attempting to play...');
      
      // Try to play the video
      videoElement.play().catch(error => {
        console.error('Failed to play video:', error);
        cleanup();
        throw error;
      });
      
    } catch (error) {
      console.error('Failed to open video:', error);
      toast({
        title: "Video Open Failed", 
        description: `Unable to open video: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  const getActionButton = (job: UploadJob) => {
    switch (job.status) {
      case 'pending':
        return (
          <MobileButton
            variant="outline"
            onClick={() => handleResume(job)}
            className="flex items-center gap-1 px-3 py-1 h-8 text-xs"
          >
            <Play size={12} />
            Start
          </MobileButton>
        );
      case 'uploading':
        return (
          <MobileButton
            variant="outline"
            onClick={() => handlePause(job)}
            className="flex items-center gap-1 px-3 py-1 h-8 text-xs"
          >
            <Pause size={12} />
            Pause
          </MobileButton>
        );
      case 'paused':
        return (
          <MobileButton
            variant="outline"
            onClick={() => handleResume(job)}
            className="flex items-center gap-1 px-3 py-1 h-8 text-xs"
          >
            <Play size={12} />
            Resume
          </MobileButton>
        );
      case 'failed':
        return (
          <MobileButton
            variant="outline"
            onClick={() => handleRetry(job)}
            className="flex items-center gap-1 px-3 py-1 h-8 text-xs"
          >
            <RotateCcw size={12} />
            Retry
          </MobileButton>
        );
      case 'completed':
        return null;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center px-4 py-3 bg-background border-b border-border safe-area-top">
        <button 
          onClick={() => navigate('/')}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="ml-2">
          <h1 className="text-lg font-semibold text-foreground">Upload Queue</h1>
          <p className="text-sm text-muted-foreground">
            {uploadQueue.length} item{uploadQueue.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <div className="mobile-container">
        <div className="py-4 space-y-4">

          {/* Queue Items */}
          {uploadQueue.length === 0 ? (
          <MobileCard className="text-center py-8">
            <FileVideo size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No uploads in queue</p>
            <p className="text-sm text-muted-foreground mt-2">
              Record a video to add it to the upload queue
            </p>
          </MobileCard>
        ) : (
          <div className="space-y-3">
            {uploadQueue.map((job) => (
              <MobileCard key={job.id} className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {(job?.inspectionRecord || {})?.unitAddress || job.inspectionId}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {job.fileName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <StatusBadge status={job.status} />
                    <button
                      onClick={() => handleViewVideo(job)}
                      className="p-1 text-muted-foreground hover:text-primary"
                      title="View Video"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleCancel(job)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Cancel Upload"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                {(job.status === 'uploading' || job.status === 'paused') && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{job.progress}% complete</span>
                      <span>{formatFileSize(job.size)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* File Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatFileSize(job.size)}</span>
                  <span>{formatDate(job.createdAt)}</span>
                </div>

                {/* Error Message */}
                {job.status === 'failed' && job.error && (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-xs text-destructive">{job.error}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {job.status === 'completed' ? 'Upload complete' : 
                     job.status === 'uploading' ? 'Uploading...' :
                     job.status === 'paused' ? 'Upload paused' :
                     job.status === 'failed' ? 'Upload failed' : 'Ready to upload'}
                  </div>
                  {getActionButton(job)}
                </div>
              </MobileCard>
            ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}