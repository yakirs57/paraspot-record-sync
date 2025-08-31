import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileButton } from "@/components/mobile/MobileButton";
import { MobileInput } from "@/components/mobile/MobileInput";
import { MobileCard } from "@/components/mobile/MobileCard";
import { StatusBadge } from "@/components/mobile/StatusBadge";
import { TopBar } from "@/components/mobile/TopBar";
import { storageService } from "@/services/StorageService";
import { InspectionRecord, UploadJob } from "@/types";
import { Video, Upload, Clock, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { error } from "console";

export function HomeScreen() {
  const MAX_RECENT_INSPECTIONS = 5;
  const [inspectionInput, setInspectionInput] = useState("");
  const [loadingInspectionAuth, setLoadingInspectionAuth] = useState(false);
  const [recentInspections, setRecentInspections] = useState<InspectionRecord[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadJob[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setRecentInspections(storageService.getRecentInspections().slice(0, MAX_RECENT_INSPECTIONS));
    setUploadQueue(storageService.getUploadQueue());
  };

  const parseInspectionURL = (input: string): { scan_id: string; inspection_type: string; cbe_name: string; extra_params: Record<string, string> } | null => {
    if (!input.trim()) return null;

    // Check if it's a URL
    try {
      const url = new URL(input);
      const extra_params: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        extra_params[key] = value;
      });
      // /inspection/:inspection_type/:cbe_name/:scan_id
      const match = url.pathname.match(
        /^\/inspection\/([^/]+)\/([^/]+)\/([^/]+)/
      );
      if (match) {
        const [, inspection_type, cbe_name, scan_id] = match;
        // You can now use inspection_type, cbe_name, scan_id as needed
        return { scan_id, inspection_type, cbe_name, extra_params };
      }
    } catch {
      // Not a URL
      return null;
    }
    // Not a match
    return null;
  }

  const handleStartInspection = () => {
    setLoadingInspectionAuth(true);
    const { scan_id, inspection_type, cbe_name, extra_params } = parseInspectionURL(inspectionInput) || { scan_id: null, inspection_type: null, cbe_name: null, extra_params: {} };

    if (!scan_id) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid inspection ID or link",
        variant: "destructive"
      });
      setLoadingInspectionAuth(false);
      return;
    }

    fetch("https://www.paraspot.ai/api/scan/authenticateScan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 'scanID': scan_id, 'clientBeName': cbe_name, 'inspectionType': inspection_type })
    })
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.message || "Invalid inspection ID or link");
        }
        return res.json();
      })
      .then((res) => {
        if (res.status === 200) {
          const inspectionData = {
            pid: res.result.pid,
            clientLogoURL: res.result.logo,
            clientName: res.result.name,
            unitAddress: res.result.address,
            id: storageService.getInspectionId(scan_id, inspection_type, cbe_name),
            scan_id: scan_id,
            type: inspection_type,
            cbeName: cbe_name,
            lastUsedAt: null
          };
          storageService.addRecentInspection(inspectionData);
          // Build query params including extra_params
          const params = new URLSearchParams({
            scan_id,
            inspection_type,
            cbe_name,
            ...extra_params
          }).toString();
          navigate(`/camera?${params}`);
          setLoadingInspectionAuth(false);
        } else {
          throw new Error(res.message || "Authentication failed");
        }
      })
      .catch((err) => {
        toast({
          title: "Authentication Failed",
          description: err.message || "Could not authenticate scan",
          variant: "destructive"
        });
        setLoadingInspectionAuth(false);
      });
  };

  const handleRecentInspectionTap = (inspectionId: string) => {
    setInspectionInput(inspectionId);
  };

  const handleRemoveRecentInspection = (inspectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    storageService.removeRecentInspection(inspectionId);
    loadData();
    toast({
      title: "Removed",
      description: "Inspection removed from recent list"
    });
  };

  const handleUploadQueueTap = () => {
    navigate("/upload-queue");
  };

  const isValidInput = parseInspectionURL(inspectionInput) !== null;

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mobile-container">
        <div className="py-6 space-y-6">
          {/* Welcome Section */}
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Start New Inspection</h2>
            <p className="text-sm text-muted-foreground">Enter your inspection ID or paste a link to begin</p>
          </div>

        {/* Main Input Section */}
        <div className="space-y-4">
          <MobileInput
            placeholder="Inspection ID or link"
            value={inspectionInput}
            onChange={(e) => setInspectionInput(e.target.value)}
            className="text-center"
          />
          
          <MobileButton
            variant="primary"
            fullWidth
            onClick={handleStartInspection}
            disabled={!isValidInput}
            className="flex items-center justify-center gap-2"
          >
            <Video size={20} />
            Start Inspection
          </MobileButton>
        </div>

        {/* Recent Inspections */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Recent Inspections</h2>
          </div>
          
          {recentInspections.length === 0 ? (
            <MobileCard>
              <p className="text-muted-foreground text-center py-4">
                No recent inspections yet
              </p>
            </MobileCard>
          ) : (
            <div className="space-y-2">
              {recentInspections.map((inspection) => (
                <MobileCard
                  key={inspection.id}
                  pressable
                  onClick={() => handleRecentInspectionTap(inspection.id)}
                  className="flex items-center justify-between p-4"
                >
                  <span className="font-medium">{inspection.id}</span>
                  <button
                    onClick={(e) => handleRemoveRecentInspection(inspection.id, e)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <X size={16} />
                  </button>
                </MobileCard>
              ))}
            </div>
          )}
        </div>

        {/* Upload Queue */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Upload Queue</h2>
          </div>
          
          {uploadQueue.length === 0 ? (
            <MobileCard>
              <p className="text-muted-foreground text-center py-4">
                Nothing in the queue
              </p>
            </MobileCard>
          ) : (
            <MobileCard 
              pressable 
              onClick={handleUploadQueueTap}
              className="p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{uploadQueue.length} item{uploadQueue.length !== 1 ? 's' : ''}</p>
                  <p className="text-sm text-muted-foreground">Tap to view details</p>
                </div>
                <StatusBadge status={uploadQueue[0]?.status || 'pending'} />
              </div>
            </MobileCard>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}