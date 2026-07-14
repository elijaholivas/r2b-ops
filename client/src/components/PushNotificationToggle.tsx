import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, permissionState, subscribe, unsubscribe } =
    usePushNotifications();

  if (!isSupported) return null;

  if (permissionState === "denied") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground opacity-50 cursor-not-allowed" disabled>
              <BellOff className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Notifications blocked — enable in browser settings</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={isSubscribed ? unsubscribe : subscribe}
            disabled={isLoading}
            className={isSubscribed ? "text-green-500 hover:text-green-400" : "text-muted-foreground hover:text-foreground"}
          >
            {isSubscribed ? (
              <BellRing className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isSubscribed ? "Push notifications ON — tap to disable" : "Enable push notifications"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
