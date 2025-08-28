import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { forwardRef } from "react";

interface MobileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  fullWidth?: boolean;
}

export const MobileButton = forwardRef<HTMLButtonElement, MobileButtonProps>(
  ({ className, variant = 'primary', fullWidth = false, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          "mobile-button",
          fullWidth && "w-full",
          variant === 'primary' && "bg-primary hover:bg-primary-hover text-primary-foreground",
          variant === 'secondary' && "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
          variant === 'outline' && "border-2 border-primary text-primary bg-transparent hover:bg-primary hover:text-primary-foreground",
          variant === 'ghost' && "bg-transparent text-foreground hover:bg-muted",
          variant === 'destructive' && "bg-destructive hover:bg-destructive/80 text-destructive-foreground",
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

MobileButton.displayName = "MobileButton";