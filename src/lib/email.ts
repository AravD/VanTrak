import { supabase } from './supabase';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

/**
 * Sends an app email through the `send-email` edge function (Resend API).
 * Auth is automatic — supabase.functions.invoke attaches the signed-in user's
 * JWT, which the function requires. The sender (`from`) is fixed server-side.
 */
export async function sendAppEmail(input: SendEmailInput): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo,
    },
  });
  if (error) {
    // A FunctionsHttpError carries the raw Response; pull out Resend's real
    // reason + the `from` used so the caller can show something actionable.
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = (await ctx.json()) as { from?: string; error?: string; details?: { message?: string; name?: string } };
        const reason = body?.details?.message || body?.details?.name || body?.error;
        if (reason) message = body?.from ? `${reason} (from: ${body.from})` : reason;
      } catch {
        /* fall back to the generic message */
      }
    }
    throw new Error(message);
  }
  return data as { id: string };
}

/**
 * Wraps a message in VanTrak's branded HTML shell so every app email
 * (invites, notifications, custom messages) looks consistent. `body` may
 * contain HTML. Pass a `cta` to render the black action button.
 */
export function emailTemplate(opts: {
  heading: string;
  body: string;
  cta?: { label: string; url: string };
}): string {
  const { heading, body, cta } = opts;
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto">
      <div style="font-weight:800;font-size:22px;letter-spacing:-.03em;color:#111;margin-bottom:16px">VanTrak</div>
      <div style="background:#ffffff;border:1px solid #eaeaea;border-radius:16px;padding:28px">
        <h1 style="font-size:18px;line-height:1.3;margin:0 0 10px;color:#111">${heading}</h1>
        <div style="font-size:14px;line-height:1.65;color:#444">${body}</div>
        ${
          cta
            ? `<a href="${cta.url}" style="display:inline-block;margin-top:22px;background:#000;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px">${cta.label}</a>`
            : ''
        }
      </div>
      <p style="font-size:11px;color:#9ca3af;margin:16px 4px 0">Sent from VanTrak · If you didn't expect this email, you can ignore it.</p>
    </div>
  </div>`;
}
