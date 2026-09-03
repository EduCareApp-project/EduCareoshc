import { ReactNode } from "react";
import { Link } from "wouter";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";

export function SchoolLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen flex-col bg-muted/20">
      {/* Header */}
      <header
        className="flex items-center justify-between h-16 px-4 md:px-8 shrink-0 z-10 shadow-sm"
        style={{ backgroundColor: "#1b5e20" }}
      >
        <div className="flex items-center gap-3 text-white">
          <img src="/educare-logo.png" alt="EduCare" className="h-10 w-10 object-contain" />
          <div className="hidden md:block">
            <h1 className="text-xl font-bold leading-tight">EduCare</h1>
            <p className="text-xs text-white/80 leading-tight tracking-wide uppercase">School Portal</p>
          </div>
        </div>
        
        {user && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-white">{user.name}</p>
              <p className="text-xs text-white/70">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={logout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
