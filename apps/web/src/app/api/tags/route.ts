import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTagSchema, type TagListResponse, type TagResponse } from '@repo/types';
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

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: TagListResponse = {
      tags: (data || []).map((t) => ({
        id: t.id,
        userId: t.user_id,
        name: t.name,
        color: t.color,
        createdAt: t.created_at,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
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
    const validated = createTagSchema.parse(body);

    const { data, error } = await supabase
      .from('tags')
      .insert({
        user_id: user.id,
        name: validated.name,
        color: validated.color,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: TagResponse = {
      tag: {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        color: data.color,
        createdAt: data.created_at,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
