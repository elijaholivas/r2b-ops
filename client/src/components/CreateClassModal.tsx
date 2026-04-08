import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CalendarDays, Loader2 } from "lucide-react";
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

const schema = z.object({
  title: z.string().min(1, "Title required"),
  classType: z.string().optional(),
  startDatetime: z.string().min(1, "Start date/time required"),
  endDatetime: z.string().min(1, "End date/time required"),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
  locationId: z.coerce.number().optional(),
  price: z.coerce.number().optional(),
  wooProductId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateClassModal({ open, onClose, onSuccess }: Props) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { capacity: 20 },
  });

  const { data: locations } = trpc.classes.locations.useQuery();

  const createMutation = trpc.classes.create.useMutation({
    onSuccess: () => {
      toast.success("Class created successfully");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create class");
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data as any);
  };

  const locationId = watch("locationId");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CalendarDays className="h-5 w-5 text-primary" />
            Create New Class
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Schedule a new class session
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Class Title</Label>
            <Input
              {...register("title")}
              placeholder="e.g. Initial CCW Certification"
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
            {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Class Type</Label>
              <Input
                {...register("classType")}
                placeholder="e.g. CCW, Safety"
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Capacity</Label>
              <Input
                {...register("capacity")}
                type="number"
                min={1}
                className="bg-input border-border text-foreground"
              />
              {errors.capacity && <p className="text-xs text-red-400">{errors.capacity.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Start Date & Time</Label>
              <Input
                {...register("startDatetime")}
                type="datetime-local"
                className="bg-input border-border text-foreground"
              />
              {errors.startDatetime && <p className="text-xs text-red-400">{errors.startDatetime.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">End Date & Time</Label>
              <Input
                {...register("endDatetime")}
                type="datetime-local"
                className="bg-input border-border text-foreground"
              />
              {errors.endDatetime && <p className="text-xs text-red-400">{errors.endDatetime.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Location</Label>
              <Select
                value={locationId ? String(locationId) : ""}
                onValueChange={(v) => setValue("locationId", parseInt(v))}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Select location..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {(locations ?? []).map((loc) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Price ($)</Label>
              <Input
                {...register("price")}
                type="number"
                step="0.01"
                placeholder="0.00"
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">WooCommerce Product ID <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              {...register("wooProductId")}
              placeholder="e.g. 1234"
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 text-muted-foreground hover:text-foreground">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {createMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
              ) : (
                "Create Class"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
