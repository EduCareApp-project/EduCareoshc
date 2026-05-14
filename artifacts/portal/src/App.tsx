import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

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
import Sites from "@/pages/sites";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
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
        <Route path="/checklists" component={Checklists} />
        
        <Route path="/reports/learning" component={ReportsLearning} />
        <Route path="/reports/service" component={ReportsService} />
        <Route path="/reports/staff" component={ReportsStaff} />
        
        <Route path="/sites" component={Sites} />
        <Route path="/settings" component={Settings} />
        
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
