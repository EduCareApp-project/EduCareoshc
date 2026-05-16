import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Baby, 
  BookOpen, 
  ClipboardList, 
  Award, 
  BookMarked,
  Menu,
  ShieldCheck,
  CalendarDays,
  Layers,
  Newspaper,
  StickyNote,
  AlertTriangle,
  ClipboardX,
  ShieldAlert,
  TrendingUp,
  FolderOpen,
  CheckSquare,
  UserCheck,
  Building2,
  UserCog,
  Settings2,
  LogOut,
} from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";
import { useAuth } from "@/contexts/auth";

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/children", label: "Children", icon: Baby },
      { href: "/guardians", label: "Guardians", icon: UserCog },
      { href: "/staff", label: "Staff", icon: Users },
    ]
  },
  {
    label: "PROGRAMMING",
    items: [
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/planning", label: "Planning Cycle", icon: Layers },
    ]
  },
  {
    label: "LEARNING",
    items: [
      { href: "/posts", label: "Posts", icon: Newspaper },
      { href: "/jottings", label: "Jottings", icon: StickyNote },
      { href: "/observations", label: "Observations", icon: BookOpen },
      { href: "/programs", label: "Programs", icon: ClipboardList },
      { href: "/outcomes", label: "MTOP Outcomes", icon: Award },
    ]
  },
  {
    label: "SERVICE OPERATIONS",
    items: [
      { href: "/incidents", label: "Incident Log", icon: AlertTriangle },
      { href: "/condition-reports", label: "Condition Report", icon: ClipboardX },
      { href: "/evacuations", label: "Safety Evacuation", icon: ShieldAlert },
      { href: "/qip", label: "QIP", icon: TrendingUp },
      { href: "/policies", label: "Policies & Files", icon: FolderOpen },
      { href: "/checklists", label: "Checklists", icon: CheckSquare },
    ]
  },
  {
    label: "REPORTS",
    items: [
      { href: "/reports/learning", label: "Learning Stories", icon: BookMarked },
      { href: "/reports/service", label: "Service Compliance", icon: ShieldCheck },
      { href: "/reports/staff", label: "Staff Compliance", icon: UserCheck },
      { href: "/reports/system-access", label: "System Access", icon: UserCog },
    ]
  },
  {
    label: null,
    items: [
      { href: "/settings", label: "Settings", icon: Settings2 },
    ]
  },
];

const ROLE_LABELS: Record<string, string> = {
  director: "Director",
  educator: "Educator",
  assistant: "Assistant",
  trainee: "Trainee",
  admin: "Admin",
  coordinator: "Coordinator",
  educational_leader: "Educational Leader",
  room_leader: "Room Leader",
};

function NavLinks({ location, onNavigate }: { location: string; onNavigate?: () => void }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-4 flex items-center space-x-1 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
        <img src="/educare-logo.png" alt="EduCare" className="h-28 w-28 object-contain" />
        <span className="text-3xl font-bold text-white">EduCare</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-5 pb-8">
          {NAV_GROUPS.map((group, i) => (
            <div key={i} className="space-y-1">
              {group.label && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-2 mb-1">
                  {group.label}
                </p>
              )}
              {group.items.map(({ href, label, icon: Icon }) => {
                const isActive = href === "/" ? location === "/" : location.startsWith(href);
                return (
                  <Link key={href} href={href} onClick={onNavigate}>
                    <div
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* User info + logout */}
      {user && (
        <div className="px-3 py-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.2)" }}>
          <div className="flex items-center gap-2 px-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate leading-tight">{user.name}</p>
              <p className="text-[10px] text-white/50 leading-tight capitalize">
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-white/60 hover:text-white hover:bg-white/10 h-7 text-xs"
            onClick={logout}
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-72 shrink-0 flex-col"
        style={{ backgroundColor: "#1b5e20" }}
      >
        <NavLinks location={location} />
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center h-14 px-4 gap-3"
        style={{ backgroundColor: "#1b5e20", borderBottom: "1px solid rgba(255,255,255,0.2)" }}
      >
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 h-8 w-8 shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 border-r-0" style={{ backgroundColor: "#1b5e20" }}>
            <NavLinks location={location} />
          </SheetContent>
        </Sheet>
        <img src="/educare-logo.png" alt="EduCare" className="h-8 w-8 object-contain" />
        <span className="text-xl font-bold text-white">EduCare</span>
      </div>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        <div className="md:hidden h-14" />
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
