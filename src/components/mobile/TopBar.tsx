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
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded opacity-90 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-blue-500 rounded-sm"></div>
              </div>
            </div>
            <span className="text-lg font-semibold text-foreground">
              {title || 'Paraspot Lite'}
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