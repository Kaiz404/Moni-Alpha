import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createTransactionSchema,
  decimalToMinor,
  minorToDecimal,
  transactionListParamsSchema,
  type TransactionListResponse,
  type TransactionResponse,
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

    const searchParams = request.nextUrl.searchParams;
    const params = transactionListParamsSchema.parse({
      walletId: searchParams.get('walletId') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      type: searchParams.get('type') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      minAmountMinor: searchParams.get('minAmountMinor')
        ? parseInt(searchParams.get('minAmountMinor')!, 10)
        : undefined,
      maxAmountMinor: searchParams.get('maxAmountMinor')
        ? parseInt(searchParams.get('maxAmountMinor')!, 10)
        : undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      sortBy: searchParams.get('sortBy') ?? 'date',
      sortOrder: searchParams.get('sortOrder') ?? 'desc',
    });

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // Apply filters
    if (params.walletId) query = query.eq('wallet_id', params.walletId);
    if (params.categoryId) query = query.eq('category_id', params.categoryId);
    if (params.type) query = query.eq('type', params.type);
    if (params.startDate) query = query.gte('transaction_date', params.startDate);
    if (params.endDate) query = query.lte('transaction_date', params.endDate);
    if (params.minAmountMinor !== undefined)
      query = query.gte('amount', minorToDecimal(params.minAmountMinor));
    if (params.maxAmountMinor !== undefined)
      query = query.lte('amount', minorToDecimal(params.maxAmountMinor));
    if (params.search) {
      query = query.or(
        `description.ilike.%${params.search}%,merchant.ilike.%${params.search}%,notes.ilike.%${params.search}%`,
      );
    }

    // Apply sorting
    const sortColumn = params.sortBy === 'date' ? 'transaction_date' : params.sortBy;
    query = query.order(sortColumn, {
      ascending: params.sortOrder === 'asc',
    });

    // Apply pagination
    const from = (params.page - 1) * params.limit;
    const to = from + params.limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const walletIds = [
      ...new Set(
        (data ?? []).flatMap((transaction) =>
          [transaction.wallet_id, transaction.transfer_to_wallet_id].filter(Boolean),
        ),
      ),
    ];
    const { data: wallets } = walletIds.length
      ? await supabase.from('wallets').select('id, currency').in('id', walletIds)
      : { data: [] };
    const currencyByWallet = new Map((wallets ?? []).map((wallet) => [wallet.id, wallet.currency]));
    const response: TransactionListResponse = {
      transactions: (data || []).map((t) => ({
        id: t.id,
        userId: t.user_id,
        walletId: t.wallet_id,
        amountMinor: decimalToMinor(t.amount),
        currency:
          (t as typeof t & { currency?: string | null }).currency ??
          currencyByWallet.get(t.wallet_id) ??
          'USD',
        type: t.type,
        analysisExcluded: Boolean(
          (
            t as typeof t & {
              analysis_excluded?: boolean | number | null;
            }
          ).analysis_excluded,
        ),
        debtActivityId:
          (t as typeof t & { debt_activity_id?: string | null }).debt_activity_id ?? null,
        categoryId: t.category_id,
        transferToWalletId: t.transfer_to_wallet_id,
        linkedTransactionId: t.linked_transaction_id,
        description: t.description,
        merchant: t.merchant,
        notes: t.notes,
        transactionDate: t.transaction_date,
        locationLatitude: t.location_latitude ? parseFloat(t.location_latitude) : null,
        locationLongitude: t.location_longitude ? parseFloat(t.location_longitude) : null,
        locationName: t.location_name,
        receiptImageUrl: t.receipt_image_url,
        metadata: t.metadata,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / params.limit),
      },
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
    const validated = createTransactionSchema.parse(body);

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('currency')
      .eq('id', validated.walletId)
      .eq('user_id', user.id)
      .single();
    if (walletError || !wallet)
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    if (validated.type === 'transfer') {
      const { data: destination, error: destinationError } = await supabase
        .from('wallets')
        .select('currency')
        .eq('id', validated.transferToWalletId!)
        .eq('user_id', user.id)
        .single();
      if (destinationError || !destination)
        return NextResponse.json({ error: 'Transfer destination not found' }, { status: 404 });
      if (destination.currency !== wallet.currency)
        return NextResponse.json(
          { error: 'Transfers require matching wallet currencies' },
          { status: 400 },
        );
    }
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        wallet_id: validated.walletId,
        amount: minorToDecimal(validated.amountMinor),
        currency: wallet.currency,
        type: validated.type,
        category_id: validated.categoryId || null,
        transfer_to_wallet_id: validated.transferToWalletId || null,
        description: validated.description || null,
        merchant: validated.merchant || null,
        notes: validated.notes || null,
        transaction_date: validated.transactionDate || new Date().toISOString(),
        location_latitude: validated.locationLatitude || null,
        location_longitude: validated.locationLongitude || null,
        location_name: validated.locationName || null,
        metadata: {},
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add tags if provided
    if (validated.tagIds && validated.tagIds.length > 0) {
      const tagInserts = validated.tagIds.map((tagId) => ({
        transaction_id: data.id,
        tag_id: tagId,
        user_id: user.id,
      }));

      await supabase.from('transaction_tags').insert(tagInserts);
    }

    const response: TransactionResponse = {
      transaction: {
        id: data.id,
        userId: data.user_id,
        walletId: data.wallet_id,
        amountMinor: decimalToMinor(data.amount),
        currency: (data as typeof data & { currency?: string | null }).currency ?? wallet.currency,
        type: data.type,
        analysisExcluded: Boolean(
          (
            data as typeof data & {
              analysis_excluded?: boolean | number | null;
            }
          ).analysis_excluded,
        ),
        debtActivityId:
          (data as typeof data & { debt_activity_id?: string | null }).debt_activity_id ?? null,
        categoryId: data.category_id,
        transferToWalletId: data.transfer_to_wallet_id,
        linkedTransactionId: data.linked_transaction_id,
        description: data.description,
        merchant: data.merchant,
        notes: data.notes,
        transactionDate: data.transaction_date,
        locationLatitude: data.location_latitude ? parseFloat(data.location_latitude) : null,
        locationLongitude: data.location_longitude ? parseFloat(data.location_longitude) : null,
        locationName: data.location_name,
        receiptImageUrl: data.receipt_image_url,
        metadata: data.metadata,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
