import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  updateTransactionSchema,
  type TransactionResponse,
} from '@repo/types';
import { handleApiError, unauthorized, notFound } from '@/lib/api/errors';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized();
    }

    const body = await request.json();
    const updates = updateTransactionSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (updates.walletId !== undefined) updateData.wallet_id = updates.walletId;
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.categoryId !== undefined) updateData.category_id = updates.categoryId;
    if (updates.transferToWalletId !== undefined)
      updateData.transfer_to_wallet_id = updates.transferToWalletId;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.merchant !== undefined) updateData.merchant = updates.merchant;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.transactionDate !== undefined)
      updateData.transaction_date = updates.transactionDate;
    if (updates.locationLatitude !== undefined)
      updateData.location_latitude = updates.locationLatitude;
    if (updates.locationLongitude !== undefined)
      updateData.location_longitude = updates.locationLongitude;
    if (updates.locationName !== undefined)
      updateData.location_name = updates.locationName;

    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return notFound('Transaction not found');
    }

    // Update tags if provided
    if (updates.tagIds !== undefined) {
      await supabase.from('transaction_tags').delete().eq('transaction_id', id);
      if (updates.tagIds.length > 0) {
        await supabase.from('transaction_tags').insert(
          updates.tagIds.map((tagId) => ({
            transaction_id: id,
            tag_id: tagId,
            user_id: user.id,
          }))
        );
      }
    }

    const response: TransactionResponse = {
      transaction: {
        id: data.id,
        userId: data.user_id,
        walletId: data.wallet_id,
        amount: parseFloat(data.amount),
        type: data.type,
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

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized();
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
