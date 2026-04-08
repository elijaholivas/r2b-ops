import { useState } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UserPlus, AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";

const schema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  paymentStatus: z.enum(["paid", "unpaid", "free"]).default("unpaid"),
  sendConfirmation: z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  classId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddStudentModal({ open, classId, onClose, onSuccess }: Props) {
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);

  const { register, handleSubmit, watch, getValues, setValue, formState: { errors } } = useForm<FormData>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { paymentStatus: "unpaid", sendConfirmation: false },
  });

  const addMutation = trpc.enrollments.add.useMutation({
    onSuccess: () => {
      toast.success("Student added successfully");
      onSuccess();
    },
    onError: (err) => {
      if (err.message === "DUPLICATE_ENROLLMENT") {
        setDuplicateDetected(true);
        setPendingData(getValues());
      } else {
        toast.error(err.message || "Failed to add student");
      }
    },
  });

  const onSubmit = (data: FormData) => {
    setDuplicateDetected(false);
    addMutation.mutate({ classId, ...data, overrideDuplicate: false });
  };

  const handleOverride = () => {
    if (pendingData) {
      addMutation.mutate({ classId, ...pendingData, overrideDuplicate: true } as any);
    }
  };

  const paymentStatus = watch("paymentStatus");
  const sendConfirmation = watch("sendConfirmation");

  const PAYMENT_COLORS: Record<string, string> = {
    paid: "text-green-400",
    unpaid: "text-amber-400",
    free: "text-blue-400",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-md w-full mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <UserPlus className="h-5 w-5 text-primary" />
            Add Student
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Manually enroll a student in this class
          </DialogDescription>
        </DialogHeader>

        {duplicateDetected && (
          <Alert className="border-amber-700/50 bg-amber-900/20">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-300 text-sm">
              This student is already enrolled in this class. Do you want to add them again?
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={handleOverride}
                  disabled={addMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Override & Add"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDuplicateDetected(false)} className="text-muted-foreground">
                  Cancel
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">First Name</Label>
              <Input
                {...register("firstName")}
                placeholder="Jane"
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
              {errors.firstName && <p className="text-xs text-red-400">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Last Name</Label>
              <Input
                {...register("lastName")}
                placeholder="Smith"
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
              {errors.lastName && <p className="text-xs text-red-400">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Email</Label>
            <Input
              {...register("email")}
              type="email"
              placeholder="jane@example.com"
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
            {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Phone <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              {...register("phone")}
              type="tel"
              placeholder="(951) 555-0100"
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Payment Status</Label>
            <Select
              value={paymentStatus}
              onValueChange={(v) => setValue("paymentStatus", v as any)}
            >
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="paid">
                  <span className="text-green-400 font-medium">Paid</span>
                </SelectItem>
                <SelectItem value="unpaid">
                  <span className="text-amber-400 font-medium">Unpaid</span>
                </SelectItem>
                <SelectItem value="free">
                  <span className="text-blue-400 font-medium">Free</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Send confirmation email</p>
              <p className="text-xs text-muted-foreground">Queues an email via Mailgun</p>
            </div>
            <Switch
              checked={sendConfirmation}
              onCheckedChange={(v) => setValue("sendConfirmation", v)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addMutation.isPending}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {addMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</>
              ) : (
                "Add Student"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
