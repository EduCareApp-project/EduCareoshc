import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateChild, useListSites, getListChildrenQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { ChildInputAgeGroup, ChildInputStatus } from "@workspace/api-client-react/src/generated/api.schemas";

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  enrollmentDate: z.string().min(1, "Enrollment date is required"),
  ageGroup: z.enum(["infant", "toddler", "preschool", "school_age"]),
  status: z.enum(["active", "inactive", "waitlist"]).default("active"),
  guardianName: z.string().min(1, "Guardian name is required"),
  guardianEmail: z.string().email("Invalid email address"),
  guardianPhone: z.string().min(1, "Phone number is required"),
  medicalNotes: z.string().optional(),
  siteId: z.number().optional(),
});

export default function EnrollChild() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createChild = useCreateChild();
  const { data: sites } = useListSites();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      enrollmentDate: new Date().toISOString().split('T')[0],
      ageGroup: "preschool",
      status: "active",
      guardianName: "",
      guardianEmail: "",
      guardianPhone: "",
      medicalNotes: "",
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createChild.mutate(
      { data: data as any },
      {
        onSuccess: (child) => {
          queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey() });
          toast({
            title: "Success",
            description: "Child enrolled successfully",
          });
          setLocation(`/children/${child.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to enroll child. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/children">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enroll New Child</h1>
          <p className="text-muted-foreground text-sm">Add a new child to the centre's registry.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Child Details</CardTitle>
              <CardDescription>Basic information about the child.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl><Input placeholder="Leo" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl><Input placeholder="Smith" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ageGroup"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age Group</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select age group" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="infant">Infant (0-2 yrs)</SelectItem>
                        <SelectItem value="toddler">Toddler (2-3 yrs)</SelectItem>
                        <SelectItem value="preschool">Preschool (3-5 yrs)</SelectItem>
                        <SelectItem value="school_age">School Age</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="enrollmentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enrollment Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="waitlist">Waitlist</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {sites && sites.length > 0 && (
                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Site</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}
                        value={field.value != null ? String(field.value) : ""}
                      >
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select site (optional)" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No site</SelectItem>
                          {sites.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Guardian & Medical Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="guardianName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Guardian Name</FormLabel>
                    <FormControl><Input placeholder="Jane Smith" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="guardianPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl><Input placeholder="0400 000 000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="guardianEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl><Input type="email" placeholder="jane@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="medicalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical Notes & Allergies (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="E.g. Peanut allergy, requires epipen..." className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/children">
              <Button variant="outline" type="button">Cancel</Button>
            </Link>
            <Button type="submit" disabled={createChild.isPending}>
              {createChild.isPending ? "Enrolling..." : "Enroll Child"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}