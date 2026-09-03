import { useLocation } from "wouter";
import {
  Baby, UserCog, Users, CalendarDays, Layers, Newspaper, StickyNote,
  BookOpen, AlertTriangle, ClipboardX, ShieldAlert, TrendingUp,
  FolderOpen, CheckSquare, BookMarked, ShieldCheck, UserCheck,
  Building2, Mail, ChevronRight, Fingerprint, KeyRound, Bell, FileUp, Palette, Sparkles, MailOpen, School,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Tile = {
  icon: React.ElementType;
  label: string;
  description: string;
  href?: string;
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
      { icon: Baby, label: "Children", description: "Profile display mode — letter icon or uploaded profile picture.", href: "/settings/children" },
      { icon: UserCog, label: "Guardians", description: "Guardian relationship types and contact preferences.", href: "/settings/guardians" },
      { icon: Users, label: "Staff", description: "Roles, qualification types and WWCC requirements.", href: "/settings/staff" },
    ],
  },
  {
    label: "Programming",
    tiles: [
      { icon: CalendarDays, label: "Calendar", description: "Viewing preferences, event types and display options.", href: "/settings/calendar-config" },
      { icon: Layers, label: "Planning Cycle", description: "Stage labels, default templates and planning cycle options.", href: "/settings/planning" },
    ],
  },
  {
    label: "Learning",
    tiles: [
      { icon: Newspaper, label: "Posts", description: "Post categories, visibility defaults and notification settings.", href: "/settings/posts" },
      { icon: StickyNote, label: "Jottings", description: "Jotting types and tagging configuration.", href: "/settings/jottings" },
      { icon: BookOpen, label: "Observations", description: "Observation templates, MTOP outcome defaults and sharing settings.", href: "/settings/observations" },
    ],
  },
  {
    label: "Service Operations",
    tiles: [
      { icon: AlertTriangle, label: "Incident Log", description: "Incident categories, severity levels and reporting requirements.", href: "/settings/incident-config" },
      { icon: ClipboardX, label: "Condition Report", description: "Condition types and escalation workflows.", href: "/settings/condition-config" },
      { icon: ShieldAlert, label: "Safety Evacuation", description: "Evacuation procedure templates and drill frequency.", href: "/settings/evacuation-config" },
      { icon: TrendingUp, label: "QIP Settings", description: "Manage QIP sources, priority types and improvement item defaults.", href: "/settings/qip" },
      { icon: FolderOpen, label: "Policies & Files", description: "File categories, retention periods and access permissions.", href: "/settings/policies-config" },
      { icon: CheckSquare, label: "Checklists", description: "Checklist templates, schedules and completion reminders.", href: "/settings/checklists-config" },
    ],
  },
  {
    label: "Reports",
    tiles: [
      { icon: BookMarked, label: "Learning Stories", description: "Report templates, branding and export preferences.", href: "/settings/learning-stories" },
      { icon: ShieldCheck, label: "Service Compliance", description: "NQS area configuration and compliance tracking preferences.", href: "/settings/service-compliance-config" },
      { icon: UserCheck, label: "Staff Compliance", description: "Qualification expiry thresholds and compliance alert settings.", href: "/settings/staff-compliance" },
    ],
  },
  {
    label: "System",
    tiles: [
      { icon: Building2, label: "Sites", description: "Manage service locations, site names and addresses.", href: "/sites" },
      { icon: School, label: "School Portal", description: "Choose visible portal areas and staff qualifications shared with schools.", href: "/settings/school-portal" },
      { icon: Mail, label: "Email Notifications", description: "Customise email templates, sender name and logo for all transactional emails.", href: "/settings/email-notifications" },
      { icon: Fingerprint, label: "Organisation", description: "Assign and manage the Organisation ID used for database routing and multi-site identification.", href: "/settings/organisation" },
      { icon: KeyRound, label: "Access", description: "Control which menu items are visible for each user role — Educational Leader, Educators, and Guardians.", href: "/settings/access" },
      { icon: Bell, label: "Notifications", description: "Configure which events trigger in-app notifications and advance-day thresholds for deadline alerts.", href: "/settings/notifications" },
      { icon: FileUp, label: "Data Import", description: "Bulk-import children, staff, and guardian accounts from CSV files for rapid site onboarding.", href: "/settings/data-import" },
      { icon: MailOpen, label: "Webmail", description: "Enable a Webmail link in the sidebar for all staff and configure the URL for your email provider.", href: "/settings/webmail" },
      { icon: Palette, label: "Brand Kit", description: "Colour palette, typography scale, component examples, and layout patterns used across EduCare.", href: "/settings/brand-kit" },
      { icon: Sparkles, label: "Product Overview", description: "Printable feature reference for EduCare — share with stakeholders or export as a PDF brochure.", href: "/settings/product-overview" },
    ],
  },
];

export default function Settings() {
  const [, navigate] = useLocation();

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
              const isClickable = !!tile.href;
              return (
                <Card
                  key={tile.label}
                  onClick={() => tile.href && navigate(tile.href)}
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
    </div>
  );
}
