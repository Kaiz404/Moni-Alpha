import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncPushRequestSchema, type SyncPushResponse } from '@repo/types';
import { handleApiError, unauthorized } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized();
    }

    const body = await request.json();
    const syncData = syncPushRequestSchema.parse(body);

    const timestamp = Date.now();
    const results: SyncPushResponse['results'] = {
      wallets: [],
      transactions: [],
      categories: [],
      tags: [],
    };

    // Process wallet changes
    if (syncData.wallets) {
      for (const change of syncData.wallets) {
        try {
          if (change.action === 'create') {
            const { data, error } = await supabase
              .from('wallets')
              .upsert({ ...change.data, user_id: user.id })
              .select()
              .single();

            results.wallets.push({
              localId: change.id,
              serverId: data?.id,
              status: error ? 'error' : 'created',
              error: error?.message,
            });
          }
          // Handle update and delete actions similarly
        } catch (err) {
          results.wallets.push({
            localId: change.id,
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Process transaction changes
    if (syncData.transactions) {
      for (const change of syncData.transactions) {
        try {
          if (change.action === 'create') {
            const { data, error } = await supabase
              .from('transactions')
              .upsert({ ...change.data, user_id: user.id })
              .select()
              .single();

            results.transactions.push({
              localId: change.id,
              serverId: data?.id,
              status: error ? 'error' : 'created',
              error: error?.message,
            });
          }
        } catch (err: any) {
          results.transactions.push({
            localId: change.id,
            status: 'error',
            error: err.message,
          });
        }
      }
    }

    const response: SyncPushResponse = {
      success: true,
      timestamp,
      results,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
