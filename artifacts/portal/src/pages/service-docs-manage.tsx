import { useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  useListFileLibrary, useCreateFileLibraryItem, useDeleteFileLibraryItem,
  useListFileCategories, useCreateFileCategory,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Upload, Trash2, FileText, FileImage, File, ExternalLink, Plus } from "lucide-react";
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

type SectionProps = {
  categoryName: string;
  categoryId: number | undefined;
  files: { id: number; name: string; documentPath: string; documentName: string }[];
  onEnsureCategory: () => Promise<number>;
  onRefresh: () => void;
};

function Section({ categoryName, categoryId, files, onEnsureCategory, onRefresh }: SectionProps) {
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
      const docPath = result.objectPath;
      await createFile.mutateAsync({
        data: {
          name: label.trim() || selectedFile.name,
          documentPath: docPath,
          documentName: selectedFile.name,
          categoryId: catId,
        } as any,
      });
      toast({ title: "Document uploaded" });
      setLabel("");
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
              <Input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={adding || isUploading || !selectedFile}>
              <Upload className="h-4 w-4 mr-1" />
              {adding || isUploading ? "Uploading…" : "Upload"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="divide-y">
        {files.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground text-center">
            No documents yet — add one above.
          </p>
        ) : (
          files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-5 py-3">
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

  const loading = filesLoading || catsLoading;

  function getCatId(name: string) {
    return categories?.find((c) => c.name === name)?.id;
  }

  function getFiles(catId: number | undefined) {
    if (!catId) return [];
    return (files ?? []).filter((f) => f.categoryId === catId);
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
        <a
          href="/service-docs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:shadow-md transition-shadow shrink-0"
        >
          <ExternalLink className="h-4 w-4 text-primary" />
          Preview public page
        </a>
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
