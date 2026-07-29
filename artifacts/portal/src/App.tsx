import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
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
import GuardianMedicationLogs from "@/pages/guardian-medication-logs";
import GuardianMedical from "@/pages/guardian-medical";
import GuardianPickups from "@/pages/guardian-pickups";
import GuardianEducators from "@/pages/guardian-educators";

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
import WeeklyPlanPrint from "@/pages/weekly-plan-print";
import WeeklyReview from "@/pages/weekly-review";
import Posts from "@/pages/posts";
import NewPost from "@/pages/new-post";
import PostDetail from "@/pages/post-detail";
import EditPost from "@/pages/edit-post";
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
import ReportsWeeklyPlans from "@/pages/reports-weekly-plans";
import Sites from "@/pages/sites";
import SiteInstructions from "@/pages/site-instructions";
import Settings from "@/pages/settings";
import SettingsWebmailConfig from "@/pages/settings-webmail-config";
import SettingsQip from "@/pages/settings-qip";
import SettingsEmailNotifications from "@/pages/settings-email-notifications";
import SettingsOrganisation from "@/pages/settings-organisation";
import SettingsAccess from "@/pages/settings-access";
import SettingsNotifications from "@/pages/settings-notifications";
import SettingsChildren from "@/pages/settings-children";
import SettingsDataImport from "@/pages/settings-data-import";
import SettingsGuardians from "@/pages/settings-guardians";
import SettingsStaffConfig from "@/pages/settings-staff-config";
import SettingsPostsConfig from "@/pages/settings-posts-config";
import SettingsObservationsConfig from "@/pages/settings-observations-config";
import SettingsLearningStoriesConfig from "@/pages/settings-learning-stories-config";
import SettingsIncidentsConfig from "@/pages/settings-incidents-config";
import SettingsCalendarConfig from "@/pages/settings-calendar-config";
import SettingsChecklistsConfig from "@/pages/settings-checklists-config";
import SettingsPlanningConfig from "@/pages/settings-planning-config";
import SettingsServiceComplianceConfig from "@/pages/settings-service-compliance-config";
import SettingsStaffComplianceConfig from "@/pages/settings-staff-compliance-config";
import SettingsJottingsConfig from "@/pages/settings-jottings-config";
import SettingsConditionConfig from "@/pages/settings-condition-config";
import SettingsEvacuationConfig from "@/pages/settings-evacuation-config";
import SettingsPoliciesConfig from "@/pages/settings-policies-config";
import SettingsBrandKit from "@/pages/settings-brand-kit";
import SettingsProductOverview from "@/pages/settings-product-overview";
import MyProfile from "@/pages/my-profile";
import Appraisals from "@/pages/appraisals";
import AppraisalDetail from "@/pages/appraisal-detail";
import ClickUpReports from "@/pages/clickup-reports";
import AppraisalStage1 from "@/pages/appraisal-stage1";
import AppraisalStage2 from "@/pages/appraisal-stage2";
import AppraisalStage3 from "@/pages/appraisal-stage3";
import CoordAppraisalStage1 from "@/pages/coord-appraisal-stage1";
import CoordAppraisalStage2 from "@/pages/coord-appraisal-stage2";
import CoordAppraisalStage3 from "@/pages/coord-appraisal-stage3";
import CoordAppraisalStage4 from "@/pages/coord-appraisal-stage4";

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
        <Route path="/educators" component={GuardianEducators} />
        <Route path="/pickups" component={GuardianPickups} />
        <Route path="/notices" component={GuardianNotices} />
        <Route path="/medical" component={GuardianMedical} />
        <Route path="/medication-logs" component={GuardianMedicationLogs} />
        <Route path="/my-profile" component={MyProfile} />

        <Route component={NotFound} />
      </Switch>
    </GuardianLayout>
  );
}

function StaffRoutes() {
  const [location] = useLocation();
  return (
    <Layout>
      <ErrorBoundary key={location}>
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
        <Route path="/weekly-review" component={WeeklyReview} />

        <Route path="/posts" component={Posts} />
        <Route path="/posts/new" component={NewPost} />
        <Route path="/posts/:id/edit" component={EditPost} />
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
        <Route path="/reports/weekly-plans" component={ReportsWeeklyPlans} />
        <Route path="/clickup-reports" component={ClickUpReports} />

        <Route path="/appraisals" component={Appraisals} />
        <Route path="/appraisals/:id/stage1" component={AppraisalStage1} />
        <Route path="/appraisals/:id/stage2" component={AppraisalStage2} />
        <Route path="/appraisals/:id/stage3" component={AppraisalStage3} />
        <Route path="/appraisals/:id/coord-stage1" component={CoordAppraisalStage1} />
        <Route path="/appraisals/:id/coord-stage2" component={CoordAppraisalStage2} />
        <Route path="/appraisals/:id/coord-stage3" component={CoordAppraisalStage3} />
        <Route path="/appraisals/:id/coord-stage4" component={CoordAppraisalStage4} />
        <Route path="/appraisals/:id" component={AppraisalDetail} />

        <Route path="/sites" component={Sites} />
        <Route path="/sites/:id" component={SiteInstructions} />
        <Route path="/settings" component={Settings} />
        <Route path="/settings/webmail" component={SettingsWebmailConfig} />
        <Route path="/settings/qip" component={SettingsQip} />
        <Route path="/settings/email-notifications" component={SettingsEmailNotifications} />
        <Route path="/settings/organisation" component={SettingsOrganisation} />
        <Route path="/settings/access" component={SettingsAccess} />
        <Route path="/settings/notifications" component={SettingsNotifications} />
        <Route path="/settings/children" component={SettingsChildren} />
        <Route path="/settings/data-import" component={SettingsDataImport} />
        <Route path="/settings/guardians" component={SettingsGuardians} />
        <Route path="/settings/staff" component={SettingsStaffConfig} />
        <Route path="/settings/posts" component={SettingsPostsConfig} />
        <Route path="/settings/observations" component={SettingsObservationsConfig} />
        <Route path="/settings/learning-stories" component={SettingsLearningStoriesConfig} />
        <Route path="/settings/incident-config" component={SettingsIncidentsConfig} />
        <Route path="/settings/calendar-config" component={SettingsCalendarConfig} />
        <Route path="/settings/checklists-config" component={SettingsChecklistsConfig} />
        <Route path="/settings/planning" component={SettingsPlanningConfig} />
        <Route path="/settings/service-compliance-config" component={SettingsServiceComplianceConfig} />
        <Route path="/settings/staff-compliance" component={SettingsStaffComplianceConfig} />
        <Route path="/settings/jottings" component={SettingsJottingsConfig} />
        <Route path="/settings/condition-config" component={SettingsConditionConfig} />
        <Route path="/settings/evacuation-config" component={SettingsEvacuationConfig} />
        <Route path="/settings/policies-config" component={SettingsPoliciesConfig} />
        <Route path="/settings/brand-kit" component={SettingsBrandKit} />
        <Route path="/settings/product-overview" component={SettingsProductOverview} />
        <Route path="/my-profile" component={MyProfile} />

        <Route component={NotFound} />
      </Switch>
      </ErrorBoundary>
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

  // Print routes — no layout chrome
  if (location === "/planning/print" || location.startsWith("/planning/print?")) {
    return <WeeklyPlanPrint />;
  }

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
