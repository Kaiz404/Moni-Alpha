import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createWalletSchema, decimalToMinor, minorToDecimal, type WalletListResponse, type WalletResponse } from '@repo/types';
import { handleApiError, unauthorized } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized();
    }

    const { data, error } = await supabase
      .from('wallet_balances')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: WalletListResponse = {
      wallets: (data || []).map(w => ({
        id: w.id,
        userId: w.user_id,
        name: w.name,
        type: w.type,
        currency: w.currency,
        initialBalanceMinor: decimalToMinor(w.initial_balance),
        currentBalanceMinor: decimalToMinor(w.current_balance),
        color: w.color,
        icon: w.icon,
        cardStyleId: w.card_style_id,
        isActive: w.is_active,
        displayOrder: w.display_order,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized();
    }

    const body = await request.json();
    const validated = createWalletSchema.parse(body);

    const { data, error } = await supabase
      .from('wallets')
      .insert({
        user_id: user.id,
        name: validated.name,
        type: validated.type,
        currency: validated.currency,
        initial_balance: minorToDecimal(validated.initialBalanceMinor),
        color: validated.color,
        icon: validated.icon,
        card_style_id: validated.cardStyleId,
        display_order: 0,
      })
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

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
