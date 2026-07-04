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
  if (error) throw error;
  return data as { id: string };
}
