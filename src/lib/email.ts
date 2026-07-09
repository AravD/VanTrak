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
