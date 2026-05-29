import { useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  useListFileLibrary, useCreateFileLibraryItem, useDeleteFileLibraryItem,
  useListFileCategories, useCreateFileCategory, useUpdateFileCategory, useDeleteFileCategory,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FolderOpen, Plus, Upload, Paperclip, Trash2, Settings, ArrowLeft, Pencil, Check, X, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";

export default function FileLibrary() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files, isLoading: filesLoading } = useListFileLibrary();
  const { data: categories, isLoading: catsLoading } = useListFileCategories();

  const createFileMutation = useCreateFileLibraryItem();
  const deleteFileMutation = useDeleteFileLibraryItem();
  const createCatMutation = useCreateFileCategory();
  const updateCatMutation = useUpdateFileCategory();
  const deleteCatMutation = useDeleteFileCategory();

  const [showAddFile, setShowAddFile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Add file form
  const [addForm, setAddForm] = useState({ name: "", categoryId: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Category settings
  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState("");

  function resetAddForm() {
    setAddForm({ name: "", categoryId: "" });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAddFile(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) { toast({ title: "Please select a file", variant: "destructive" }); return; }

    const result = await uploadFile(selectedFile);
    if (!result) {
      toast({ title: "File upload failed", variant: "destructive" });
      return;
    }
    const docPath = result.objectPath;

    const payload: Record<string, unknown> = {
      name: addForm.name || selectedFile.name,
      documentPath: docPath,
      documentName: selectedFile.name,
    };
    if (addForm.categoryId) payload.categoryId = parseInt(addForm.categoryId);

    createFileMutation.mutate({ data: payload as any }, {
      onSuccess: () => {
        setShowAddFile(false);
        resetAddForm();
        queryClient.invalidateQueries({ queryKey: ["/api/file-library"] });
        toast({ title: "File added" });
      },
      onError: () => toast({ title: "Failed to add file", variant: "destructive" }),
    });
  }

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    createCatMutation.mutate({ data: { name: newCatName.trim(), sortOrder: (categories ?? []).length } }, {
      onSuccess: () => {
        setNewCatName("");
        queryClient.invalidateQueries({ queryKey: ["/api/file-categories"] });
        queryClient.invalidateQueries({ queryKey: ["/api/file-library"] });
        toast({ title: "Category added" });
      },
    });
  }

  function handleRenameCategory(id: number) {
    if (!editingCatName.trim()) return;
    updateCatMutation.mutate({ id, data: { name: editingCatName.trim() } }, {
      onSuccess: () => {
        setEditingCatId(null);
        queryClient.invalidateQueries({ queryKey: ["/api/file-categories"] });
        queryClient.invalidateQueries({ queryKey: ["/api/file-library"] });
      },
    });
  }

  // Group files by category
  const uncategorised = (files ?? []).filter((f) => !f.categoryId);
  const byCat: Record<number, typeof files> = {};
  for (const f of files ?? []) {
    if (f.categoryId) {
      if (!byCat[f.categoryId]) byCat[f.categoryId] = [];
      byCat[f.categoryId]!.push(f);
    }
  }

  const isLoading = filesLoading || catsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/policies")}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">File Library</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">Shared documents organised by category.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />Categories
          </Button>
          <Button onClick={() => setShowAddFile(true)}>
            <Plus className="h-4 w-4 mr-2" />Add File
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (files ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <FolderOpen className="h-10 w-10 mb-2 text-muted-foreground/50" />
            <p className="font-medium">File library is empty</p>
            <p className="text-sm">Upload your first file using the button above. Create categories in settings to organise them.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Categorised files */}
          {(categories ?? []).map((cat) => {
            const catFiles = byCat[cat.id] ?? [];
            if (catFiles.length === 0) return null;
            return (
              <div key={cat.id} className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">{cat.name}</h2>
                <Card>
                  <div className="divide-y">
                    {catFiles.map((f) => (
                      <FileRow key={f.id} file={f} onDelete={() => {
                        deleteFileMutation.mutate({ id: f.id }, {
                          onSuccess: () => {
                            queryClient.invalidateQueries({ queryKey: ["/api/file-library"] });
                            toast({ title: "File deleted" });
                          },
                        });
                      }} />
                    ))}
                  </div>
                </Card>
              </div>
            );
          })}

          {/* Uncategorised */}
          {uncategorised.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">Uncategorised</h2>
              <Card>
                <div className="divide-y">
                  {uncategorised.map((f) => (
                    <FileRow key={f.id} file={f} onDelete={() => {
                      deleteFileMutation.mutate({ id: f.id }, {
                        onSuccess: () => {
                          queryClient.invalidateQueries({ queryKey: ["/api/file-library"] });
                          toast({ title: "File deleted" });
                        },
                      });
                    }} />
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Add File Sheet */}
      <Sheet open={showAddFile} onOpenChange={(v) => { setShowAddFile(v); if (!v) resetAddForm(); }}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>Add File</SheetTitle></SheetHeader>
          <form onSubmit={handleAddFile} className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>File</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              {selectedFile ? (
                <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/40 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{selectedFile.name}</span>
                  <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 w-full p-4 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-muted/40 hover:border-primary/40 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Click to choose a file
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fileName">Display Name</Label>
              <Input
                id="fileName"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder={selectedFile?.name ?? "Name shown in the library…"}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={addForm.categoryId} onValueChange={(v) => setAddForm({ ...addForm, categoryId: v })}>
                <SelectTrigger><SelectValue placeholder="Select category (optional)" /></SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setShowAddFile(false); resetAddForm(); }}>Cancel</Button>
              <Button type="submit" disabled={!selectedFile || isUploading || createFileMutation.isPending}>
                {isUploading ? "Uploading…" : "Add File"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Category Settings Sheet */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>Manage Categories</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New category name…"
                className="flex-1"
              />
              <Button type="submit" disabled={!newCatName.trim() || createCatMutation.isPending}>Add</Button>
            </form>

            <div className="space-y-1">
              {(categories ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 italic">No categories yet.</p>
              ) : (
                (categories ?? []).map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/30 group">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    {editingCatId === cat.id ? (
                      <>
                        <Input
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          className="flex-1 h-7 text-sm"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleRenameCategory(cat.id); } if (e.key === "Escape") setEditingCatId(null); }}
                        />
                        <button type="button" onClick={() => handleRenameCategory(cat.id)} className="text-green-600 hover:text-green-700">
                          <Check className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setEditingCatId(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">{cat.name}</span>
                        <button
                          type="button"
                          onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button type="button" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete category?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Files in "{cat.name}" will become uncategorised. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => {
                                  deleteCatMutation.mutate({ id: cat.id }, {
                                    onSuccess: () => {
                                      queryClient.invalidateQueries({ queryKey: ["/api/file-categories"] });
                                      queryClient.invalidateQueries({ queryKey: ["/api/file-library"] });
                                    },
                                  });
                                }}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FileRow({
  file,
  onDelete,
}: {
  file: { id: number; name: string; documentPath: string; documentName: string; createdAt: string };
  onDelete: () => void;
}) {
  return (
    <div className="px-5 py-3 flex items-center gap-3 group hover:bg-muted/20 transition-colors">
      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <a
          href={`/api/storage${file.documentPath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:underline underline-offset-4 truncate block"
        >
          {file.name}
        </a>
        <p className="text-xs text-muted-foreground mt-0.5">{file.documentName} · Added {format(new Date(file.createdAt), "dd/MM/yyyy")}</p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{file.name}" from the library. The uploaded file will remain in storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
