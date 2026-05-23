import { useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  useListPolicies, useCreatePolicy, useDeletePolicy,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ClipboardList, Plus, Paperclip, Upload, X, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";

export default function Procedures() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allPolicies, isLoading } = useListPolicies();
  const createMutation = useCreatePolicy();
  const deleteMutation = useDeletePolicy();

  const procedures = (allPolicies ?? [])
    .filter((p) => p.category === "Procedures")
    .sort((a, b) => a.title.localeCompare(b.title));

  const [showSheet, setShowSheet] = useState(false);
  const [name, setName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function resetForm() {
    setName("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) { toast({ title: "Please select a PDF file", variant: "destructive" }); return; }

    let docPath = "";
    try {
      const result = await uploadFile(selectedFile);
      if (!result) throw new Error("Upload returned null");
      docPath = result.objectPath;
    } catch {
      toast({ title: "File upload failed", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      data: {
        title: name || selectedFile.name.replace(/\.[^/.]+$/, ""),
        category: "Procedures",
        documentPath: docPath,
        documentName: selectedFile.name,
        notifyRoles: "",
      } as any,
    }, {
      onSuccess: () => {
        setShowSheet(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
        toast({ title: "Procedure added" });
      },
      onError: () => toast({ title: "Failed to add procedure", variant: "destructive" }),
    });
  }

  const isSaving = createMutation.isPending || isUploading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/policies")}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Procedures</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">Operational procedure documents.</p>
          </div>
        </div>
        <Button onClick={() => setShowSheet(true)}>
          <Plus className="h-4 w-4 mr-2" />Add Procedure
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : procedures.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <ClipboardList className="h-10 w-10 mb-2 text-muted-foreground/50" />
            <p className="font-medium">No procedures added yet</p>
            <p className="text-sm">Use the button above to upload your first procedure document.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="divide-y">
            {procedures.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-3 group hover:bg-muted/20 transition-colors">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={p.documentPath ? `/api/storage${p.documentPath}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm font-medium text-primary hover:underline underline-offset-4 truncate"
                >
                  {p.title}
                </a>
                {p.documentName && (
                  <span className="text-xs text-muted-foreground hidden sm:block shrink-0">{p.documentName}</span>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete procedure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove "{p.title}" from the list.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => {
                          deleteMutation.mutate({ id: p.id }, {
                            onSuccess: () => {
                              queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
                              toast({ title: "Procedure deleted" });
                            },
                          });
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Sheet open={showSheet} onOpenChange={(v) => { setShowSheet(v); if (!v) resetForm(); }}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>Add Procedure</SheetTitle></SheetHeader>
          <form onSubmit={handleAdd} className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Medication Administration Procedure"
              />
            </div>

            <div className="space-y-1.5">
              <Label>PDF File</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              {selectedFile ? (
                <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/40 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{selectedFile.name}</span>
                  <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 w-full p-4 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-muted/40 hover:border-primary/40 transition-colors"
                >
                  <Upload className="h-4 w-4" />Click to choose a PDF or document
                </button>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setShowSheet(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" disabled={!selectedFile || isSaving}>
                {isUploading ? "Uploading…" : isSaving ? "Saving…" : "Add Procedure"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
