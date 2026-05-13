import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateObservation, useListChildren, useListStaff, useListOutcomes, useListPrograms, getListObservationsQueryKey } from "@workspace/api-client-react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useMemo } from "react";

const formSchema = z.object({
  childId: z.coerce.number().min(1, "Select a child"),
  staffId: z.coerce.number().min(1, "Select an educator"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(10, "Please provide more details in the observation"),
  observationDate: z.string().min(1, "Date is required"),
  outcomeIds: z.array(z.number()).min(1, "Select at least one MTOP outcome"),
  programId: z.coerce.number().optional().or(z.literal(0).transform(() => undefined)),
  learningExtension: z.string().optional(),
});

export default function NewObservation() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const prefilledChildId = searchParams.get("childId");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createObservation = useCreateObservation();
  const { data: children } = useListChildren();
  const { data: staff } = useListStaff();
  const { data: outcomes } = useListOutcomes();
  const { data: programs } = useListPrograms();

  const activeChildren = useMemo(() => children?.filter(c => c.status === 'active') || [], [children]);
  const activePrograms = useMemo(() => programs?.filter(p => p.status === 'active') || [], [programs]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      childId: prefilledChildId ? parseInt(prefilledChildId) : 0,
      staffId: 0,
      title: "",
      description: "",
      observationDate: new Date().toISOString().split('T')[0],
      outcomeIds: [],
      programId: 0,
      learningExtension: "",
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createObservation.mutate(
      { data: data as any },
      {
        onSuccess: (obs) => {
          queryClient.invalidateQueries({ queryKey: getListObservationsQueryKey() });
          toast({ title: "Success", description: "Observation recorded successfully" });
          setLocation(`/observations/${obs.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to save observation.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => history.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Record Observation</h1>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle>Documentation</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="E.g. Building a block tower independently" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="observationDate" render={({ field }) => (
                      <FormItem><FormLabel>Date of Observation</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="programId" render={({ field }) => (
                      <FormItem><FormLabel>Link to Program (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ? field.value.toString() : "0"}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a program" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="0">None</SelectItem>
                            {activePrograms.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      <FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Observation Notes</FormLabel><FormControl><Textarea rows={6} placeholder="Describe what the child did, said, and how they interacted..." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="learningExtension" render={({ field }) => (
                    <FormItem><FormLabel>Learning Extension (Next Steps)</FormLabel><FormControl><Textarea rows={3} placeholder="How will you extend this learning?" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>MTOP Outcomes</CardTitle></CardHeader>
                <CardContent>
                  <FormField control={form.control} name="outcomeIds" render={() => (
                    <FormItem className="space-y-2">
                      {outcomes?.map((outcome) => (
                        <FormField key={outcome.id} control={form.control} name="outcomeIds" render={({ field }) => (
                          <FormItem key={outcome.id} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-card">
                            <FormControl>
                              <Checkbox 
                                checked={field.value?.includes(outcome.id)} 
                                onCheckedChange={(checked) => checked ? field.onChange([...field.value, outcome.id]) : field.onChange(field.value?.filter((val) => val !== outcome.id))}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer leading-tight">
                              <span className="font-semibold block mb-0.5">Outcome {outcome.number}: {outcome.title}</span>
                              <span className="text-muted-foreground text-xs">{outcome.description}</span>
                            </FormLabel>
                          </FormItem>
                        )} />
                      ))}
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Context</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="childId" render={({ field }) => (
                    <FormItem><FormLabel>Child</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ? field.value.toString() : ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {activeChildren.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.firstName} {c.lastName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="staffId" render={({ field }) => (
                    <FormItem><FormLabel>Educator</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ? field.value.toString() : ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select educator" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {staff?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                </CardContent>
              </Card>

              <div className="flex flex-col gap-3 pt-4">
                <Button type="submit" size="lg" disabled={createObservation.isPending}>
                  {createObservation.isPending ? "Saving..." : "Save Observation"}
                </Button>
                <Button variant="outline" size="lg" type="button" onClick={() => history.back()}>Cancel</Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}