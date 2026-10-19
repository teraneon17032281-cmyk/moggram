/**
 * Remembers which email is waiting for verification, so a page refresh keeps the screen.
 * Stores ONLY the email and the time the next resend is allowed. Never the code.
 */
const KEY = 'moggram.pending-verification';

export interface PendingVerification {
  email: string;
  resendAvailableAt: number; // ms timestamp
}

export function loadPending(): PendingVerification | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Partial<PendingVerification> | null;
    if (p && typeof p.email === 'string' && typeof p.resendAvailableAt === 'number') return { email: p.email, resendAvailableAt: p.resendAvailableAt };
  } catch {
    /* ignore */
  }
  return null;
}

export const savePending = (p: PendingVerification) => sessionStorage.setItem(KEY, JSON.stringify(p));
export const clearPending = () => sessionStorage.removeItem(KEY);
