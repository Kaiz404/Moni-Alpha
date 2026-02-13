import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { signUpSchema, type AuthResponse } from '@repo/types';
import { handleApiError } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, displayName } = signUpSchema.parse(body);

    const supabase = await createClient();
    
    // Sign up user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user || !data.session) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        display_name: displayName,
        preferences: {
          currency: 'USD',
          theme: 'system',
          notifications_enabled: true,
        },
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Continue anyway - profile can be created later
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
