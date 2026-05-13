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
import StaffList from "@/pages/staff-list";
import AddStaff from "@/pages/add-staff";
import ObservationsList from "@/pages/observations-list";
import NewObservation from "@/pages/new-observation";
import ViewObservation from "@/pages/view-observation";
import ProgramsList from "@/pages/programs-list";
import NewProgram from "@/pages/new-program";
import NqsCompliance from "@/pages/nqs-compliance";
import Outcomes from "@/pages/outcomes";

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
        
        <Route path="/staff" component={StaffList} />
        <Route path="/staff/new" component={AddStaff} />
        
        <Route path="/observations" component={ObservationsList} />
        <Route path="/observations/new" component={NewObservation} />
        <Route path="/observations/:id" component={ViewObservation} />
        
        <Route path="/programs" component={ProgramsList} />
        <Route path="/programs/new" component={NewProgram} />
        
        <Route path="/nqs" component={NqsCompliance} />
        <Route path="/outcomes" component={Outcomes} />
        
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