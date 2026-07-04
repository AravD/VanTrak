/**
 * Formats raw input into a US phone string `XXX-XXX-XXXX`. Non-digits are
 * stripped and the result is capped at 10 digits, so typing letters/symbols
 * has no effect and dashes are inserted automatically as the user types.
 */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}
