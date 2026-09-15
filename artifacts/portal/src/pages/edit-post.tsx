import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetPost, useUpdatePost, useListChildren, useListSites, getListPostsQueryKey, getGetPostQueryKey } from "@workspace/api-client-react";
import { useActiveStaff } from "@/hooks/use-active-staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ImagePlus, X, Loader2, Paperclip, FileText } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { useMemo } from "react";
import { MtopOutcomePicker } from "@/components/mtop-outcome-picker";

function imageUrl(path: string) {
  const stripped = path.replace(/^\/objects\//, "");
  return `/api/storage/objects/${stripped}`;
}

export default function EditPost() {
  const [, params] = useRoute("/posts/:id/edit");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const id = params?.id ? parseInt(params.id) : 0;

  const { data: post, isLoading: postLoading } = useGetPost(id, { query: { queryKey: getGetPostQueryKey(id), enabled: id > 0 } });
  const { data: sites } = useListSites();
  const { data: children } = useListChildren();
  const { data: staff } = useActiveStaff();
  const updatePost = useUpdatePost();

  const [form, setForm] = useState({
    siteId: "",
    childIds: [] as number[],
    title: "",
    date: "",
    staffId: "",
    description: "",
    learning: "",
    opportunities: "",
    outcomeIds: [] as string[],
  });
  const [images, setImages] = useState<string[]>([]);
  const [documents, setDocuments] = useState<{ path: string; name: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [initialised, setInitialised] = useState(false);
  const [notifyGuardians, setNotifyGuardians] = useState(true);

  const { uploadFile } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (post && !initialised) {
      setForm({
        siteId: post.siteId ? String(post.siteId) : "",
        childIds: post.childIds ?? [],
        title: post.title ?? "",
        date: post.date ? post.date.slice(0, 10) : "",
        staffId: post.staffId ? String(post.staffId) : "",
        description: post.description ?? "",
        learning: post.learning ?? "",
        opportunities: post.opportunities ?? "",
        outcomeIds: (post.outcomeIds ?? []).map(String),
      });
      setImages(post.images ?? []);
      const paths = post.documentPaths ?? [];
      const names = post.documentNames ?? [];
      setDocuments(paths.map((p, i) => ({ path: p, name: names[i] ?? p.split("/").pop() ?? p })));
      setInitialised(true);
    }
  }, [post, initialised]);

  const filteredChildren = useMemo(() => {
    if (!form.siteId || form.siteId === "none") return children ?? [];
    return (children ?? []).filter((c) => String(c.siteId) === form.siteId);
  }, [children, form.siteId]);

  function toggleChild(childId: number) {
    setForm((f) => ({
      ...f,
      childIds: f.childIds.includes(childId)
        ? f.childIds.filter((c) => c !== childId)
        : [...f.childIds, childId],
    }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.siteId || form.siteId === "none") e.siteId = "Site is required";
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.date) e.date = "Date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (images.length >= 3) { toast({ title: "Maximum 3 images allowed" }); return; }
    const idx = images.length;
    setUploadingIndex(idx);
    try {
      const response = await uploadFile(file);
      if (response) setImages((prev) => [...prev, response.objectPath]);
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally {
      setUploadingIndex(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleDocPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const response = await uploadFile(file);
      if (response) setDocuments((prev) => [...prev, { path: response.objectPath, name: file.name }]);
    } catch {
      toast({ title: "Document upload failed", variant: "destructive" });
    } finally {
      setUploadingDoc(false);
      if (docFileRef.current) docFileRef.current.value = "";
    }
  }

  function removeDoc(idx: number) {
    setDocuments((prev) => prev.filter((_, i) => i !== idx));
  }

  function savePost(publish: boolean) {
    if (!post) return;
    if (!validate()) return;

    const body: Record<string, unknown> = {
      title: form.title,
      date: form.date,
      images,
      documentPaths: documents.map((d) => d.path),
      documentNames: documents.map((d) => d.name),
      childIds: form.childIds,
      outcomeIds: form.outcomeIds,
    };
    if (form.siteId && form.siteId !== "none") body.siteId = parseInt(form.siteId);
    if (form.staffId && form.staffId !== "none") body.staffId = parseInt(form.staffId);
    if (form.description.trim()) body.description = form.description;
    if (form.learning.trim()) body.learning = form.learning;
    if (form.opportunities.trim()) body.opportunities = form.opportunities;
    if (publish && !post.publishedAt) {
      body.publishedAt = new Date().toISOString();
      body.notifyGuardians = notifyGuardians;
    }

    updatePost.mutate({ id, data: body as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(id) });
        toast({ title: publish && !post.publishedAt ? "Post published" : post.publishedAt ? "Post updated" : "Draft saved" });
        setLocation(publish || post.publishedAt ? `/posts/${id}` : "/posts");
      },
      onError: () => toast({ title: "Failed to update post", variant: "destructive" }),
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    savePost(Boolean(post?.publishedAt));
  }

  if (postLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16 text-muted-foreground">
        <p>Post not found.</p>
        <Button variant="link" onClick={() => setLocation("/posts")}>Back to Posts</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/posts/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Post</h1>
          <p className="text-sm text-muted-foreground">Update this learning story.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Site <span className="text-destructive">*</span></Label>
                <Select
                  value={form.siteId}
                  onValueChange={(v) => setForm({ ...form, siteId: v, childIds: [] })}
                >
                  <SelectTrigger className={errors.siteId ? "border-destructive" : ""}><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>
                    {(sites ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.siteId && <p className="text-xs text-destructive">{errors.siteId}</p>}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Children</Label>
                {filteredChildren.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    {form.siteId && form.siteId !== "none"
                      ? "No active children at this site."
                      : "Select a site to filter children."}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filteredChildren.map((c) => {
                      const selected = form.childIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleChild(c.id)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                        >
                          {c.firstName} {c.lastName}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Exploring the garden"
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
                {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Educator</Label>
                <Select
                  value={form.staffId}
                  onValueChange={(v) => setForm({ ...form, staffId: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select educator" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No educator</SelectItem>
                    {(staff ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Images <span className="text-muted-foreground font-normal text-sm">(up to 3)</span></CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-28 h-28 rounded-lg overflow-hidden border bg-muted">
                  <img src={imageUrl(img)} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {uploadingIndex !== null && (
                <div className="w-28 h-28 rounded-lg border bg-muted flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {images.length < 3 && uploadingIndex === null && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-28 h-28 rounded-lg border-2 border-dashed border-input bg-muted/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-xs">Add image</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImagePick}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {documents.map((doc, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/40">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm truncate">{doc.name}</span>
                <button type="button" onClick={() => removeDoc(idx)} className="p-0.5 rounded text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {uploadingDoc && (
              <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/40">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Uploading…</span>
              </div>
            )}
            <button
              type="button"
              disabled={uploadingDoc}
              onClick={() => docFileRef.current?.click()}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed rounded-lg px-3 py-2 w-full transition-colors hover:border-primary disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4" />
              Attach a document
            </button>
            <input ref={docFileRef} type="file" className="hidden" onChange={handleDocPick} />
          </CardContent>
        </Card>

        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <Label className="text-sm font-semibold text-primary">MTOP Outcomes</Label>
          </div>
          <p className="text-xs text-muted-foreground pl-4">Link this post to the relevant My Time Our Place learning outcomes.</p>
          <div className="pl-4">
            <MtopOutcomePicker
              value={form.outcomeIds}
              onChange={(ids) => setForm((f) => ({ ...f, outcomeIds: ids }))}
              label="MTOP Outcomes"
            />
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Content</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <Separator className="hidden" />

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={5}
                placeholder="Describe what happened during this learning experience..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>What learning is happening here?</Label>
              <Textarea
                value={form.learning}
                onChange={(e) => setForm({ ...form, learning: e.target.value })}
                rows={4}
                placeholder="Reflect on the skills, knowledge and dispositions being developed..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Opportunities and possibilities — What's next?</Label>
              <Textarea
                value={form.opportunities}
                onChange={(e) => setForm({ ...form, opportunities: e.target.value })}
                rows={4}
                placeholder="How can we extend this learning? What opportunities will we create next?..."
              />
            </div>
          </CardContent>
        </Card>

        {!post.publishedAt && (
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Notify guardians by email</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send an email to guardians when this draft is published.
                  </p>
                </div>
                <Switch checked={notifyGuardians} onCheckedChange={setNotifyGuardians} />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-end gap-3 pb-8">
          <Button type="button" variant="outline" onClick={() => setLocation(post.publishedAt ? `/posts/${id}` : "/posts")}>Cancel</Button>
          {!post.publishedAt && (
            <Button
              type="button"
              variant="secondary"
              disabled={updatePost.isPending || uploadingIndex !== null || uploadingDoc}
              onClick={() => savePost(false)}
            >
              Save Draft
            </Button>
          )}
          <Button
            type={post.publishedAt ? "submit" : "button"}
            onClick={post.publishedAt ? undefined : () => savePost(true)}
            disabled={updatePost.isPending || uploadingIndex !== null || uploadingDoc}
          >
            {updatePost.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
            ) : post.publishedAt ? "Save Changes" : "Publish Post"}
          </Button>
        </div>
      </form>
    </div>
  );
}
