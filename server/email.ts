import { getIntegrationSettings, updateEmailStatus } from "./db";

const FROM_EMAIL = "reminder@r2bear.com";
const FROM_NAME = "Right 2 Bear";
const DEFAULT_DOMAIN = "r2bear.com";

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function sendEmailViaMailgun(params: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; error?: string }> {
  const settings = await getIntegrationSettings();
  const apiKey = settings?.mailgunApiKey || process.env.MAILGUN_API_KEY;
  const domain = settings?.mailgunDomain || DEFAULT_DOMAIN;
  const fromEmail = settings?.defaultFromEmail || FROM_EMAIL;
  const fromName = FROM_NAME;

  if (!apiKey) {
    return { success: false, error: "Mailgun API key not configured" };
  }

  const formData = new URLSearchParams();
  formData.append("from", `${fromName} <${fromEmail}>`);
  formData.append("to", params.toName ? `${params.toName} <${params.to}>` : params.to);
  formData.append("subject", params.subject);
  formData.append("html", params.html);
  if (params.text) formData.append("text", params.text);

  try {
    const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Mailgun error ${response.status}: ${errorText}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Unknown error" };
  }
}

export async function processEmailQueue(): Promise<{ sent: number; failed: number }> {
  const { getPendingEmails } = await import("./db");
  const pending = await getPendingEmails(20);

  let sent = 0;
  let failed = 0;

  for (const item of pending) {
    const result = await sendEmailViaMailgun({
      to: item.toEmail,
      toName: item.toName ?? undefined,
      subject: item.subject ?? item.templateKey,
      html: item.bodyHtml ?? "",
    });

    if (result.success) {
      await updateEmailStatus(item.id, "sent");
      sent++;
    } else {
      await updateEmailStatus(item.id, "failed", result.error);
      failed++;
    }
  }

  return { sent, failed };
}
