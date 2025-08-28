import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { forwardRef } from "react";

interface MobileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  fullWidth?: boolean;
}

export const MobileButton = forwardRef<HTMLButtonElement, MobileButtonProps>(
  ({ className, variant = 'primary', fullWidth = false, children, ...props }, ref) => {
    const getButtonVariant = () => {
      switch (variant) {
        case 'primary': return 'default';
        case 'secondary': return 'secondary';
        case 'outline': return 'outline';
        case 'ghost': return 'ghost';
        case 'destructive': return 'destructive';
        default: return 'default';
      }
    };

    return (
      <Button
        ref={ref}
        variant={getButtonVariant()}
        className={cn(
          "mobile-button",
          fullWidth && "w-full",
          variant === 'primary' && "bg-primary hover:bg-primary-hover text-primary-foreground",
          variant === 'outline' && "border-2 border-primary text-primary bg-transparent hover:bg-primary hover:text-primary-foreground",
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