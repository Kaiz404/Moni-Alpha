import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { signInSchema, type AuthResponse } from '@repo/types';
import { handleApiError } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = signInSchema.parse(body);

    const supabase = await createClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!data.user || !data.session) {
      return NextResponse.json(
        { error: 'Failed to authenticate' },
        { status: 401 }
      );
    }

    const response: AuthResponse = {
      user: {
        id: data.user.id,
        email: data.user.email!,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at!,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
