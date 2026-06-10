import { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListFileLibrary, useCreateFileLibraryItem, useDeleteFileLibraryItem,
  useListFileCategories, useCreateFileCategory, useListSites,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Upload, Trash2, FileText, FileImage, File, ExternalLink, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";

const PUBLIC_CATEGORIES = ["Prescribed Information", "Parent Notices"] as const;

function fileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function FileIcon({ name }: { name: string }) {
  const ext = fileExt(name);
  if (["jpg","jpeg","png","gif","webp","svg"].includes(ext))
    return <FileImage className="h-5 w-5 text-blue-500 shrink-0" />;
  if (ext === "pdf")
    return <FileText className="h-5 w-5 text-red-500 shrink-0" />;
  return <File className="h-5 w-5 text-muted-foreground shrink-0" />;
}

type FileItem = {
  id: number;
  name: string;
  documentPath: string;
  documentName: string;
  siteId?: number | null;
  position?: number | null;
};

async function patchFilePosition(id: number, position: number) {
  const r = await fetch(`/api/file-library/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ position }),
  });
  if (!r.ok) throw new Error(`PATCH failed: ${r.status}`);
}

type SectionProps = {
  categoryName: string;
  categoryId: number | undefined;
  files: FileItem[];
  siteId: number | null;
  onEnsureCategory: () => Promise<number>;
  onRefresh: () => void;
};

function Section({ categoryName, categoryId, files, siteId, onEnsureCategory, onRefresh }: SectionProps) {
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [position, setPosition] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [reordering, setReordering] = useState(false);

  const createFile = useCreateFileLibraryItem();
  const deleteFile = useDeleteFileLibraryItem();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
    if (f && !label) setLabel(f.name.replace(/\.[^.]+$/, ""));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) { toast({ title: "Please choose a file", variant: "destructive" }); return; }
    setAdding(true);
    try {
      const catId = categoryId ?? await onEnsureCategory();
      const result = await uploadFile(selectedFile);
      if (!result) throw new Error("Upload failed");
      const payload: Record<string, unknown> = {
        name: label.trim() || selectedFile.name,
        documentPath: result.objectPath,
        documentName: selectedFile.name,
        categoryId: catId,
      };
      if (siteId) payload.siteId = siteId;
      if (position.trim() !== "") payload.position = parseInt(position, 10);
      await createFile.mutateAsync({ data: payload as any });
      toast({ title: "Document uploaded" });
      setLabel("");
      setPosition("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowForm(false);
      onRefresh();
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  function handleDelete(id: number) {
    deleteFile.mutate({ id }, {
      onSuccess: () => { toast({ title: "Document removed" }); onRefresh(); },
      onError: () => toast({ title: "Failed to remove document", variant: "destructive" }),
    });
  }

  async function move(index: number, direction: "up" | "down") {
    const sorted = [...files].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;
    setReordering(true);
    try {
      // Swap the two items in the array, then write sequential positions
      // (0, 1, 2 …) to every item. This ensures the move always works
      // even when multiple items share the same stored position value.
      const reordered = [...sorted];
      [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
      await Promise.all(reordered.map((f, i) => patchFilePosition(f.id, i)));
      onRefresh();
    } catch {
      toast({ title: "Failed to reorder", variant: "destructive" });
    } finally {
      setReordering(false);
    }
  }

  const sorted = [...files].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <div className="rounded-xl border bg-white">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h2 className="text-base font-semibold">{categoryName}</h2>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Add document
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleUpload} className="px-5 py-4 border-b bg-muted/30 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Display name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="Leave blank to use filename"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>File</Label>
              <Input ref={fileInputRef} type="file" onChange={handleFileChange} className="cursor-pointer" />
            </div>
          </div>
          <div className="space-y-1 max-w-[160px]">
            <Label>
              Position <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              type="number"
              min={0}
              placeholder="Auto"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Lower = shown first. Leave blank to add at the end.</p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={adding || isUploading || !selectedFile}>
              <Upload className="h-4 w-4 mr-1" />
              {adding || isUploading ? "Uploading…" : "Upload"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setShowForm(false); setLabel(""); setPosition(""); setSelectedFile(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="divide-y">
        {sorted.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground text-center">
            No documents yet — add one above.
          </p>
        ) : (
          sorted.map((f, idx) => (
            <div key={f.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => move(idx, "up")}
                  disabled={idx === 0 || reordering}
                  className="rounded p-0.5 hover:bg-muted disabled:opacity-20 disabled:cursor-default transition-colors"
                  title="Move up"
                >
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => move(idx, "down")}
                  disabled={idx === sorted.length - 1 || reordering}
                  className="rounded p-0.5 hover:bg-muted disabled:opacity-20 disabled:cursor-default transition-colors"
                  title="Move down"
                >
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <FileIcon name={f.documentName} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground truncate">{f.documentName}</p>
              </div>
              <a
                href={`/api/storage/objects${f.documentPath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline shrink-0"
              >
                View
              </a>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove document?</AlertDialogTitle>
                    <AlertDialogDescription>
                      "{f.name}" will be removed from the public Service Documentation page.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(f.id)} className="bg-destructive text-white hover:bg-destructive/90">
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ServiceDocsManage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const createCat = useCreateFileCategory();

  const { data: files, isLoading: filesLoading } = useListFileLibrary();
  const { data: categories, isLoading: catsLoading } = useListFileCategories();
  const { data: sites } = useListSites();

  const [selectedSiteId, setSelectedSiteId] = useState<string>("");

  useEffect(() => {
    if (sites && sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(String(sites[0].id));
    }
  }, [sites, selectedSiteId]);

  const loading = filesLoading || catsLoading;

  const activeSiteId: number | null =
    selectedSiteId ? parseInt(selectedSiteId) : null;

  function getCatId(name: string) {
    return categories?.find((c) => c.name === name)?.id;
  }

  function getFiles(catId: number | undefined): FileItem[] {
    if (!catId) return [];
    return (files ?? [])
      .filter((f) => f.categoryId === catId)
      .filter((f) => !activeSiteId || f.siteId === activeSiteId);
  }

  async function ensureCategory(name: string): Promise<number> {
    const existing = categories?.find((c) => c.name === name);
    if (existing) return existing.id;
    const result = await createCat.mutateAsync({
      data: { name, sortOrder: (categories ?? []).length },
    });
    queryClient.invalidateQueries({ queryKey: ["/api/file-categories"] });
    return (result as any).id;
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["/api/file-library"] });
    queryClient.invalidateQueries({ queryKey: ["/api/file-categories"] });
  }

  const previewUrl = activeSiteId ? `/service-docs?siteId=${activeSiteId}` : "/service-docs";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/policies")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Service Documentation</h1>
            <p className="text-muted-foreground mt-0.5">
              Manage documents shown on the public Service Documentation page.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {sites && sites.length > 1 && (
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger className="h-9 text-sm w-auto min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:shadow-md transition-shadow shrink-0"
          >
            <ExternalLink className="h-4 w-4 text-primary" />
            Preview public page
          </a>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          {PUBLIC_CATEGORIES.map((catName) => {
            const catId = getCatId(catName);
            return (
              <Section
                key={catName}
                categoryName={catName}
                categoryId={catId}
                files={getFiles(catId)}
                siteId={activeSiteId}
                onEnsureCategory={() => ensureCategory(catName)}
                onRefresh={refresh}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
