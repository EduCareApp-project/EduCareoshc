import { useState } from "react";
import { 
  Map, 
  Plus, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronLeft, 
  Filter,
  Mail,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";

type GuardianRequest = {
  id: string;
  guardianName: string;
  childName: string;
  email: string;
  isActiveAccount: boolean;
  acknowledged: boolean;
  permission: "pending" | "granted" | "declined";
};

type Excursion = {
  id: string;
  title: string;
  location: string;
  date: string;
  description: string;
  riskAssessmentUrl: string;
  status: "active" | "completed" | "draft";
  guardians: GuardianRequest[];
};

const EXCURSIONS_DATA: Excursion[] = [
  {
    id: "exc-001",
    title: "Local Library Storytime",
    location: "City Library, Main Street",
    date: "22 Sep 2026 - 10:00 AM",
    description: "A short walk to the local library for their weekly toddler storytime and interactive reading session. Children will learn about community resources.",
    riskAssessmentUrl: "#",
    status: "active",
    guardians: [
      { id: "g-1", guardianName: "Sarah Miller", childName: "Leo Miller", email: "sarah.m@example.com", isActiveAccount: true, acknowledged: true, permission: "granted" },
      { id: "g-2", guardianName: "David Chen", childName: "Mia Chen", email: "david.c@example.com", isActiveAccount: true, acknowledged: true, permission: "pending" },
      { id: "g-3", guardianName: "Emma Watson", childName: "Noah Watson", email: "emma.w@example.com", isActiveAccount: false, acknowledged: false, permission: "pending" },
      { id: "g-4", guardianName: "James Wilson", childName: "Ava Wilson", email: "james.w@example.com", isActiveAccount: true, acknowledged: true, permission: "declined" },
    ]
  },
  {
    id: "exc-002",
    title: "Botanical Gardens Picnic",
    location: "Royal Botanical Gardens",
    date: "09 Oct 2026 - 11:30 AM",
    description: "Bus trip to the botanical gardens. We will be exploring the native flora, having a picnic lunch, and doing nature rubbings.",
    riskAssessmentUrl: "#",
    status: "draft",
    guardians: []
  },
  {
    id: "exc-003",
    title: "Fire Station Visit",
    location: "Central Fire Station",
    date: "28 Aug 2026 - 09:00 AM",
    description: "Educational visit to the local fire station to learn about fire safety. Includes a demonstration of the fire engine.",
    riskAssessmentUrl: "#",
    status: "completed",
    guardians: [
      { id: "g-5", guardianName: "Michael Chang", childName: "Oliver Chang", email: "m.chang@example.com", isActiveAccount: true, acknowledged: true, permission: "granted" },
      { id: "g-6", guardianName: "Jessica Lee", childName: "Sophie Lee", email: "jess.lee@example.com", isActiveAccount: true, acknowledged: true, permission: "granted" },
    ]
  }
];

function ExcursionDetail({ excursion, onBack }: { excursion: Excursion, onBack: () => void }) {
  const [filter, setFilter] = useState("all");
  
  const filteredGuardians = excursion.guardians.filter(g => filter === "all" || g.permission === filter);

  const getStatusBadge = (status: Excursion["status"]) => {
    switch(status) {
      case "active": return <Badge className="bg-emerald-500 hover:bg-emerald-600">Active</Badge>;
      case "completed": return <Badge variant="secondary">Completed</Badge>;
      case "draft": return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onBack} 
        className="-ml-3 text-muted-foreground hover:text-foreground" 
        data-testid="button-back-excursions"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Excursions
      </Button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            {getStatusBadge(excursion.status)}
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground" data-testid={`text-excursion-title-${excursion.id}`}>
            {excursion.title}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Map className="h-4 w-4" /> {excursion.location}</span>
            <span className="hidden sm:inline">&bull;</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {excursion.date}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
           <Button variant="outline" data-testid="button-view-risk-assessment">
             <ShieldAlert className="h-4 w-4 mr-2 text-amber-500" />
             Risk Assessment
           </Button>
           <Button data-testid="button-edit-excursion">Edit Excursion</Button>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-muted/30 border border-muted/50">
        <p className="text-foreground leading-relaxed" data-testid="text-excursion-description">
          {excursion.description}
        </p>
      </div>

      <div className="pt-2">
        <Tabs defaultValue="permissions" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="permissions" data-testid="tab-permissions">Guardian Permissions</TabsTrigger>
            <TabsTrigger value="details" data-testid="tab-details">Requirements & Logistics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="permissions" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
               <div className="flex flex-wrap items-center gap-2">
                 <Input 
                   placeholder="Search guardians or children..." 
                   className="w-full sm:w-[280px]" 
                   data-testid="input-search-guardians" 
                 />
                 <div className="flex gap-2">
                   <Button 
                     variant={filter === "all" ? "secondary" : "ghost"} 
                     size="sm" 
                     onClick={() => setFilter("all")}
                     className="h-9"
                   >
                     All
                   </Button>
                   <Button 
                     variant={filter === "pending" ? "secondary" : "ghost"} 
                     size="sm" 
                     onClick={() => setFilter("pending")}
                     className="h-9"
                   >
                     Waiting
                   </Button>
                   <Button 
                      variant={filter === "granted" ? "secondary" : "ghost"} 
                     size="sm" 
                      onClick={() => setFilter("granted")}
                     className="h-9"
                   >
                     Granted
                   </Button>
                 </div>
               </div>
               
               <Dialog>
                 <DialogTrigger asChild>
                   <Button variant="outline" data-testid="button-upload-emails" className="shrink-0 bg-white dark:bg-transparent">
                     <Upload className="h-4 w-4 mr-2" />
                      Import Guardian Emails
                   </Button>
                 </DialogTrigger>
                 <DialogContent>
                   <DialogHeader>
                     <DialogTitle>Upload Guardian List</DialogTitle>
                     <DialogDescription>
                        Upload a CSV file containing guardian emails, then check which addresses belong to active guardian accounts.
                     </DialogDescription>
                   </DialogHeader>
                   <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-10 flex flex-col items-center justify-center text-center space-y-4 mt-2 bg-muted/10 transition-colors hover:bg-muted/20">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground mt-1">CSV or Excel files only, up to 5MB</p>
                      </div>
                   </div>
                   <DialogFooter className="mt-4">
                     <Button variant="outline" type="button">Cancel</Button>
                      <Button type="button" data-testid="button-confirm-upload">Check Active Guardians</Button>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Guardian</TableHead>
                    <TableHead>Child</TableHead>
                    <TableHead>Account Status</TableHead>
                     <TableHead>Acknowledged</TableHead>
                     <TableHead>Permission</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGuardians.length === 0 ? (
                    <TableRow>
                       <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No guardians found matching the criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredGuardians.map((g) => (
                      <TableRow key={g.id} data-testid={`row-guardian-${g.id}`} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="font-medium">{g.guardianName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{g.email}</div>
                        </TableCell>
                        <TableCell className="font-medium text-muted-foreground">{g.childName}</TableCell>
                        <TableCell>
                          {g.isActiveAccount ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 font-normal">
                              Active Account
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 font-normal flex w-fit items-center gap-1">
                               <AlertCircle className="h-3 w-3" /> Unregistered
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {g.acknowledged ? (
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" /> Yes
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not yet</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {g.permission === "granted" && <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-transparent">Granted</Badge>}
                          {g.permission === "declined" && <Badge variant="destructive">Declined</Badge>}
                          {g.permission === "pending" && <Badge variant="secondary" className="text-muted-foreground font-normal">Waiting</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Send Reminder" data-testid={`button-remind-${g.id}`}>
                            <Mail className="h-4 w-4" />
                            <span className="sr-only">Send Reminder</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
          <TabsContent value="details">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-3">
                  <FileText className="h-10 w-10 opacity-20" />
                  <div>
                    <p className="font-medium text-foreground">No extra details provided</p>
                    <p className="text-sm mt-1">Additional logistics, transport details, and educator assignments will appear here.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function Excursions() {
  const [selectedExcursion, setSelectedExcursion] = useState<Excursion | null>(null);

  if (selectedExcursion) {
    return <ExcursionDetail excursion={selectedExcursion} onBack={() => setSelectedExcursion(null)} />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">Excursions</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base" data-testid="text-page-subtitle">
            Plan outings, attach risk assessments, and manage guardian permissions.
          </p>
        </div>
        <Button data-testid="button-add-excursion" className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Plan Excursion
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {EXCURSIONS_DATA.map(exc => (
           <Card 
             key={exc.id} 
             className="cursor-pointer group hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col" 
             onClick={() => setSelectedExcursion(exc)} 
             data-testid={`card-excursion-${exc.id}`}
           >
             <CardHeader className="pb-3 bg-muted/20">
               <div className="flex justify-between items-start mb-3">
                 {exc.status === "active" && <Badge className="bg-emerald-500 text-white">Active</Badge>}
                 {exc.status === "completed" && <Badge variant="secondary">Completed</Badge>}
                 {exc.status === "draft" && <Badge variant="outline">Draft</Badge>}
                 
                 <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                   <Clock className="h-3.5 w-3.5" />
                   {exc.date.split(" - ")[0]}
                 </span>
               </div>
               <CardTitle className="text-xl group-hover:text-primary transition-colors">{exc.title}</CardTitle>
               <CardDescription className="line-clamp-2 mt-1 text-sm leading-relaxed">
                 {exc.description}
               </CardDescription>
             </CardHeader>
             <CardContent className="pt-4 flex-1 flex flex-col justify-end">
               <div className="flex items-center gap-5 text-sm">
                 <div className="flex items-center gap-1.5 font-medium text-foreground">
                   <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>{exc.guardians.filter(g => g.permission === 'granted').length} Approved</span>
                 </div>
                 <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                   <Clock className="h-4 w-4 text-amber-500" />
                    <span>{exc.guardians.filter(g => g.permission === 'pending').length} Pending</span>
                 </div>
               </div>
             </CardContent>
           </Card>
        ))}
      </div>
    </div>
  );
}
