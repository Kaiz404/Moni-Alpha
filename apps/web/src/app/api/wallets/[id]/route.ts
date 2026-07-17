import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decimalToMinor, minorToDecimal, updateWalletSchema, type WalletResponse } from '@repo/types';
import { handleApiError, unauthorized, notFound } from '@/lib/api/errors';

export async function GET(
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

    const { data, error } = await supabase
      .from('wallet_balances')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return notFound('Wallet not found');
    }

    const response: WalletResponse = {
      wallet: {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        type: data.type,
        currency: data.currency,
        initialBalanceMinor: decimalToMinor(data.initial_balance),
        currentBalanceMinor: decimalToMinor(data.current_balance),
        color: data.color,
        icon: data.icon,
        cardStyleId: data.card_style_id,
        isActive: data.is_active,
        displayOrder: data.display_order,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}

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
    const updates = updateWalletSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.cardStyleId !== undefined) updateData.card_style_id = updates.cardStyleId;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;
    if (updates.initialBalanceMinor !== undefined) updateData.initial_balance = minorToDecimal(updates.initialBalanceMinor);

    const { data, error } = await supabase
      .from('wallets')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: WalletResponse = {
      wallet: {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        type: data.type,
        currency: data.currency,
        initialBalanceMinor: decimalToMinor(data.initial_balance),
        color: data.color,
        icon: data.icon,
        cardStyleId: data.card_style_id,
        isActive: data.is_active,
        displayOrder: data.display_order,
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

    // Soft delete
    const { error } = await supabase
      .from('wallets')
      .update({ is_active: false })
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
