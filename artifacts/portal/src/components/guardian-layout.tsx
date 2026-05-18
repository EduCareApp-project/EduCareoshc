import { type ReactNode, useState, useEffect, useRef } from "react";
import { LogOut, Menu, Home, Bell, BellOff, Newspaper, CalendarDays } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { useAuth } from "@/contexts/auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
];

const LS_LAST_SEEN = "educare_guardian_last_seen";

// ── Types ─────────────────────────────────────────────────────────────────────
type FeedItem = {
  id: string;
  type: "notice" | "post" | "plan";
  title: string;
  subtitle?: string;
  date: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Notification Bell ─────────────────────────────────────────────────────────
function GuardianNotificationBell({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);

  const [lastSeen, setLastSeen] = useState<number>(() => {
    try { return Number(localStorage.getItem(LS_LAST_SEEN) ?? "0"); } catch { return 0; }
  });
  // Snapshot lastSeen at the moment the popover opens so items render correctly as new/read
  const snapshotRef = useRef(lastSeen);

  const { data: notices } = useQuery<{ id: number; title: string; priority: string; createdAt: string }[]>({
    queryKey: ["/api/notices", "guardian"],
    queryFn: async () => {
      const res = await fetch("/api/notices?audience=guardian");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: posts } = useQuery<{ id: number; title: string; publishedAt: string | null }[]>({
    queryKey: ["/api/auth/my-posts"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-posts");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: plans } = useQuery<{ id: number; title: string | null; stage: string; startDate: string | null; createdAt: string }[]>({
    queryKey: ["/api/planning"],
    queryFn: async () => {
      const res = await fetch("/api/planning");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const feed: FeedItem[] = [
    ...(notices ?? []).map((n) => ({
      id: `notice-${n.id}`,
      type: "notice" as const,
      title: n.title,
      subtitle: n.priority !== "normal" ? n.priority.charAt(0).toUpperCase() + n.priority.slice(1) : undefined,
      date: n.createdAt,
    })),
    ...(posts ?? [])
      .filter((p) => !!p.publishedAt)
      .map((p) => ({
        id: `post-${p.id}`,
        type: "post" as const,
        title: p.title,
        date: p.publishedAt!,
      })),
    ...(plans ?? [])
      .filter((p) => p.stage === "published")
      .map((p) => ({
        id: `plan-${p.id}`,
        type: "plan" as const,
        title: p.title ?? "Weekly Program",
        subtitle: p.startDate
          ? `Week of ${new Date(p.startDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`
          : undefined,
        date: p.createdAt,
      })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  const unread = feed.filter((item) => new Date(item.date).getTime() > lastSeen).length;

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      snapshotRef.current = lastSeen;
      const now = Date.now();
      try { localStorage.setItem(LS_LAST_SEEN, String(now)); } catch {}
      setLastSeen(now);
    }
    setOpen(isOpen);
  }

  const ICONS: Record<FeedItem["type"], typeof Bell> = {
    notice: Bell,
    post: Newspaper,
    plan: CalendarDays,
  };
  const TYPE_LABELS: Record<FeedItem["type"], string> = {
    notice: "Notice",
    post: "New post",
    plan: "Calendar",
  };
  const TYPE_COLORS: Record<FeedItem["type"], string> = {
    notice: "bg-amber-100 text-amber-700",
    post: "bg-green-100 text-green-700",
    plan: "bg-blue-100 text-blue-700",
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative h-8 w-8 shrink-0 ${dark ? "text-white hover:bg-white/10" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          aria-label="Updates"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[340px] p-0 shadow-xl" style={{ zIndex: 100 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Updates</span>
          {unread > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {unread} new
            </span>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <BellOff className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nothing new yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {feed.map((item) => {
                const Icon = ICONS[item.type];
                const isNew = new Date(item.date).getTime() > snapshotRef.current;
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 px-4 py-3 ${isNew ? "bg-blue-50/60" : ""}`}
                  >
                    <div className={`mt-0.5 rounded-full p-1.5 shrink-0 ${TYPE_COLORS[item.type]}`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {TYPE_LABELS[item.type]}
                      </p>
                      <p className={`text-sm leading-snug ${isNew ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">{timeAgo(item.date)}</p>
                    </div>
                    {isNew && (
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-2">
          <p className="text-[11px] text-muted-foreground">
            Notices, posts &amp; weekly programs from your centre
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────
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

// ── Layout ────────────────────────────────────────────────────────────────────
export function GuardianLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();

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
        <span className="text-base font-bold text-white flex-1">EduCare Family</span>
        {user && <GuardianNotificationBell dark />}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="md:hidden h-14" />
        {/* Desktop top bar with bell */}
        <div className="hidden md:flex items-center justify-end px-6 py-3 border-b bg-background/95 sticky top-0 z-20">
          {user && <GuardianNotificationBell />}
        </div>
        <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
