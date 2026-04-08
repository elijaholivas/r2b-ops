import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UserMinus, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  enrollmentId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RemoveStudentDialog({ open, enrollmentId, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState("");

  const removeMutation = trpc.enrollments.remove.useMutation({
    onSuccess: () => {
      toast.success("Student removed from class");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to remove student");
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="bg-card border-border text-foreground max-w-md w-full mx-4">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground">
            <UserMinus className="h-5 w-5 text-red-400" />
            Remove Student
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            This will remove the student from the class and free up their seat. This action is logged.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5 py-2">
          <Label className="text-sm text-foreground">Reason <span className="text-muted-foreground">(optional)</span></Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Student requested cancellation"
            className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none"
            rows={2}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onClose}
            className="bg-secondary border-border text-foreground hover:bg-secondary/80"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => removeMutation.mutate({ enrollmentId, reason: reason || undefined })}
            disabled={removeMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white border-0"
          >
            {removeMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Removing...</>
            ) : (
              "Remove Student"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
