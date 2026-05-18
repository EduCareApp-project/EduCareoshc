import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateProgram, useListOutcomes, getListProgramsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { melbourneDateStr } from "@/lib/timezone";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  status: z.enum(["planned", "active", "completed"]).default("planned"),
  outcomeIds: z.array(z.number()).min(1, "Select at least one MTOP outcome"),
});

export default function NewProgram() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createProgram = useCreateProgram();
  const { data: outcomes } = useListOutcomes();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      startDate: melbourneDateStr(),
      endDate: "",
      status: "planned",
      outcomeIds: [],
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createProgram.mutate(
      { data: data as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProgramsQueryKey() });
          toast({ title: "Success", description: "Program created successfully" });
          setLocation("/programs");
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create program.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/programs"><Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Educational Program</h1>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Program Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Program Title</FormLabel><FormControl><Input placeholder="E.g. Spring Nature Exploration" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description & Goals</FormLabel><FormControl><Textarea rows={4} placeholder="Describe the program's objectives..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem><FormLabel>End Date (Optional)</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>MTOP Learning Outcomes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="outcomeIds" render={() => (
                <FormItem>
                  <div className="mb-4"><FormLabel className="text-base">MTOP Learning Outcomes</FormLabel></div>
                  <div className="space-y-2">
                    {outcomes?.map((outcome) => (
                      <FormField key={outcome.id} control={form.control} name="outcomeIds" render={({ field }) => (
                        <FormItem key={outcome.id} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-card">
                          <FormControl>
                            <Checkbox 
                              checked={field.value?.includes(outcome.id)} 
                              onCheckedChange={(checked) => {
                                return checked 
                                  ? field.onChange([...field.value, outcome.id])
                                  : field.onChange(field.value?.filter((val) => val !== outcome.id))
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer leading-tight">
                            <span className="font-semibold block mb-0.5">Outcome {outcome.number}: {outcome.title}</span>
                            <span className="text-muted-foreground text-xs">{outcome.description}</span>
                          </FormLabel>
                        </FormItem>
                      )} />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/programs"><Button variant="outline" type="button">Cancel</Button></Link>
            <Button type="submit" disabled={createProgram.isPending}>Save Program</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}