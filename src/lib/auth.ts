import { cookies } from 'next/headers';
import { getSession, destroySession } from './db';

export const SESSION_COOKIE = 'ticketqr_session';

export interface SessionUser {
  id: number;
  orgId: number | null;
  role: string;
  name: string;
  email: string;
}

export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSession(token);
}

export async function destroyServerSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    destroySession(token);
    cookieStore.delete(SESSION_COOKIE);
  }
}

export function jsonResponse(
  data: unknown,
  status = 200,
  cookie?: { name: string; value: string; maxAge?: number; httpOnly?: boolean }
) {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (cookie) {
    let cookieStr = `${cookie.name}=${cookie.value}; Path=/; SameSite=Lax`;
    if (cookie.maxAge) cookieStr += `; Max-Age=${cookie.maxAge}`;
    if (cookie.httpOnly !== false) cookieStr += `; HttpOnly`;
    headers.set('Set-Cookie', cookieStr);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export async function requireAuth(
  allowedRoles?: string[]
): Promise<{ user: SessionUser } | { error: string; status: number }> {
  const user = await getServerSession();
  if (!user) return { error: 'Unauthorized', status: 401 };
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { error: 'Forbidden', status: 403 };
  }
  return { user };
}
