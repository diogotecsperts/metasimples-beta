import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  showLogout?: boolean;
  onLogout?: () => void;
  rightContent?: React.ReactNode;
  showLogo?: boolean;
};

export function AppHeader({
  title,
  subtitle,
  showLogout = true,
  onLogout,
  rightContent,
  showLogo = false,
}: AppHeaderProps) {
  return (
    <header className="border-b bg-card shadow-sm">
      <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showLogo && (
              <img src={logo} alt="Meta Simples" className="h-14 w-auto" />
            )}
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
              {subtitle && (
                <p className="text-sm md:text-base text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {rightContent}
            {showLogout && onLogout && (
              <Button variant="outline" size="sm" onClick={onLogout}>
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Sair</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
