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
  HeartHandshake,
  FolderOpen,
  CheckSquare,
  UserCheck,
  Building2
} from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/children", label: "Children", icon: Baby },
      { href: "/staff", label: "Staff", icon: Users },
    ]
  },
  {
    label: "PROGRAMMING",
    items: [
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/planning", label: "Planning Cycle", icon: Layers },
      { href: "/programs", label: "Programs", icon: ClipboardList },
      { href: "/nqs", label: "NQS Compliance", icon: ShieldCheck },
      { href: "/outcomes", label: "MTOP Outcomes", icon: Award },
    ]
  },
  {
    label: "LEARNING",
    items: [
      { href: "/posts", label: "Posts", icon: Newspaper },
      { href: "/jottings", label: "Jottings", icon: StickyNote },
      { href: "/observations", label: "Observations", icon: BookOpen },
    ]
  },
  {
    label: "SERVICE OPERATIONS",
    items: [
      { href: "/incidents", label: "Incident Log", icon: AlertTriangle },
      { href: "/condition-reports", label: "Condition Report", icon: ClipboardX },
      { href: "/evacuations", label: "Safety Evacuation", icon: ShieldAlert },
      { href: "/qip", label: "QIP", icon: TrendingUp },
      { href: "/wellbeing", label: "Wellbeing", icon: HeartHandshake },
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
    ]
  },
  {
    label: "SETTINGS",
    items: [
      { href: "/sites", label: "Sites", icon: Building2 },
    ]
  }
];

function NavLinks({ location }: { location: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 flex items-center space-x-2 shrink-0 border-b">
        <BookMarked className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold text-foreground">EduCare</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-5 pb-8">
          {NAV_GROUPS.map((group, i) => (
            <div key={i} className="space-y-1">
              {group.label && (
                <div className="px-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <div className={`flex items-center space-x-3 rounded-md px-3 py-2 text-sm transition-colors cursor-pointer ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-[100dvh] w-full bg-background">
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card h-[100dvh] sticky top-0">
        <NavLinks location={location} />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-6 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 flex flex-col">
              <NavLinks location={location} />
            </SheetContent>
          </Sheet>
          <div className="flex-1">
            <span className="font-bold text-lg">EduCare</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
