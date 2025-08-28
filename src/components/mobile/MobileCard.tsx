import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { forwardRef } from "react";

interface MobileCardProps extends React.HTMLAttributes<HTMLDivElement> {
  pressable?: boolean;
}

export const MobileCard = forwardRef<HTMLDivElement, MobileCardProps>(
  ({ className, pressable = false, children, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          "mobile-card",
          pressable && "cursor-pointer transition-all duration-200 active:scale-95 hover:shadow-md",
          className
        )}
        {...props}
      >
        {children}
      </Card>
    );
  }
);

MobileCard.displayName = "MobileCard";