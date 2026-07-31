/**
 * emailTemplates.ts
 *
 * Shared branded HTML email templates for Right 2 Bear, LLC.
 * All templates use dynamic placeholders: {{name}}, {{classType}}, {{date}}, {{time}}
 */

export interface ClassEmailVars {
  name: string;       // Student first name
  classType: string;  // Class title / type
  date: string;       // Formatted class date string
  time: string;       // Formatted class time string
}

/**
 * Builds the branded confirmation/reminder email HTML body.
 * Used for both confirmation emails and reminder emails — same template, same content.
 */
export function buildClassEmailHtml(vars: ClassEmailVars): string {
  const { name, classType, date, time } = vars;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a1a;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#c0392b;font-size:26px;letter-spacing:1px;">Right 2 Bear</h1>
              <p style="margin:6px 0 0;color:#cccccc;font-size:13px;letter-spacing:0.5px;">Training Division</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <p style="margin:0 0 16px;font-size:15px;color:#222;">Hi ${name},</p>

              <p style="margin:0 0 24px;font-size:15px;color:#222;line-height:1.6;">
                This is a reminder that your <strong>Right 2 Bear, LLC ${classType}</strong> is scheduled for <strong>${date}</strong>.
              </p>

              <!-- Location block -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-left:4px solid #c0392b;border-radius:3px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#555;text-transform:uppercase;letter-spacing:0.5px;">Location</p>
                    <p style="margin:0;font-size:15px;color:#1a1a1a;font-weight:bold;">Randall's Riverside Magnum Range</p>
                    <p style="margin:2px 0 0;font-size:14px;color:#444;">12391 Sampson Ave., Suite O</p>
                    <p style="margin:2px 0 0;font-size:14px;color:#444;">Riverside, CA</p>
                  </td>
                </tr>
              </table>

              <!-- Check-in block -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-left:4px solid #c0392b;border-radius:3px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#555;text-transform:uppercase;letter-spacing:0.5px;">Check-In</p>
                    <p style="margin:0;font-size:16px;color:#1a1a1a;font-weight:bold;">${time}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#666;font-style:italic;">Please arrive 15–20 minutes early.</p>
                  </td>
                </tr>
              </table>

              <!-- Waiver -->
              <p style="margin:0 0 8px;font-size:15px;color:#222;font-weight:bold;">Complete Your Waiver Before Class:</p>
              <p style="margin:0 0 24px;">
                <a href="https://waiver.smartwaiver.com/w/5f9b00c9368cb/web/"
                   style="color:#c0392b;font-size:14px;word-break:break-all;">
                  https://waiver.smartwaiver.com/w/5f9b00c9368cb/web/
                </a>
              </p>

              <!-- Please Bring -->
              <p style="margin:0 0 10px;font-size:15px;color:#222;font-weight:bold;">Please Bring:</p>
              <ul style="margin:0 0 24px;padding-left:20px;color:#333;font-size:14px;line-height:1.9;">
                <li>A valid California Driver's License or ID</li>
                <li>Your unloaded firearm(s) you plan to qualify with</li>
                <li>At least 18 rounds per handgun plus 50 additional rounds of ammunition</li>
                <li>Eye and ear protection (electronic hearing protection is recommended)</li>
                <li>A sturdy belt and holster that completely covers the trigger guard (no Serpa-style holsters)</li>
                <li>Closed-toe shoes</li>
                <li>A hat and weather-appropriate clothing</li>
                <li>Water and snacks/lunch (there will be breaks throughout the day)</li>
                <li>Pen and notepad for classroom instruction</li>
              </ul>

              <!-- Important Reminders -->
              <p style="margin:0 0 10px;font-size:15px;color:#222;font-weight:bold;">Important Reminders:</p>
              <ul style="margin:0 0 24px;padding-left:20px;color:#333;font-size:14px;line-height:1.9;">
                <li>Ensure all firearms arrive unloaded and remain cased until instructed by your instructor.</li>
                <li>No steel-core, steel-jacketed, or armor-piercing ammunition.</li>
                <li>Safety is our top priority. Please follow all instructor commands at all times.</li>
              </ul>

              <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
                If you need to reschedule or have any questions before class, please email
                <a href="mailto:info@r2bear.com" style="color:#c0392b;">info@r2bear.com</a>
                or call <a href="tel:+19518927077" style="color:#c0392b;">(951) 892-7077</a>.
              </p>

              <p style="margin:0 0 4px;font-size:15px;color:#222;">We look forward to seeing you on <strong>${date}</strong>.</p>

              <p style="margin:24px 0 0;font-size:14px;color:#444;line-height:1.6;">
                Thank you,<br />
                <strong>Right 2 Bear, LLC</strong><br />
                Training Division
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f0f0f0;padding:16px 32px;text-align:center;border-top:1px solid #e0e0e0;">
              <p style="margin:0;font-size:12px;color:#888;">
                © Right 2 Bear, LLC · <a href="mailto:info@r2bear.com" style="color:#888;">info@r2bear.com</a> · (951) 892-7077
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
