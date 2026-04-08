import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  classId: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DuplicateClassModal({ classId, open, onClose, onSuccess }: Props) {
  const { data: cls, isLoading: loadingClass } = trpc.classes.get.useQuery({ id: classId });
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const duplicate = trpc.classes.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success(`Class duplicated — new class #${data.id} created`);
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!newStart || !newEnd) {
      toast.error("Please enter both start and end date/time");
      return;
    }
    if (new Date(newEnd) <= new Date(newStart)) {
      toast.error("End time must be after start time");
      return;
    }
    duplicate.mutate({
      id: classId,
      newStartDatetime: new Date(newStart).toISOString(),
      newEndDatetime: new Date(newEnd).toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Duplicate Class
          </DialogTitle>
        </DialogHeader>

        {loadingClass ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <p className="text-sm text-foreground font-medium">{cls?.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A new class will be created with the same settings, capacity, and location — but no enrolled students.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">New Start Date &amp; Time</Label>
              <Input
                type="datetime-local"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">New End Date &amp; Time</Label>
              <Input
                type="datetime-local"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={duplicate.isPending || loadingClass || !newStart || !newEnd}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {duplicate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Copy className="h-4 w-4 mr-1.5" />
            )}
            Duplicate Class
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
