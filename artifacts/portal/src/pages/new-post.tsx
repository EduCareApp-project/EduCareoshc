import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreatePost, useListChildren, useListStaff, useListSites, getListPostsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ImagePlus, X, Loader2 } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { useMemo } from "react";

const EMPTY_FORM = {
  siteId: "",
  childIds: [] as number[],
  title: "",
  date: new Date().toISOString().split("T")[0],
  staffId: "",
  description: "",
  learning: "",
  opportunities: "",
};

export default function NewPost() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sites } = useListSites();
  const { data: children } = useListChildren();
  const { data: staff } = useListStaff();
  const createPost = useCreatePost();

  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [images, setImages] = useState<string[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const { uploadFile } = useUpload({ prefix: "posts/" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredChildren = useMemo(() => {
    if (!form.siteId || form.siteId === "none") return children ?? [];
    return (children ?? []).filter((c) => String(c.siteId) === form.siteId);
  }, [children, form.siteId]);

  function toggleChild(id: number) {
    setForm((f) => ({
      ...f,
      childIds: f.childIds.includes(id) ? f.childIds.filter((c) => c !== id) : [...f.childIds, id],
    }));
  }

  function validate() {
    const e: Record<string, string> = {};
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
      const path = await uploadFile(file);
      setImages((prev) => [...prev, path]);
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

  function imageUrl(path: string) {
    const stripped = path.replace(/^\/objects\//, "");
    return `/api/storage/objects/${stripped}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const body: Record<string, unknown> = {
      title: form.title,
      date: form.date,
      images,
      childIds: form.childIds,
    };
    if (form.siteId && form.siteId !== "none") body.siteId = parseInt(form.siteId);
    if (form.staffId && form.staffId !== "none") body.staffId = parseInt(form.staffId);
    if (form.description.trim()) body.description = form.description;
    if (form.learning.trim()) body.learning = form.learning;
    if (form.opportunities.trim()) body.opportunities = form.opportunities;

    createPost.mutate({ data: body as any }, {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        toast({ title: "Post created", description: "AI summary generated automatically." });
        setLocation(`/posts/${created.id}`);
      },
      onError: () => toast({ title: "Failed to create post", variant: "destructive" }),
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/posts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Post</h1>
          <p className="text-sm text-muted-foreground">Document a learning story to share with families.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Site</Label>
                <Select
                  value={form.siteId}
                  onValueChange={(v) => setForm({ ...form, siteId: v, childIds: [] })}
                >
                  <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All sites</SelectItem>
                    {(sites ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Children</Label>
                {filteredChildren.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    {form.siteId && form.siteId !== "none" ? "No active children at this site." : "Select a site to filter children, or all children will be shown once a site has children enrolled."}
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
          <CardHeader><CardTitle className="text-base">Content</CardTitle></CardHeader>
          <CardContent className="space-y-5">
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

        <div className="flex items-center justify-end gap-3 pb-8">
          <Button type="button" variant="outline" onClick={() => setLocation("/posts")}>Cancel</Button>
          <Button type="submit" disabled={createPost.isPending || uploadingIndex !== null}>
            {createPost.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving & generating summary…</>
            ) : "Publish Post"}
          </Button>
        </div>
      </form>
    </div>
  );
}
