import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncPullRequestSchema, type SyncPullResponse } from '@repo/types';
import { handleApiError, unauthorized } from '@/lib/api/errors';

function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camel] = v;
  }
  return result;
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

    const body = await request.json().catch(() => ({}));
    const { lastSyncTimestamp } = syncPullRequestSchema.parse(body);

    const since = lastSyncTimestamp
      ? new Date(lastSyncTimestamp).toISOString()
      : '1970-01-01T00:00:00.000Z';

    const response: SyncPullResponse = {
      wallets: { created: [], updated: [], deleted: [] },
      transactions: { created: [], updated: [], deleted: [] },
      categories: { created: [], updated: [], deleted: [] },
      tags: { created: [], updated: [], deleted: [] },
      timestamp: Date.now(),
    };

    const { data: walletsData } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .gte('updated_at', since);

    if (walletsData) {
      response.wallets.updated = walletsData.map((w) => toCamelCase(w as Record<string, unknown>));
    }

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('updated_at', since);

    if (txData) {
      response.transactions.updated = txData.map((t) =>
        toCamelCase(t as Record<string, unknown>)
      );
    }

    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .gte('updated_at', since);

    if (categoriesData) {
      response.categories.updated = categoriesData.map((c) =>
        toCamelCase(c as Record<string, unknown>)
      );
    }

    const { data: tagsData } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', since);

    if (tagsData) {
      response.tags.updated = tagsData.map((t) => toCamelCase(t as Record<string, unknown>));
    }

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
