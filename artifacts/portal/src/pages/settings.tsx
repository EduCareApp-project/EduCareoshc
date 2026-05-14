import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Baby, UserCog, Users, CalendarDays, Layers, Newspaper, StickyNote,
  BookOpen, AlertTriangle, ClipboardX, ShieldAlert, TrendingUp,
  FolderOpen, CheckSquare, BookMarked, ShieldCheck, UserCheck,
  Building2, ChevronRight, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useListQipSources, useCreateQipSource, useDeleteQipSource } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

function QipSourcesPanel() {
  const queryClient = useQueryClient();
  const { data: sources } = useListQipSources();
  const createMutation = useCreateQipSource();
  const deleteMutation = useDeleteQipSource();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");

  function addSource(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({ data: { name: newName.trim() } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/qip-sources"] });
        setNewName("");
        toast({ title: "Source added" });
      },
      onError: () => toast({ title: "Failed to add source", variant: "destructive" }),
    });
  }

  function removeSource(id: number) {
    deleteMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/qip-sources"] }),
      onError: () => toast({ title: "Failed to remove source", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Manage the sources available when creating QIP items.</p>
      <div className="space-y-1 min-h-[40px]">
        {(sources ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No sources added yet.</p>
        ) : (
          (sources ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
              <span className="text-sm">{s.name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeSource(s.id)}
                disabled={deleteMutation.isPending}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
      <form onSubmit={addSource} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add new source…"
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={!newName.trim() || createMutation.isPending}>
          Add
        </Button>
      </form>
    </div>
  );
}

type Tile = {
  icon: React.ElementType;
  label: string;
  description: string;
  href?: string;
  onClickKey?: string;
  comingSoon?: boolean;
};

type Group = {
  label: string;
  tiles: Tile[];
};

const SETTINGS_GROUPS: Group[] = [
  {
    label: "People & Enrolment",
    tiles: [
      { icon: Baby, label: "Children", description: "Enrolment defaults, age group configuration and profile fields.", comingSoon: true },
      { icon: UserCog, label: "Guardians", description: "Guardian relationship types and contact preferences.", comingSoon: true },
      { icon: Users, label: "Staff", description: "Roles, qualification types and WWCC requirements.", comingSoon: true },
    ],
  },
  {
    label: "Programming",
    tiles: [
      { icon: CalendarDays, label: "Calendar", description: "Viewing preferences, event types and display options.", comingSoon: true },
      { icon: Layers, label: "Planning Cycle", description: "Stage labels, default templates and planning cycle options.", comingSoon: true },
    ],
  },
  {
    label: "Learning",
    tiles: [
      { icon: Newspaper, label: "Posts", description: "Post categories, visibility defaults and notification settings.", comingSoon: true },
      { icon: StickyNote, label: "Jottings", description: "Jotting types and tagging configuration.", comingSoon: true },
      { icon: BookOpen, label: "Observations", description: "Observation templates, MTOP outcome defaults and sharing settings.", comingSoon: true },
    ],
  },
  {
    label: "Service Operations",
    tiles: [
      { icon: AlertTriangle, label: "Incident Log", description: "Incident categories, severity levels and reporting requirements.", comingSoon: true },
      { icon: ClipboardX, label: "Condition Report", description: "Condition types and escalation workflows.", comingSoon: true },
      { icon: ShieldAlert, label: "Safety Evacuation", description: "Evacuation procedure templates and drill frequency.", comingSoon: true },
      { icon: TrendingUp, label: "QIP Settings", description: "Manage QIP sources, priority types and improvement item defaults.", onClickKey: "qip-sources" },
      { icon: FolderOpen, label: "Policies & Files", description: "File categories, retention periods and access permissions.", comingSoon: true },
      { icon: CheckSquare, label: "Checklists", description: "Checklist templates, schedules and completion reminders.", comingSoon: true },
    ],
  },
  {
    label: "Reports",
    tiles: [
      { icon: BookMarked, label: "Learning Stories", description: "Report templates, branding and export preferences.", comingSoon: true },
      { icon: ShieldCheck, label: "Service Compliance", description: "NQS area configuration and compliance tracking preferences.", comingSoon: true },
      { icon: UserCheck, label: "Staff Compliance", description: "Qualification expiry thresholds and compliance alert settings.", comingSoon: true },
    ],
  },
  {
    label: "System",
    tiles: [
      { icon: Building2, label: "Sites", description: "Manage service locations, site names and addresses.", href: "/sites" },
    ],
  },
];

export default function Settings() {
  const [, navigate] = useLocation();
  const [qipSourcesOpen, setQipSourcesOpen] = useState(false);

  function handleTileClick(tile: Tile) {
    if (tile.href) { navigate(tile.href); return; }
    if (tile.onClickKey === "qip-sources") { setQipSourcesOpen(true); return; }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage configuration for each area of EduCare.</p>
      </div>

      {SETTINGS_GROUPS.map((group) => (
        <section key={group.label}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{group.label}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.tiles.map((tile) => {
              const Icon = tile.icon;
              const isClickable = !!tile.href || !!tile.onClickKey;
              return (
                <Card
                  key={tile.label}
                  onClick={() => handleTileClick(tile)}
                  className={`transition-colors ${isClickable ? "cursor-pointer hover:border-primary/50 hover:bg-accent/30" : "opacity-70"}`}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="mt-0.5 rounded-md bg-muted p-2 shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-foreground">{tile.label}</span>
                        {tile.comingSoon && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                            Coming soon
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{tile.description}</p>
                    </div>
                    {isClickable && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      <Dialog open={qipSourcesOpen} onOpenChange={setQipSourcesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QIP Settings – Sources</DialogTitle>
          </DialogHeader>
          <QipSourcesPanel />
        </DialogContent>
      </Dialog>
    </div>
  );
}
