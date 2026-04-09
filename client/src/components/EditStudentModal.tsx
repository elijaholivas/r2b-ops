import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect, useState } from "react";

interface Student {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
}

interface EditStudentModalProps {
  open: boolean;
  onClose: () => void;
  student: Student;
  onSaved: () => void;
}

export default function EditStudentModal({ open, onClose, student, onSaved }: EditStudentModalProps) {
  const [firstName, setFirstName] = useState(student.firstName);
  const [lastName, setLastName] = useState(student.lastName);
  const [email, setEmail] = useState(student.email);
  const [phone, setPhone] = useState(student.phone ?? "");
  const [notes, setNotes] = useState(student.notes ?? "");

  useEffect(() => {
    setFirstName(student.firstName);
    setLastName(student.lastName);
    setEmail(student.email);
    setPhone(student.phone ?? "");
    setNotes(student.notes ?? "");
  }, [student]);

  const utils = trpc.useUtils();
  const updateMutation = trpc.students.update.useMutation({
    onSuccess: () => {
      toast.success("Student profile updated");
      utils.students.get.invalidate({ id: student.id });
      utils.enrollments.forClass.invalidate();
      onSaved();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update student");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("First name, last name, and email are required");
      return;
    }
    updateMutation.mutate({
      id: student.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#1e1e1e] border-[#333] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Student Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-gray-300 text-sm">First Name *</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-[#2a2a2a] border-[#444] text-white"
                placeholder="First name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-300 text-sm">Last Name *</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-[#2a2a2a] border-[#444] text-white"
                placeholder="Last name"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300 text-sm">Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#2a2a2a] border-[#444] text-white"
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300 text-sm">Phone</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-[#2a2a2a] border-[#444] text-white"
              placeholder="(555) 555-5555"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300 text-sm">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-[#2a2a2a] border-[#444] text-white resize-none"
              placeholder="Internal notes about this student..."
              rows={3}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-[#444] text-gray-300 hover:bg-[#2a2a2a]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1 bg-[#c0392b] hover:bg-[#a93226] text-white"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
