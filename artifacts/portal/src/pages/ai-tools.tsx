import React, { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  FilePlus2, Sparkles, UploadCloud, GripVertical, FileText, 
  Image as ImageIcon, ArrowUp, ArrowDown, X, Wand2, Loader2, 
  Eye, Download, Trash2, FileStack, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useRequestDocumentMergeUploadUrl,
  useListMergedDocuments,
  getListMergedDocumentsQueryKey,
  useMergeDocuments,
  useDeleteMergedDocument,
  getViewMergedDocumentUrl,
  getDownloadMergedDocumentUrl,
} from "@workspace/api-client-react";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

type FileItem = {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  objectPath?: string;
};

export default function AiTools() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const [isMerging, setIsMerging] = useState(false);
  const [mergeStatus, setMergeStatus] = useState("");
  const [mergeProgress, setMergeProgress] = useState(0);

  const { data: documents, isLoading: isLoadingDocs } = useListMergedDocuments();
  const { mutateAsync: requestUploadUrl } = useRequestDocumentMergeUploadUrl();
  const { mutateAsync: mergeDocs } = useMergeDocuments();
  const { mutate: deleteDoc } = useDeleteMergedDocument({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMergedDocumentsQueryKey() });
        toast({ title: "Document deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete document", variant: "destructive" });
      }
    }
  });

  const handleFiles = useCallback((newFiles: File[]) => {
    const validFiles = newFiles.filter(f => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      return validTypes.includes(f.type) && f.size <= 25 * 1024 * 1024;
    });
    
    if (validFiles.length < newFiles.length) {
      toast({
        title: "Some files skipped",
        description: "Only PDF, JPG, and PNG files up to 25MB are allowed.",
        variant: "destructive"
      });
    }
    
    setFiles(prev => {
      const combined = [...prev, ...validFiles.map(f => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        status: 'pending' as const
      }))];
      
      if (combined.length > 20) {
        toast({
           title: "Too many files",
           description: "A maximum of 20 files can be merged at once.",
           variant: "destructive"
        });
        return combined.slice(0, 20);
      }
      return combined;
    });
  }, [toast]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, [handleFiles]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    setFiles(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    setFiles(prev => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const totalSizeMB = files.reduce((acc, f) => acc + f.file.size, 0) / (1024 * 1024);

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({ title: "Need more files", description: "Select at least 2 files to merge.", variant: "destructive" });
      return;
    }
    if (totalSizeMB > 100) {
      toast({ title: "Size limit exceeded", description: "Total size must be under 100MB.", variant: "destructive" });
      return;
    }

    setIsMerging(true);
    setMergeProgress(5);
    setMergeStatus("Starting...");

    try {
      const objectPaths: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        
        if (item.objectPath) {
          objectPaths.push(item.objectPath);
          continue;
        }
        
        setMergeStatus(`Uploading file ${i + 1} of ${files.length}...`);
        setMergeProgress(5 + (i / files.length) * 60); 
        
        const { uploadURL, objectPath } = await requestUploadUrl({
          data: {
            name: item.file.name,
            size: item.file.size,
            contentType: item.file.type as any
          }
        });
        
        const res = await fetch(uploadURL, {
          method: 'PUT',
          headers: {
            'Content-Type': item.file.type,
          },
          body: item.file
        });
        
        if (!res.ok) {
          throw new Error(`Failed to upload ${item.file.name}`);
        }
        
        setFiles(prev => {
          const next = [...prev];
          if (next[i]) {
             next[i] = { ...next[i], status: 'uploaded', objectPath };
          }
          return next;
        });
        
        objectPaths.push(objectPath);
      }
      
      setMergeStatus("Merging documents...");
      setMergeProgress(80);
      
      await mergeDocs({
        data: {
          files: objectPaths.map(op => ({ objectPath: op }))
        }
      });
      
      setMergeProgress(100);
      setMergeStatus("Merge complete!");
      toast({ title: "Documents merged successfully!" });
      
      queryClient.invalidateQueries({ queryKey: getListMergedDocumentsQueryKey() });
      
      setTimeout(() => {
        setFiles([]);
        setIsMerging(false);
        setMergeStatus("");
        setMergeProgress(0);
      }, 1500);

    } catch (err: any) {
      setIsMerging(false);
      setMergeProgress(0);
      setMergeStatus("");
      toast({ 
        title: "Merge failed", 
        description: err.message || "An unexpected error occurred.", 
        variant: "destructive" 
      });
    }
  };

  const historyFiles = documents || [];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Tools</h1>
        <p className="text-muted-foreground mt-1 text-lg">Intelligent helpers to accelerate your daily workflows.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative p-5 rounded-xl border-2 border-primary bg-primary/5 cursor-pointer flex flex-col items-center text-center shadow-sm">
          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mb-3">
            <FilePlus2 className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-lg">Document Merge</h3>
          <p className="text-sm text-muted-foreground mt-1">Combine PDFs & images</p>
          <div className="absolute top-3 right-3">
             <span className="flex h-2.5 w-2.5 rounded-full bg-primary" title="Active tool"></span>
          </div>
        </div>
        
        <div className="relative p-5 rounded-xl border border-dashed border-muted bg-muted/10 opacity-60 cursor-not-allowed flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-muted-foreground/10 flex items-center justify-center mb-3">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-muted-foreground text-lg">Auto-Summaries</h3>
          <p className="text-sm text-muted-foreground mt-1">Coming soon</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Workspace Column */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-card border rounded-xl p-1 shadow-sm">
            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-all ${
                isDragging 
                  ? "border-primary bg-primary/5 scale-[0.99]" 
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                 <UploadCloud className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Drag & drop files to merge</h3>
              <p className="text-base text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
                Upload multiple PDFs, JPGs, or PNGs. You can reorder them before merging. 
                Maximum 20 files, up to 25MB each.
              </p>
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                variant="outline" 
                disabled={isMerging}
                className="bg-background text-foreground"
                size="lg"
              >
                Browse Files
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                multiple 
                accept="application/pdf,image/jpeg,image/png" 
                onChange={(e) => {
                  if (e.target.files) handleFiles(Array.from(e.target.files));
                  e.target.value = '';
                }} 
              />
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <h4 className="font-semibold text-lg">Files to Merge</h4>
                <span className="text-sm text-muted-foreground">{files.length} files • <span className={totalSizeMB > 100 ? "text-destructive font-medium" : ""}>{totalSizeMB.toFixed(1)} MB</span> / 100 MB</span>
              </div>
              
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={f.id} className={`flex items-center gap-3 p-3 bg-card border rounded-xl shadow-sm transition-colors ${f.status === 'uploaded' ? 'border-primary/30 bg-primary/5' : ''}`}>
                    <div className="flex flex-col gap-1 items-center justify-center opacity-40 px-1 hover:opacity-100 transition-opacity">
                       <GripVertical className="h-5 w-5" />
                    </div>
                    
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${f.file.type === 'application/pdf' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'}`}>
                      {f.file.type === 'application/pdf' ? <FileText className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium truncate text-foreground" title={f.file.name}>{f.file.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-muted-foreground">{(f.file.size / (1024*1024)).toFixed(2)} MB</p>
                        {f.status === 'uploaded' && (
                          <span className="flex items-center text-xs text-primary font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Uploaded
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0 bg-muted/50 rounded-lg p-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => moveUp(i)} disabled={i === 0 || isMerging}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => moveDown(i)} disabled={i === files.length - 1 || isMerging}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <div className="w-px h-5 bg-border mx-1" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-background hover:text-destructive" onClick={() => removeFile(i)} disabled={isMerging}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-2 flex flex-col gap-4">
                {isMerging && (
                  <div className="space-y-2 bg-muted/30 p-4 rounded-xl border">
                    <div className="flex justify-between text-sm font-medium text-foreground">
                      <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /> {mergeStatus}</span>
                      <span>{Math.round(mergeProgress)}%</span>
                    </div>
                    <Progress value={mergeProgress} className="h-2" />
                  </div>
                )}
                
                <Button 
                  onClick={handleMerge} 
                  disabled={files.length < 2 || isMerging || totalSizeMB > 100} 
                  className="w-full h-12 text-base font-semibold shadow-sm gap-2"
                >
                  {!isMerging && <Wand2 className="h-5 w-5" />} 
                  {isMerging ? "Processing..." : `Merge ${files.length} Documents`}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* History Column */}
        <div className="xl:col-span-1">
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex flex-col h-[500px] xl:h-full max-h-[800px]">
            <div className="p-5 border-b bg-muted/10 flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2 text-foreground">
                <FileStack className="h-5 w-5 text-primary" />
                Merge History
              </h2>
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-y divide-border">
                {isLoadingDocs ? (
                  <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin mb-3 opacity-50 text-primary" />
                    <p>Loading history...</p>
                  </div>
                ) : historyFiles.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <FileStack className="h-8 w-8 opacity-40" />
                    </div>
                    <p className="font-medium text-foreground mb-1">No merges yet</p>
                    <p className="text-sm">Your merged documents will appear here.</p>
                  </div>
                ) : (
                  historyFiles.map((doc: any) => (
                    <div key={doc.id} className="p-4 hover:bg-muted/30 transition-colors group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate text-foreground" title={doc.name}>
                            {doc.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                              {doc.pageCount} pages
                            </span>
                            <span>•</span>
                            <span>{timeAgo(doc.createdAt)}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-2 truncate" title={doc.sourceNames?.join(', ')}>
                            {doc.sourceNames?.length || 0} source files
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                           <a href={getViewMergedDocumentUrl(doc.id)} target="_blank" rel="noopener noreferrer">
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-background hover:text-primary">
                               <Eye className="h-4 w-4" />
                             </Button>
                           </a>
                           <a href={getDownloadMergedDocumentUrl(doc.id)} download>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-background hover:text-primary">
                               <Download className="h-4 w-4" />
                             </Button>
                           </a>
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-background hover:text-destructive" onClick={() => deleteDoc({ id: doc.id })}>
                             <Trash2 className="h-4 w-4" />
                           </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
