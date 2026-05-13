import { useListNqsAreas, useUpdateNqsArea, getListNqsAreasQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function NqsCompliance() {
  const { data: areas, isLoading } = useListNqsAreas();
  const updateArea = useUpdateNqsArea();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<any>("");
  const [editNotes, setEditNotes] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleEdit = (area: any) => {
    setEditingId(area.id);
    setEditStatus(area.status);
    setEditNotes(area.notes || "");
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!editingId) return;
    updateArea.mutate(
      { id: editingId, data: { status: editStatus, notes: editNotes } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNqsAreasQueryKey() });
          toast({ title: "Updated", description: "NQS Area updated successfully." });
          setIsOpen(false);
        }
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'exceeding': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'meeting': return 'bg-green-100 text-green-800 border-green-200';
      case 'working_towards': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">NQS Compliance</h1>
        <p className="text-muted-foreground mt-1">Track and manage National Quality Standard compliance.</p>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Quality Area</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exceeding">Exceeding</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="working_towards">Working Towards</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Review Notes</label>
              <Textarea 
                value={editNotes} 
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add evidence or areas for improvement..."
                rows={4}
              />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={updateArea.isPending}>
              {updateArea.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {isLoading ? (
          [1,2,3,4,5,6,7].map(i => <Skeleton key={i} className="h-24 w-full" />)
        ) : (
          areas?.map(area => (
            <Card key={area.id}>
              <CardHeader className="py-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">QA {area.number}: {area.title}</CardTitle>
                    <CardDescription className="mt-1">{area.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`capitalize ${getStatusColor(area.status)}`}>
                      {area.status.replace('_', ' ')}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(area)}>
                      Update
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {area.notes && (
                <CardContent className="pb-4 pt-0">
                  <div className="bg-accent/50 p-3 rounded-md text-sm">
                    <span className="font-semibold block mb-1">Notes:</span>
                    {area.notes}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}