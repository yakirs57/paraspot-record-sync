interface TopBarProps {
  title?: string;
  showLogo?: boolean;
}

export function TopBar({ title, showLogo = true }: TopBarProps) {
  return (
    <div className="safe-area-top bg-background border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        {showLogo && (
          <div className="flex items-center gap-3">
            <img 
              src="/lovable-uploads/27bba1c3-f955-405f-bb22-451c36dcb9f3.png" 
              alt="Paraspot Logo" 
              className="w-8 h-8"
            />
            <span className="text-lg font-semibold text-foreground">
              {title || 'Paraspot AI'}
            </span>
          </div>
        )}
        {!showLogo && title && (
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        )}
        <div className="w-8 h-8" /> {/* Spacer for centering */}
      </div>
    </div>
  );
}