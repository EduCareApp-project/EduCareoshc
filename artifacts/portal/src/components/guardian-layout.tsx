import { type ReactNode } from "react";
import { LogOut, Menu, Home } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useAuth } from "@/contexts/auth";
import { useLocation } from "wouter";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
];

function NavLink({ href, label, icon: Icon, onClose }: { href: string; label: string; icon: typeof Home; onClose?: () => void }) {
  const [location, setLocation] = useLocation();
  const active = location === href;
  return (
    <button
      onClick={() => { setLocation(href); onClose?.(); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-white/20 text-white"
          : "text-white/70 hover:text-white hover:bg-white/10"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

function GuardianSidebar({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full bg-[#1b5e20]">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2 border-b border-white/20">
        <img src="/educare-logo.png" alt="EduCare" className="h-10 w-10 object-contain" />
        <div>
          <span className="text-lg font-bold text-white leading-none block">EduCare</span>
          <span className="text-[10px] text-white/60 uppercase tracking-widest">Family Portal</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} onClose={onClose} />
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-white/20 space-y-2">
        <div className="flex items-center gap-2 px-2">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">
              {(user?.name ?? "G").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-white/60">Guardian</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-white/70 hover:text-white hover:bg-white/10 h-8"
          onClick={logout}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function GuardianLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col">
        <GuardianSidebar />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#1b5e20] flex items-center h-14 px-4 gap-3 border-b border-white/20">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 h-8 w-8">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-56 border-r-0">
            <GuardianSidebar />
          </SheetContent>
        </Sheet>
        <img src="/educare-logo.png" alt="EduCare" className="h-7 w-7 object-contain" />
        <span className="text-base font-bold text-white">EduCare Family</span>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="md:hidden h-14" />
        <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
