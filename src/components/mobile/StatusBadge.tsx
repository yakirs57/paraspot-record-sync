import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { UploadJob } from "@/types";

interface StatusBadgeProps {
  status: UploadJob['status'];
  className?: string;
}

const statusConfig = {
  pending: { label: 'Pending', className: 'status-pending' },
  uploading: { label: 'Uploading', className: 'status-uploading' },
  paused: { label: 'Paused', className: 'status-paused' },
  failed: { label: 'Failed', className: 'status-failed' },
  completed: { label: 'Completed', className: 'status-completed' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge 
      className={cn(
        "rounded-full text-xs font-medium px-2 py-1",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}