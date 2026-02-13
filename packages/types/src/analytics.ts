import { z } from 'zod';

// Analytics time period enum
export const analyticsPeriodSchema = z.enum([
  'day',
  'week',
  'month',
  'quarter',
  'year',
  'all',
]);

// Overview stats response
export const overviewStatsSchema = z.object({
  totalIncome: z.number(),
  totalExpenses: z.number(),
  netCashFlow: z.number(),
  totalBalance: z.number(),
  transactionCount: z.number(),
  topCategory: z.object({
    id: z.string().uuid(),
    name: z.string(),
    amount: z.number(),
    percentage: z.number(),
  }).nullable(),
  compared: z.object({
    income: z.object({
      amount: z.number(),
      percentage: z.number(),
    }),
    expenses: z.object({
      amount: z.number(),
      percentage: z.number(),
    }),
  }),
});

// Spending by category
export const categorySpendingSchema = z.object({
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  categoryIcon: z.string(),
  categoryColor: z.string(),
  amount: z.number(),
  percentage: z.number(),
  transactionCount: z.number(),
});

// Spending by wallet
export const walletSpendingSchema = z.object({
  walletId: z.string().uuid(),
  walletName: z.string(),
  walletType: z.string(),
  walletIcon: z.string(),
  walletColor: z.string(),
  income: z.number(),
  expenses: z.number(),
  netFlow: z.number(),
  transactionCount: z.number(),
});

// Time series data point
export const timeSeriesDataPointSchema = z.object({
  date: z.string().datetime(),
  income: z.number(),
  expenses: z.number(),
  net: z.number(),
  transactionCount: z.number(),
});

// Top merchant
export const topMerchantSchema = z.object({
  merchant: z.string(),
  amount: z.number(),
  transactionCount: z.number(),
  averageAmount: z.number(),
});

// Income vs expense comparison
export const incomeVsExpenseSchema = z.object({
  period: analyticsPeriodSchema,
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  income: z.number(),
  expenses: z.number(),
  net: z.number(),
  savingsRate: z.number(), // percentage
});

// Type inference
export type AnalyticsPeriod = z.infer<typeof analyticsPeriodSchema>;
export type OverviewStats = z.infer<typeof overviewStatsSchema>;
export type CategorySpending = z.infer<typeof categorySpendingSchema>;
export type WalletSpending = z.infer<typeof walletSpendingSchema>;
export type TimeSeriesDataPoint = z.infer<typeof timeSeriesDataPointSchema>;
export type TopMerchant = z.infer<typeof topMerchantSchema>;
export type IncomeVsExpense = z.infer<typeof incomeVsExpenseSchema>;

// API Response types
export type OverviewStatsResponse = {
  stats: OverviewStats;
};

export type SpendingByCategoryResponse = {
  categories: CategorySpending[];
  period: AnalyticsPeriod;
  startDate: string;
  endDate: string;
};

export type SpendingByWalletResponse = {
  wallets: WalletSpending[];
  period: AnalyticsPeriod;
  startDate: string;
  endDate: string;
};

export type SpendingOverTimeResponse = {
  data: TimeSeriesDataPoint[];
  period: AnalyticsPeriod;
  startDate: string;
  endDate: string;
};

export type TopMerchantsResponse = {
  merchants: TopMerchant[];
  period: AnalyticsPeriod;
  startDate: string;
  endDate: string;
  limit: number;
};

export type IncomeVsExpenseResponse = {
  comparison: IncomeVsExpense;
};
