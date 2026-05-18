import { ReactNode, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users,
  User,
  Baby, 
  BookOpen, 
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
  Globe,
  Star,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ExternalLink,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useAuth } from "@/contexts/auth";
import {
  useGetNotificationCount,
  getGetNotificationCountQueryKey,
  useListNotifications,
  getListNotificationsQueryKey,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@workspace/api-client-react";

type AccessSettings = Record<string, string[]>;

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
      { href: "/calendar", label: "Weekly Programs", icon: CalendarDays },
      { href: "/planning", label: "Planning Cycle", icon: Layers },
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
      { href: "/appraisals", label: "Appraisals", icon: Star },
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function NotificationBell({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const countQueryKey = getGetNotificationCountQueryKey();
  const listQueryKey = getListNotificationsQueryKey();

  const { data: countData } = useGetNotificationCount({
    query: {
      queryKey: countQueryKey,
      refetchInterval: 30_000,
      enabled: !!user,
    },
  });

  const { data: notifications } = useListNotifications({
    query: {
      queryKey: listQueryKey,
      enabled: open,
    },
  });

  const { mutate: markAll } = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: countQueryKey });
        queryClient.invalidateQueries({ queryKey: listQueryKey });
      },
    },
  });

  const { mutate: markOne } = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: countQueryKey });
        queryClient.invalidateQueries({ queryKey: listQueryKey });
      },
    },
  });

  const unread = countData?.count ?? 0;

  function handleNotificationClick(n: { id: number; href?: string | null; read: boolean }) {
    if (!n.read) markOne({ id: n.id });
    if (n.href) {
      setOpen(false);
      setLocation(n.href);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative h-8 w-8 shrink-0 ${dark ? "text-white hover:bg-white/10" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0 shadow-xl"
        style={{ zIndex: 100 }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => markAll(undefined)}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[400px]">
          {!notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <BellOff className="h-8 w-8 opacity-30" />
              <p className="text-sm">You're all caught up</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-accent/50 ${
                    !n.read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                  }`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className={`text-sm leading-snug ${!n.read ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    {n.href && <ExternalLink className="h-3 w-3 text-muted-foreground/50" />}
                    {!n.read && (
                      <button
                        className="rounded-full p-0.5 hover:bg-muted"
                        onClick={(e) => { e.stopPropagation(); markOne({ id: n.id }); }}
                        title="Mark as read"
                      >
                        <Check className="h-3 w-3 text-blue-500" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-2 flex justify-end">
          <Button
            variant="link"
            size="sm"
            className="h-6 text-xs text-muted-foreground p-0"
            onClick={() => { setOpen(false); setLocation("/settings/notifications"); }}
          >
            Notification settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NavLinks({ location, onNavigate }: { location: string; onNavigate?: () => void }) {
  const { user, logout } = useAuth();

  const { data: accessSettings } = useQuery<AccessSettings>({
    queryKey: ["settings-access"],
    queryFn: async () => {
      const res = await fetch("/api/settings/access");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = user?.role === "admin";
  const disabledHrefs: string[] = isAdmin
    ? []
    : (accessSettings?.[user?.role ?? ""] ?? []);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !disabledHrefs.includes(item.href)),
  })).filter((group) => group.items.length > 0);

  const isEducatorRole = ["educator", "coordinator"].includes(user?.role ?? "");
  const EDUCATOR_HIDDEN = new Set(["/guardians", "/settings", "/reports/service", "/reports/staff", "/reports/system-access"]);
  const ownProfileOnly = !isAdmin && !disabledHrefs.includes("staff_own_profile");

  let finalGroups = isEducatorRole
    ? visibleGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !EDUCATOR_HIDDEN.has(item.href)),
        }))
        .filter((group) => group.items.length > 0)
    : visibleGroups;

  if (ownProfileOnly && user?.id) {
    finalGroups = finalGroups.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        item.href === "/staff"
          ? { ...item, href: `/staff/${user!.id}`, label: "My Profile", icon: User }
          : item
      ),
    }));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-4 flex items-center space-x-1 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
        <img src="/educare-logo.png" alt="EduCare" className="h-28 w-28 object-contain" />
        <span className="text-3xl font-bold text-white">EduCare</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-5 pb-8">
          {finalGroups.map((group, i) => (
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
          <div className="space-y-1">
            <a href="/website/" target="_blank" rel="noopener noreferrer">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer text-white/70 hover:bg-white/10 hover:text-white">
                <Globe className="h-4 w-4 shrink-0" />
                Website
              </div>
            </a>
          </div>
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
  const { user } = useAuth();

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
        <span className="text-xl font-bold text-white flex-1">EduCare</span>
        {user && <NotificationBell dark />}
      </div>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        <div className="md:hidden h-14" />
        {/* Desktop top bar with bell */}
        <div className="hidden md:flex items-center justify-end px-6 py-3 border-b bg-background/95 sticky top-0 z-20">
          {user && <NotificationBell />}
        </div>
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
