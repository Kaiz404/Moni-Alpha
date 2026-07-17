import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createCategorySchema,
  type CategoryListResponse,
  type CategoryResponse,
} from '@repo/types';
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

    // Get both system categories and user categories
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .eq('is_active', true)
      .order('type', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: CategoryListResponse = {
      categories: (data || []).map((c) => ({
        id: c.id,
        userId: c.user_id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        parentId: c.parent_id,
        type: c.type,
        isActive: c.is_active,
        displayOrder: c.display_order,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
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
    const validated = createCategorySchema.parse(body);

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name: validated.name,
        icon: validated.icon,
        color: validated.color,
        parent_id: validated.parentId || null,
        type: validated.type,
        display_order: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: CategoryResponse = {
      category: {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        icon: data.icon,
        color: data.color,
        parentId: data.parent_id,
        type: data.type,
        isActive: data.is_active,
        displayOrder: data.display_order,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
