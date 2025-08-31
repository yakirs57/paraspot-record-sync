import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MobileButton } from "@/components/mobile/MobileButton";
import { TopBar } from "@/components/mobile/TopBar";
import { cameraService } from "@/services/CameraService";
import { storageService } from "@/services/StorageService";
import { Camera, Zap, ZapOff, Circle, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function CameraScreen() {
  const [searchParams] = useSearchParams();
  const scanId = searchParams.get('scan_id');
  const inspectionType = searchParams.get('inspection_type');
  const cbeName = searchParams.get('cbe_name');
  const debugMode = searchParams.get('debug') === '1';
  const autoApply = searchParams.get('auto_apply');
  const redirectURL = searchParams.get('redirect_url');
  const teamInspectionArg = searchParams.get('team_inspection') === '1';
  const audioSupport = searchParams.get('audio_support') === '1';
  
  const inspectionId = storageService.getInspectionId(scanId, inspectionType, cbeName);
  const inspectionData = storageService.getInspectionData(inspectionId);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [hasBackCamera, setHasBackCamera] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [settings, setSettings] = useState(storageService.getCameraSettings());
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!inspectionId) {
      navigate('/');
      return;
    }
    
    checkPermissions();
    
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [inspectionId, navigate]);

  const checkPermissions = async () => {
    const result = await cameraService.requestPermissions();
    setHasPermission(result.hasPermission);
    setHasBackCamera(result.hasBackCamera);
    
    if (result.hasPermission && result.hasBackCamera) {
      toast({
        title: "Camera Ready",
        description: "You can now start recording",
      });
    } else if (!result.hasPermission) {
      toast({
        title: "Permission Required", 
        description: "Camera and microphone access is needed",
        variant: "destructive"
      });
    } else if (!result.hasBackCamera) {
      toast({
        title: "Back Camera Required",
        description: "This app requires a back-facing camera",
        variant: "destructive"
      });
    }
  };

  const startRecording = async () => {
    if (!videoRef.current || !hasPermission || !hasBackCamera) return;
    
    try {
      await cameraService.startRecording(videoRef.current, audioSupport);
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      toast({
        title: "Recording Started",
        description: `Recording inspection ${inspectionId}`,
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        title: "Recording Failed",
        description: "Unable to start recording. Please try again.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = async () => {
    if (!isRecording || !inspectionId) return;
    
    try {
      const job = await cameraService.stopRecording(inspectionId);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      
      setIsRecording(false);
      setRecordingTime(0);
      
      toast({
        title: "Recording Saved",
        description: `Video added to upload queue`,
      });
      
      navigate('/?tab=queue');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      toast({
        title: "Save Failed",
        description: "Unable to save recording. Please try again.",
        variant: "destructive"
      });
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleFlash = () => {
    const newFlash = settings.flash === 'on' ? 'off' : 'on';
    const newSettings = { ...settings, flash: newFlash };
    setSettings(newSettings);
    storageService.saveCameraSettings(newSettings);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Show permission request screen
  if (hasPermission === false) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <TopBar 
          title="Camera Access" 
          showBack 
          onBack={() => navigate('/')}
        />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <Camera className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Camera Permission Required</h2>
          <p className="text-muted-foreground mb-6">
            We need access to your camera and microphone to record inspection videos. Please enable camera and microphone permissions in your browser settings.
          </p>
          <MobileButton 
            onClick={checkPermissions}
            className="w-full mb-3"
          >
            Try Again
          </MobileButton>
          <MobileButton 
            variant="outline" 
            onClick={() => navigate('/')}
            className="w-full"
          >
            Return to Home
          </MobileButton>
        </div>
      </div>
    );
  }

  // Show back camera required screen
  if (hasBackCamera === false) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <TopBar 
          title="Camera Required" 
          showBack 
          onBack={() => navigate('/')}
        />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <Camera className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Back Camera Required</h2>
          <p className="text-muted-foreground mb-6">
            This app requires a back-facing camera to record inspection videos. Your device doesn't have a compatible back camera.
          </p>
          <MobileButton 
            variant="outline" 
            onClick={() => navigate('/')}
            className="w-full"
          >
            Return to Home
          </MobileButton>
        </div>
      </div>
    );
  }

  // Loading state
  if (hasPermission === null || hasBackCamera === null) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <TopBar 
          title="Camera" 
          showBack 
          onBack={() => navigate('/')}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Checking camera...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Video Preview */}
      <div className="relative flex-1 h-full">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {/* Top Controls */}
        <div className="absolute top-0 left-0 right-0 z-10">
          <TopBar 
            title="Recording" 
            showBack 
            onBack={() => navigate('/')}
          />
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/50 to-transparent">
          <div className="flex items-center justify-between">
            {/* Flash Toggle */}
            <button
              onClick={toggleFlash}
              className="p-3 rounded-full bg-black/30 text-white"
            >
              {settings.flash === 'on' ? <Zap size={24} /> : <ZapOff size={24} />}
            </button>

            {/* Record Button */}
            <button
              onClick={toggleRecording}
              className={`p-4 rounded-full transition-all duration-200 ${
                isRecording 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-white hover:bg-gray-100'
              }`}
            >
              {isRecording ? (
                <Square size={40} className="text-white" />
              ) : (
                <Circle size={40} className="text-red-600" />
              )}
            </button>

            {/* Spacer for balance */}
            <div className="w-12 h-12" />
          </div>
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-20 left-4 flex items-center gap-2 px-3 py-1 bg-red-600 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white text-sm font-medium">
              Recording {formatTime(recordingTime)}
            </span>
          </div>
        )}

        {/* Inspection ID Display */}
        <div className="fixed top-20 right-4 px-3 py-1 bg-black/50 rounded-full">
          <span className="text-white text-sm font-medium">{inspectionId}</span>
        </div>
      </div>
    </div>
  );
}