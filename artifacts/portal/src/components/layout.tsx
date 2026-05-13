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
  ShieldCheck
} from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/children", label: "Children", icon: Baby },
  { href: "/staff", label: "Staff", icon: Users },
  { href: "/observations", label: "Observations", icon: BookOpen },
  { href: "/programs", label: "Programs", icon: ClipboardList },
  { href: "/nqs", label: "NQS Compliance", icon: ShieldCheck },
  { href: "/outcomes", label: "MTOP Outcomes", icon: Award },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const NavLinks = () => (
    <>
      <div className="px-3 py-4 flex items-center space-x-2">
        <BookMarked className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold text-foreground">EduCare</span>
      </div>
      <div className="space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center space-x-3 rounded-md px-3 py-2 transition-colors cursor-pointer ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card">
        <NavLinks />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 lg:h-0 items-center gap-4 border-b bg-card px-6 lg:border-none lg:px-0 lg:bg-transparent">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <NavLinks />
            </SheetContent>
          </Sheet>
          <div className="flex-1 lg:hidden">
            <span className="font-bold text-lg">EduCare Portal</span>
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
