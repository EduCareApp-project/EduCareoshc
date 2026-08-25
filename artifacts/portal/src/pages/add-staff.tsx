import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateStaff, useListSites, getListStaffQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useStaffRoles } from "@/hooks/use-staff-roles";

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  role: z.string().min(1, "Role is required"),
  qualifications: z.string().min(1, "Qualifications are required"),
  status: z.enum(["active", "inactive"]).default("active"),
  phone: z.string().optional(),
  wwccNumber: z.string().optional(),
  siteId: z.string().optional(),
});

export default function AddStaff() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createStaff = useCreateStaff();
  const { data: sites } = useListSites();
  const staffRoles = useStaffRoles();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      role: "educator" as const,
      qualifications: "Diploma of Early Childhood Education",
      status: "active",
      phone: "",
      wwccNumber: "",
      siteId: "none",
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    const { siteId, ...rest } = data;
    const payload = {
      ...rest,
      ...(siteId && siteId !== "none" ? { siteId: parseInt(siteId, 10) } : {}),
    };
    createStaff.mutate(
      { data: payload as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
          toast({ title: "Success", description: "Staff member added successfully" });
          setLocation("/staff");
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to add staff member.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/staff"><Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Staff Member</h1>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Staff Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone (Optional)</FormLabel><FormControl><Input type="text" autoComplete="tel" placeholder="e.g. 0412 345 678" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem><FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {staffRoles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="siteId" render={({ field }) => (
                <FormItem><FormLabel>Site (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="No site assigned" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">No site assigned</SelectItem>
                      {(sites ?? []).map((site) => (
                        <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="qualifications" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>Qualifications</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="wwccNumber" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>WWCC Number (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>
          <div className="flex justify-end gap-4">
            <Link href="/staff"><Button variant="outline" type="button">Cancel</Button></Link>
            <Button type="submit" disabled={createStaff.isPending}>Save Staff Member</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
