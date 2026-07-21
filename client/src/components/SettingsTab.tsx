import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Mail,
  Link2,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function MaskedInput({
  label,
  placeholder,
  value,
  onChange,
  hint,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-foreground">{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SettingsTab() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.admin.integrationSettings.useQuery();

  // Mailgun fields
  const [mailgunApiKey, setMailgunApiKey] = useState("");
  const [mailgunDomain, setMailgunDomain] = useState("");

  // WooCommerce fields
  const [wooBaseUrl, setWooBaseUrl] = useState("");
  const [wooConsumerKey, setWooConsumerKey] = useState("");
  const [wooConsumerSecret, setWooConsumerSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  // CCW Renewal fields
  const [ccwRenewalProductUrl, setCcwRenewalProductUrl] = useState("");
  const [ccwSaved, setCcwSaved] = useState(false);

  const [mailgunSaved, setMailgunSaved] = useState(false);
  const [wooSaved, setWooSaved] = useState(false);

  const updateSettings = trpc.admin.updateIntegrationSettings.useMutation({
    onSuccess: (_, variables) => {
      utils.admin.integrationSettings.invalidate();
      const isMailgun = "mailgunApiKey" in variables || "mailgunDomain" in variables;
      const isCcw = "ccwRenewalProductUrl" in variables;
      if (isMailgun) {
        setMailgunSaved(true);
        setMailgunApiKey("");
        toast.success("Mailgun settings saved");
        setTimeout(() => setMailgunSaved(false), 3000);
      } else if (isCcw) {
        setCcwSaved(true);
        toast.success("CCW renewal URL saved");
        setTimeout(() => setCcwSaved(false), 3000);
      } else {
        setWooSaved(true);
        setWooConsumerKey("");
        setWooConsumerSecret("");
        setWebhookSecret("");
        toast.success("WooCommerce settings saved");
        setTimeout(() => setWooSaved(false), 3000);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const saveMailgun = () => {
    const payload: Record<string, string> = {};
    if (mailgunApiKey.trim()) payload.mailgunApiKey = mailgunApiKey.trim();
    if (mailgunDomain.trim()) payload.mailgunDomain = mailgunDomain.trim();
    if (Object.keys(payload).length === 0) {
      toast.error("Enter at least one Mailgun field to save");
      return;
    }
    updateSettings.mutate(payload);
  };

  const saveWooCommerce = () => {
    const payload: Record<string, string> = {};
    if (wooBaseUrl.trim()) payload.wooBaseUrl = wooBaseUrl.trim();
    if (wooConsumerKey.trim()) payload.wooConsumerKey = wooConsumerKey.trim();
    if (wooConsumerSecret.trim()) payload.wooConsumerSecret = wooConsumerSecret.trim();
    if (webhookSecret.trim()) payload.webhookSecret = webhookSecret.trim();
    if (Object.keys(payload).length === 0) {
      toast.error("Enter at least one WooCommerce field to save");
      return;
    }
    updateSettings.mutate(payload);
  };

  const saveCcwUrl = () => {
    const url = ccwRenewalProductUrl.trim();
    if (!url) {
      toast.error("Enter a URL to save");
      return;
    }
    updateSettings.mutate({ ccwRenewalProductUrl: url });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasMailgun = settings?.mailgunApiKey;
  const hasWoo = settings?.wooConsumerKey;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Info banner */}
      <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-700/50">
        <p className="text-sm text-blue-300">
          Credentials are stored securely in the database. Existing values are masked — enter a new value to update, or leave blank to keep the current value.
        </p>
      </div>

      {/* Mailgun Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            Mailgun — Email Delivery
            {hasMailgun && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400 font-normal">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configured
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MaskedInput
              label="Mailgun API Key"
              placeholder={hasMailgun ? "••••••••  (already set)" : "key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
              value={mailgunApiKey}
              onChange={setMailgunApiKey}
              hint="Found in Mailgun → API Keys"
            />
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Sending Domain</Label>
              <Input
                type="text"
                placeholder={settings?.mailgunDomain ?? "r2bear.com"}
                value={mailgunDomain}
                onChange={(e) => setMailgunDomain(e.target.value)}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">The domain verified in your Mailgun account</p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-xs text-muted-foreground">
              Sender address: <span className="text-foreground font-mono">reminder@r2bear.com</span>
              {" · "}All confirmation and reminder emails will be sent from this address.
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={saveMailgun}
              disabled={updateSettings.isPending}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {updateSettings.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : mailgunSaved ? (
                <CheckCircle2 className="h-4 w-4 mr-1.5 text-green-300" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              {mailgunSaved ? "Saved!" : "Save Mailgun Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator className="bg-border" />

      {/* WooCommerce Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-primary" />
            WooCommerce — Order Sync
            {hasWoo && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400 font-normal">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configured
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Store URL</Label>
            <Input
              type="url"
              placeholder={settings?.wooBaseUrl ?? "https://your-store.com"}
              value={wooBaseUrl}
              onChange={(e) => setWooBaseUrl(e.target.value)}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Your WooCommerce store base URL (no trailing slash)</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MaskedInput
              label="Consumer Key"
              placeholder={hasWoo ? "••••••••  (already set)" : "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
              value={wooConsumerKey}
              onChange={setWooConsumerKey}
              hint="WooCommerce → Settings → Advanced → REST API"
            />
            <MaskedInput
              label="Consumer Secret"
              placeholder={hasWoo ? "••••••••  (already set)" : "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
              value={wooConsumerSecret}
              onChange={setWooConsumerSecret}
              hint="Same location as consumer key"
            />
          </div>
          <MaskedInput
            label="Webhook Secret"
            placeholder="A secret string you set when creating the webhook in WooCommerce"
            value={webhookSecret}
            onChange={setWebhookSecret}
            hint="Used to verify incoming webhook signatures (HMAC-SHA256)"
          />
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-xs text-muted-foreground mb-1">
              Webhook endpoint to configure in WooCommerce → Settings → Advanced → Webhooks:
            </p>
            <code className="text-xs font-mono text-foreground bg-background px-2 py-1 rounded border border-border block break-all">
              {window.location.origin}/api/webhooks/woocommerce
            </code>
            <p className="text-xs text-muted-foreground mt-1">Subscribe to: <strong>Order Created</strong> and <strong>Order Updated</strong></p>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={saveWooCommerce}
              disabled={updateSettings.isPending}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {updateSettings.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : wooSaved ? (
                <CheckCircle2 className="h-4 w-4 mr-1.5 text-green-300" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              {wooSaved ? "Saved!" : "Save WooCommerce Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator className="bg-border" />

      {/* CCW Renewal Product URL Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-primary" />
            CCW Renewal — Product Link
            {settings?.ccwRenewalProductUrl && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400 font-normal">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configured
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">CCW Renewal Product URL</Label>
            <Input
              type="url"
              placeholder={settings?.ccwRenewalProductUrl ?? "https://your-store.com/product/ccw-renewal"}
              value={ccwRenewalProductUrl}
              onChange={(e) => setCcwRenewalProductUrl(e.target.value)}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Full URL to the CCW renewal product on your WooCommerce store. This link is included in the 18-month CCW renewal reminder emails.
            </p>
          </div>
          {settings?.ccwRenewalProductUrl && (
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Current URL:</p>
              <a
                href={settings.ccwRenewalProductUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-primary hover:underline break-all"
              >
                {settings.ccwRenewalProductUrl}
              </a>
            </div>
          )}
          <div className="flex justify-end">
            <Button
              onClick={saveCcwUrl}
              disabled={updateSettings.isPending}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {updateSettings.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : ccwSaved ? (
                <CheckCircle2 className="h-4 w-4 mr-1.5 text-green-300" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              {ccwSaved ? "Saved!" : "Save CCW Renewal URL"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
