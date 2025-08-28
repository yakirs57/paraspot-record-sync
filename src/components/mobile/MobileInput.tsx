import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { forwardRef } from "react";

interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  fullWidth?: boolean;
}

export const MobileInput = forwardRef<HTMLInputElement, MobileInputProps>(
  ({ className, fullWidth = true, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        className={cn(
          "mobile-input",
          fullWidth && "w-full",
          className
        )}
        {...props}
      />
    );
  }
);

MobileInput.displayName = "MobileInput";