import { useState } from "react";
import { useGetChild, useUpdateChild, useGetChildObservations, useListSites } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ArrowLeft, Edit, Plus, User, Phone, Mail, FileText, Calendar, Clock, Heart, ThumbsDown, Smile, BookOpen, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AGE_GROUP_LABELS: Record<string, string> = { infant: "Infant", toddler: "Toddler", preschool: "Preschool", school_age: "School Age" };

function safeDate(value: string, fmt: string) {
  try {
    const d = new Date(value.length === 10 ? value + "T00:00:00" : value);
    if (isNaN(d.getTime())) return value;
    return format(d, fmt);
  } catch {
    return value;
  }
}

export default function ChildProfile() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: child, isLoading } = useGetChild(id, { query: { enabled: !!id } });
  const { data: observations, isLoading: obsLoading } = useGetChildObservations(id, { query: { enabled: !!id } });
  const { data: sites } = useListSites();
  const updateMutation = useUpdateChild();

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", dateOfBirth: "", enrollmentDate: "",
    ageGroup: "", status: "", guardianName: "", guardianEmail: "", guardianPhone: "",
    medicalNotes: "", likes: "", dislikes: "", temperament: "", background: "",
    siteId: "" as string,
  });

  function openEdit() {
    if (!child) return;
    setForm({
      firstName: child.firstName,
      lastName: child.lastName,
      dateOfBirth: child.dateOfBirth,
      enrollmentDate: child.enrollmentDate,
      ageGroup: child.ageGroup,
      status: child.status,
      guardianName: child.guardianName,
      guardianEmail: child.guardianEmail,
      guardianPhone: child.guardianPhone,
      medicalNotes: child.medicalNotes ?? "",
      likes: child.likes ?? "",
      dislikes: child.dislikes ?? "",
      temperament: child.temperament ?? "",
      background: child.background ?? "",
      siteId: child.siteId != null ? String(child.siteId) : "",
    });
    setEditOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, unknown> = { ...form };
    if (!data.medicalNotes) delete data.medicalNotes;
    if (!data.likes) delete data.likes;
    if (!data.dislikes) delete data.dislikes;
    if (!data.temperament) delete data.temperament;
    if (!data.background) delete data.background;
    data.siteId = form.siteId ? parseInt(form.siteId) : null;
    updateMutation.mutate({ id, data: data as any }, {
      onSuccess: () => {
        setEditOpen(false);
        queryClient.invalidateQueries({ queryKey: [`/api/children/${id}`] });
        toast({ title: "Profile updated" });
      },
      onError: () => toast({ title: "Failed to save changes", variant: "destructive" }),
    });
  }

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  if (!child) {
    return <div>Child not found</div>;
  }

  const hasProfileInfo = child.likes || child.dislikes || child.temperament || child.background;
  const assignedSite = sites?.find((s) => s.id === child.siteId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/children">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
              {child.firstName[0]}{child.lastName[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-none">{child.firstName} {child.lastName}</h1>
              <div className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                <Badge variant={child.status === "active" ? "default" : "secondary"} className="capitalize">{child.status}</Badge>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={openEdit}>
            <Edit className="h-4 w-4 mr-2" />Edit Profile
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {assignedSite && (
                <>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-2"><Building2 className="h-4 w-4" />Site</div>
                    <p className="font-medium">{assignedSite.name}</p>
                  </div>
                  <Separator />
                </>
              )}
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" />Date of Birth</div>
                <p className="font-medium">{safeDate(child.dateOfBirth, "MMMM d, yyyy")}</p>
              </div>
              <Separator />
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><User className="h-4 w-4" />Guardian</div>
                <p className="font-medium">{child.guardianName}</p>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4" />Phone</div>
                <p className="font-medium">{child.guardianPhone}</p>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" />Email</div>
                <p className="font-medium">{child.guardianEmail}</p>
              </div>
              {child.medicalNotes && (
                <>
                  <Separator />
                  <div className="space-y-1 bg-destructive/10 p-3 rounded-md border border-destructive/20 text-destructive">
                    <div className="text-sm font-semibold">Medical Notes</div>
                    <p className="text-sm">{child.medicalNotes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {hasProfileInfo && (
            <Card>
              <CardHeader><CardTitle className="text-base">Child Profile</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {child.temperament && (
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-2"><Smile className="h-4 w-4" />Temperament</div>
                    <p className="text-sm leading-relaxed">{child.temperament}</p>
                  </div>
                )}
                {child.background && (
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-2"><BookOpen className="h-4 w-4" />Background</div>
                    <p className="text-sm leading-relaxed">{child.background}</p>
                  </div>
                )}
                {child.likes && (
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-2"><Heart className="h-4 w-4 text-rose-500" />Likes</div>
                    <p className="text-sm leading-relaxed">{child.likes}</p>
                  </div>
                )}
                {child.dislikes && (
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-2"><ThumbsDown className="h-4 w-4 text-slate-400" />Dislikes</div>
                    <p className="text-sm leading-relaxed">{child.dislikes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!hasProfileInfo && (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                <Smile className="h-6 w-6 mx-auto mb-2 opacity-40" />
                <p>No profile info added yet.</p>
                <Button variant="link" size="sm" className="mt-1 h-auto p-0" onClick={openEdit}>Add likes, dislikes & more</Button>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-5 w-5" />Learning Observations</CardTitle>
            <Link href={`/observations/new?childId=${child.id}`}>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Observation</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {obsLoading ? (
              <div className="space-y-3 mt-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : !observations || observations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg mt-4">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>No observations recorded yet</p>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {observations.map((obs) => (
                  <Link key={obs.id} href={`/observations/${obs.id}`}>
                    <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-colors cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium group-hover:text-primary transition-colors">{obs.title}</h4>
                        <span className="text-xs text-muted-foreground">{safeDate(obs.observationDate, "MMM d, yyyy")}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{obs.description}</p>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {obs.outcomeIds.map(oid => (
                          <Badge key={oid} variant="outline" className="bg-primary/5 text-xs text-primary border-primary/20">
                            Outcome {oid}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Child Profile</DialogTitle></DialogHeader>
          <form onSubmit={handleSave}>
            <Tabs defaultValue="details">
              <TabsList className="mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="guardian">Guardian</TabsTrigger>
                <TabsTrigger value="profile">Profile Info</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>First Name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
                  <div className="space-y-1"><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
                </div>
                <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="waitlist">Waitlist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Site</Label>
                  <Select value={form.siteId || "none"} onValueChange={(v) => setForm({ ...form, siteId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="No site assigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No site</SelectItem>
                      {sites?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Medical Notes</Label><Textarea value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} rows={3} placeholder="Allergies, conditions, medications..." /></div>
              </TabsContent>

              <TabsContent value="guardian" className="space-y-4">
                <div className="space-y-1"><Label>Guardian Name</Label><Input value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Guardian Email</Label><Input type="email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Guardian Phone</Label><Input value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} required /></div>
              </TabsContent>

              <TabsContent value="profile" className="space-y-4">
                <p className="text-sm text-muted-foreground">This information helps educators understand and support the child's learning and wellbeing.</p>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><Smile className="h-4 w-4" />Temperament</Label>
                  <Textarea value={form.temperament} onChange={(e) => setForm({ ...form, temperament: e.target.value })} rows={3} placeholder="e.g. Calm and observant, takes time to warm up, energetic and social..." />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><BookOpen className="h-4 w-4" />Background</Label>
                  <Textarea value={form.background} onChange={(e) => setForm({ ...form, background: e.target.value })} rows={3} placeholder="Cultural background, family structure, languages spoken at home, prior care experience..." />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><Heart className="h-4 w-4 text-rose-500" />Likes</Label>
                  <Textarea value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value })} rows={3} placeholder="e.g. Dinosaurs, painting, outdoor play, listening to stories..." />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><ThumbsDown className="h-4 w-4 text-slate-400" />Dislikes</Label>
                  <Textarea value={form.dislikes} onChange={(e) => setForm({ ...form, dislikes: e.target.value })} rows={3} placeholder="e.g. Loud noises, sand textures, transitions between activities..." />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
