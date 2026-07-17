import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { type OverviewStatsResponse } from '@repo/types';
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

    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Get previous month date range for comparison
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // Current month transactions
    const { data: currentTxs } = await supabase
      .from('transactions')
      .select('type, amount, category_id')
      .eq('user_id', user.id)
      .gte('transaction_date', startOfMonth)
      .lte('transaction_date', endOfMonth);

    // Previous month transactions
    const { data: lastMonthTxs } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', user.id)
      .gte('transaction_date', startOfLastMonth)
      .lte('transaction_date', endOfLastMonth);

    // Calculate current month stats
    const totalIncome =
      currentTxs
        ?.filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
    const totalExpenses =
      currentTxs
        ?.filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
    const netCashFlow = totalIncome - totalExpenses;

    // Calculate last month stats
    const lastMonthIncome =
      lastMonthTxs
        ?.filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
    const lastMonthExpenses =
      lastMonthTxs
        ?.filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

    // Get total balance from wallets
    const { data: wallets } = await supabase
      .from('wallet_balances')
      .select('current_balance')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const totalBalance = wallets?.reduce((sum, w) => sum + parseFloat(w.current_balance), 0) || 0;

    const response: OverviewStatsResponse = {
      stats: {
        totalIncome,
        totalExpenses,
        netCashFlow,
        totalBalance,
        transactionCount: currentTxs?.length || 0,
        topCategory: null, // TODO: Calculate top category
        compared: {
          income: {
            amount: totalIncome - lastMonthIncome,
            percentage:
              lastMonthIncome > 0 ? ((totalIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0,
          },
          expenses: {
            amount: totalExpenses - lastMonthExpenses,
            percentage:
              lastMonthExpenses > 0
                ? ((totalExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
                : 0,
          },
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
