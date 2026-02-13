import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { unauthorized } from './errors';

export type AuthenticatedHandler = (
  request: NextRequest,
  userId: string
) => Promise<NextResponse>;

/**
 * Middleware to check authentication
 * Extracts user ID from Supabase session
 */
export async function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest) => {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return unauthorized();
    }

    return handler(request, user.id);
  };
}
