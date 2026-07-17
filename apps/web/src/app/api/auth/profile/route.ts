import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateProfileSchema, type ProfileResponse } from '@repo/types';
import { handleApiError, unauthorized } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized();
    }

    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: ProfileResponse = {
      profile: {
        id: data.id,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
        preferences: data.preferences,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized();
    }

    const body = await request.json();
    const updates = updateProfileSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (updates.displayName !== undefined) {
      updateData.display_name = updates.displayName;
    }
    if (updates.avatarUrl !== undefined) {
      updateData.avatar_url = updates.avatarUrl;
    }
    if (updates.preferences !== undefined) {
      updateData.preferences = updates.preferences;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: ProfileResponse = {
      profile: {
        id: data.id,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
        preferences: data.preferences,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
