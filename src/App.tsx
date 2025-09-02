
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { App as CapacitorApp } from '@capacitor/app';
import { HomeScreen } from "./screens/HomeScreen";
import { CameraScreen } from "./screens/CameraScreen";
import { UploadQueueScreen } from "./screens/UploadQueueScreen";
import { backgroundUploadService } from "./services/BackgroundUploadService";
import { cameraService } from "./services/CameraService";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Initialize background upload service
    backgroundUploadService.initialize();

    // Setup app state change listener for camera cleanup
    const setupAppStateListener = async () => {
      await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        console.log('App state changed, isActive:', isActive);
        if (!isActive) {
          // App going to background - cleanup camera resources
          console.log('App going to background, cleaning up camera...');
          cameraService.cleanup();
        }
      });
    };

    setupAppStateListener();

    // Request permissions to the camera and microphone
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch((err) => {
        console.warn("Camera/Microphone permission denied or not available:", err);
      });
    }

    // Cleanup when app unmounts
    return () => {
      backgroundUploadService.stopProcessing();
      cameraService.cleanup();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/camera" element={<CameraScreen />} />
            <Route path="/upload-queue" element={<UploadQueueScreen />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
