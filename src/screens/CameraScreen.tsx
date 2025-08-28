import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MobileButton } from "@/components/mobile/MobileButton";
import { TopBar } from "@/components/mobile/TopBar";
import { cameraService } from "@/services/CameraService";
import { storageService } from "@/services/StorageService";
import { ArrowLeft, FlipHorizontal, Zap, ZapOff, Circle, Square, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function CameraScreen() {
  const [searchParams] = useSearchParams();
  const inspectionId = searchParams.get('inspection');
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraSettings, setCameraSettings] = useState(storageService.getCameraSettings());
  
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
    try {
      const hasPerms = await cameraService.checkPermissions();
      if (!hasPerms) {
        const granted = await cameraService.requestPermissions();
        setHasPermissions(granted);
        if (!granted) {
          toast({
            title: "Camera Permission Required",
            description: "Please allow camera access to record videos",
            variant: "destructive"
          });
        }
      } else {
        setHasPermissions(true);
      }
    } catch (error) {
      console.error('Permission check failed:', error);
      toast({
        title: "Permission Error",
        description: "Unable to access camera permissions",
        variant: "destructive"
      });
    }
  };

  const startRecording = async () => {
    if (!videoRef.current || !hasPermissions) return;
    
    try {
      await cameraService.startRecording(videoRef.current);
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

  const switchCamera = async () => {
    try {
      await cameraService.switchCamera();
      const newSettings = storageService.getCameraSettings();
      setCameraSettings(newSettings);
      toast({
        title: "Camera Switched",
        description: `Using ${newSettings.camera} camera`,
      });
    } catch (error) {
      console.error('Failed to switch camera:', error);
    }
  };

  const toggleFlash = () => {
    const newFlash = cameraSettings.flash === 'off' ? 'on' : 'off';
    const newSettings = { ...cameraSettings, flash: newFlash };
    storageService.saveCameraSettings(newSettings);
    setCameraSettings(newSettings);
    
    toast({
      title: "Flash Updated",
      description: `Flash ${newFlash}`,
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!hasPermissions) {
    return (
      <div className="mobile-container safe-area-top flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">Camera Access Needed</h2>
          <p className="text-muted-foreground">Please allow camera permissions to record videos</p>
          <MobileButton onClick={checkPermissions}>
            Check Permissions
          </MobileButton>
          <MobileButton variant="ghost" onClick={() => navigate('/')}>
            Back to Home
          </MobileButton>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black safe-area-top safe-area-bottom">
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
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex items-center justify-between text-white">
            <button 
              onClick={() => navigate('/')}
              className="p-2 rounded-full bg-black/30"
            >
              <ArrowLeft size={24} />
            </button>
            
            <div className="text-center">
              <p className="font-semibold">{inspectionId}</p>
              {isRecording && (
                <p className="text-sm text-red-300 font-mono">
                  REC {formatTime(recordingTime)}
                </p>
              )}
            </div>
            
            <button 
              onClick={switchCamera}
              className="p-2 rounded-full bg-black/30"
            >
              <FlipHorizontal size={24} />
            </button>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/50 to-transparent">
          <div className="flex items-center justify-between">
            {/* Flash Toggle */}
            <button
              onClick={toggleFlash}
              className="p-3 rounded-full bg-black/30 text-white"
            >
              {cameraSettings.flash === 'on' ? <Zap size={24} /> : <ZapOff size={24} />}
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

            {/* Settings placeholder */}
            <div className="p-3 rounded-full opacity-50">
              <Settings size={24} className="text-white" />
            </div>
          </div>
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-20 left-4 flex items-center gap-2 px-3 py-1 bg-red-600 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white text-sm font-medium">Recording</span>
          </div>
        )}
      </div>
    </div>
  );
}