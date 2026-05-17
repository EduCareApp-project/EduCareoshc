import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { GuardianLayout } from "@/components/guardian-layout";
import QipPublic from "@/pages/qip-public";
import ServiceDocsPublic from "@/pages/service-docs-public";
import ServiceDocsManage from "@/pages/service-docs-manage";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import GuardianHome from "@/pages/guardian-home";
import GuardianNotices from "@/pages/guardian-notices";

import Dashboard from "@/pages/dashboard";
import ChildrenList from "@/pages/children-list";
import ChildProfile from "@/pages/child-profile";
import EnrollChild from "@/pages/enroll-child";
import GuardiansList from "@/pages/guardians-list";
import GuardianDetail from "@/pages/guardian-detail";
import StaffList from "@/pages/staff-list";
import AddStaff from "@/pages/add-staff";
import StaffProfile from "@/pages/staff-profile";
import ObservationsList from "@/pages/observations-list";
import NewObservation from "@/pages/new-observation";
import ViewObservation from "@/pages/view-observation";
import ProgramsList from "@/pages/programs-list";
import NewProgram from "@/pages/new-program";
import NqsCompliance from "@/pages/nqs-compliance";
import Outcomes from "@/pages/outcomes";

import Calendar from "@/pages/calendar";
import Planning from "@/pages/planning";
import PlanningDetail from "@/pages/planning-detail";
import Posts from "@/pages/posts";
import NewPost from "@/pages/new-post";
import PostDetail from "@/pages/post-detail";
import Jottings from "@/pages/jottings";
import Incidents from "@/pages/incidents";
import ConditionReports from "@/pages/condition-reports";
import Evacuations from "@/pages/evacuations";
import Qip from "@/pages/qip";
import Wellbeing from "@/pages/wellbeing";
import Policies from "@/pages/policies";
import PoliciesList from "@/pages/policies-list";
import Procedures from "@/pages/procedures";
import FileLibrary from "@/pages/file-library";
import Checklists from "@/pages/checklists";
import ReportsLearning from "@/pages/reports-learning";
import ReportsService from "@/pages/reports-service";
import ReportsStaff from "@/pages/reports-staff";
import ReportsSystemAccess from "@/pages/reports-system-access";
import Sites from "@/pages/sites";
import Settings from "@/pages/settings";
import SettingsQip from "@/pages/settings-qip";
import SettingsEmailNotifications from "@/pages/settings-email-notifications";
import Appraisals from "@/pages/appraisals";
import AppraisalDetail from "@/pages/appraisal-detail";
import AppraisalStage1 from "@/pages/appraisal-stage1";
import AppraisalStage2 from "@/pages/appraisal-stage2";
import AppraisalStage3 from "@/pages/appraisal-stage3";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a4731 0%, #2d6a4f 50%, #1b5e20 100%)" }}>
      <div className="text-center">
        <img src="/educare-logo.png" alt="EduCare" className="h-20 w-20 mx-auto mb-4 animate-pulse object-contain" />
        <p className="text-white/70 text-sm">Loading…</p>
      </div>
    </div>
  );
}

function GuardianRoutes() {
  return (
    <GuardianLayout>
      <Switch>
        <Route path="/" component={GuardianHome} />
        <Route path="/notices" component={GuardianNotices} />
        <Route component={NotFound} />
      </Switch>
    </GuardianLayout>
  );
}

function StaffRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />

        <Route path="/children" component={ChildrenList} />
        <Route path="/children/new" component={EnrollChild} />
        <Route path="/children/:id" component={ChildProfile} />

        <Route path="/guardians" component={GuardiansList} />
        <Route path="/guardians/:email" component={GuardianDetail} />

        <Route path="/staff" component={StaffList} />
        <Route path="/staff/new" component={AddStaff} />
        <Route path="/staff/:id" component={StaffProfile} />

        <Route path="/observations" component={ObservationsList} />
        <Route path="/observations/new" component={NewObservation} />
        <Route path="/observations/:id" component={ViewObservation} />

        <Route path="/programs" component={ProgramsList} />
        <Route path="/programs/new" component={NewProgram} />

        <Route path="/nqs" component={NqsCompliance} />
        <Route path="/outcomes" component={Outcomes} />

        <Route path="/calendar" component={Calendar} />
        <Route path="/planning" component={Planning} />
        <Route path="/planning/new" component={PlanningDetail} />
        <Route path="/planning/:id" component={PlanningDetail} />

        <Route path="/posts" component={Posts} />
        <Route path="/posts/new" component={NewPost} />
        <Route path="/posts/:id" component={PostDetail} />
        <Route path="/jottings" component={Jottings} />

        <Route path="/incidents" component={Incidents} />
        <Route path="/condition-reports" component={ConditionReports} />
        <Route path="/evacuations" component={Evacuations} />
        <Route path="/qip" component={Qip} />
        <Route path="/wellbeing" component={Wellbeing} />
        <Route path="/policies" component={Policies} />
        <Route path="/policies/list" component={PoliciesList} />
        <Route path="/policies/procedures" component={Procedures} />
        <Route path="/policies/files" component={FileLibrary} />
        <Route path="/policies/service-docs" component={ServiceDocsManage} />
        <Route path="/checklists" component={Checklists} />

        <Route path="/reports/learning" component={ReportsLearning} />
        <Route path="/reports/service" component={ReportsService} />
        <Route path="/reports/staff" component={ReportsStaff} />
        <Route path="/reports/system-access" component={ReportsSystemAccess} />

        <Route path="/appraisals" component={Appraisals} />
        <Route path="/appraisals/:id/stage1" component={AppraisalStage1} />
        <Route path="/appraisals/:id/stage2" component={AppraisalStage2} />
        <Route path="/appraisals/:id/stage3" component={AppraisalStage3} />
        <Route path="/appraisals/:id" component={AppraisalDetail} />

        <Route path="/sites" component={Sites} />
        <Route path="/settings" component={Settings} />
        <Route path="/settings/qip" component={SettingsQip} />
        <Route path="/settings/email-notifications" component={SettingsEmailNotifications} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  const [location] = useLocation();
  const { user, isLoading } = useAuth();

  // Always-public routes
  if (location === "/qip-public" || location.startsWith("/qip-public?")) {
    return <QipPublic />;
  }
  if (location === "/service-docs") {
    return <ServiceDocsPublic />;
  }
  if (location === "/login") {
    // If already logged in, redirect away from login
    if (!isLoading && user) {
      return <Redirect to="/" />;
    }
    return <Login />;
  }
  if (location === "/forgot-password") {
    return <ForgotPassword />;
  }
  if (location === "/reset-password" || location.startsWith("/reset-password?")) {
    return <ResetPassword />;
  }

  // Show loading while checking auth
  if (isLoading) return <LoadingScreen />;

  // Not logged in → send to login
  if (!user) return <Redirect to="/login" />;

  // Guardian portal
  if (user.type === "guardian") return <GuardianRoutes />;

  // Staff portal (all roles)
  return <StaffRoutes />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
