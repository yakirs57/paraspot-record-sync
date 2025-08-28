interface TopBarProps {
  title?: string;
  showLogo?: boolean;
  showBack?: boolean;
  onBack?: () => void;
}

export function TopBar({ title, showLogo = true, showBack = false, onBack }: TopBarProps) {
  return (
    <div className="safe-area-top bg-background border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        {showBack ? (
          <button 
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : showLogo ? (
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
        ) : null}
        
        {(showBack || !showLogo) && title && (
          <h1 className="text-lg font-semibold text-foreground absolute left-1/2 transform -translate-x-1/2">{title}</h1>
        )}
        
        <div className="w-8 h-8" /> {/* Spacer for centering */}
      </div>
    </div>
  );
}