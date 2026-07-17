/**
 * Pure geometry and derivation helpers shared by the SVG charts. Keeping
 * these functions independent from React Native makes their finance and
 * accessibility behaviour inexpensive to test.
 */

const TAU = Math.PI * 2;

export type DonutValue = {
  value: number;
};

export type DonutSegment = {
  index: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  percentage: number;
};

export function buildDonutSegments(
  values: DonutValue[],
  startAngle = -Math.PI / 2,
): DonutSegment[] {
  const total = values.reduce(
    (sum, item) => sum + Math.max(0, item.value),
    0,
  );
  if (total <= 0) return [];

  let cursor = startAngle;
  return values.flatMap((item, index) => {
    const percentage = Math.max(0, item.value) / total;
    if (percentage <= 0) return [];
    const endAngle = cursor + percentage * TAU;
    const segment = {
      index,
      startAngle: cursor,
      endAngle,
      midAngle: cursor + (endAngle - cursor) / 2,
      percentage,
    };
    cursor = endAngle;
    return [segment];
  });
}

export function arcPath(
  center: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const startX = center + radius * Math.cos(startAngle);
  const startY = center + radius * Math.sin(startAngle);
  const endX = center + radius * Math.cos(endAngle);
  const endY = center + radius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

export function findDonutSegmentAtAngle(
  segments: DonutSegment[],
  angle: number,
): number | null {
  const normalized = ((angle % TAU) + TAU) % TAU;
  for (const segment of segments) {
    const start = ((segment.startAngle % TAU) + TAU) % TAU;
    const end = ((segment.endAngle % TAU) + TAU) % TAU;
    const contains =
      start <= end
        ? normalized >= start && normalized <= end
        : normalized >= start || normalized <= end;
    if (contains) return segment.index;
  }
  return null;
}

export type LineValue = {
  x: number;
  y: number;
};

export type ChartPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ProjectedLinePoint = LineValue & {
  chartX: number;
  chartY: number;
};

export function projectLinePoints(
  points: LineValue[],
  width: number,
  height: number,
  padding: ChartPadding,
): ProjectedLinePoint[] {
  if (!points.length) return [];
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = Math.max(1, height - padding.top - padding.bottom);

  return points.map((point, index) => ({
    ...point,
    chartX:
      points.length === 1
        ? padding.left + plotWidth / 2
        : padding.left + ((point.x - xMin) / xRange) * plotWidth,
    chartY:
      yMin === yMax
        ? padding.top + plotHeight / 2
        : padding.top + plotHeight - ((point.y - yMin) / yRange) * plotHeight,
  }));
}

export function findNearestLinePointIndex(
  points: ProjectedLinePoint[],
  x: number,
): number | null {
  if (!points.length) return null;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const distance = Math.abs(point.chartX - x);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

export type ActivityDay = {
  dateKey: string;
  amount: number;
  transactionCount: number;
};

export type CalendarCell = {
  dateKey: string | null;
  day: number | null;
  amount: number;
  transactionCount: number;
  intensity: number;
};

export function buildActivityCalendar(
  month: string,
  activities: ActivityDay[],
): CalendarCell[] {
  const parsed = /^(\d{4})-(\d{2})$/.exec(month);
  if (!parsed) return [];
  const year = Number(parsed[1]);
  const monthIndex = Number(parsed[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return [];

  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const byDate = new Map(activities.map((activity) => [activity.dateKey, activity]));
  const maxAmount = Math.max(0, ...activities.map((activity) => activity.amount));
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) {
      return {
        dateKey: null,
        day: null,
        amount: 0,
        transactionCount: 0,
        intensity: 0,
      };
    }
    const dateKey = `${month}-${String(day).padStart(2, '0')}`;
    const activity = byDate.get(dateKey);
    const amount = activity?.amount ?? 0;
    return {
      dateKey,
      day,
      amount,
      transactionCount: activity?.transactionCount ?? 0,
      intensity: maxAmount > 0 ? amount / maxAmount : 0,
    };
  });
}

export function previousMonthKey(month: string): string {
  const parsed = /^(\d{4})-(\d{2})$/.exec(month);
  if (!parsed) return month;
  const value = new Date(Date.UTC(Number(parsed[1]), Number(parsed[2]) - 2, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

export type MonthlyTakeaway = {
  headline: string;
  detail: string;
  trend: 'empty' | 'first_month' | 'up' | 'down' | 'steady';
};

export function buildMonthlyTakeaway({
  total,
  previousTotal,
  leadingCategoryName,
}: {
  total: number;
  previousTotal: number;
  leadingCategoryName: string | null;
}): MonthlyTakeaway {
  if (total <= 0) {
    return {
      headline: 'No spending recorded yet',
      detail: 'Record an expense to start seeing your monthly pattern.',
      trend: 'empty',
    };
  }

  const category = leadingCategoryName ?? 'Uncategorized spending';
  if (previousTotal <= 0) {
    return {
      headline: `${category} leads this month`,
      detail: 'This is your first month with comparable recorded spending.',
      trend: 'first_month',
    };
  }

  const change = Math.round((Math.abs(total - previousTotal) / previousTotal) * 100);
  if (change < 5) {
    return {
      headline: 'Spending is holding steady',
      detail: `${category} is still your largest expense category.`,
      trend: 'steady',
    };
  }
  if (total > previousTotal) {
    return {
      headline: `Spending is up ${change}% this month`,
      detail: `${category} is the largest contributor.`,
      trend: 'up',
    };
  }
  return {
    headline: `Spending is down ${change}% this month`,
    detail: `${category} remains the largest expense category.`,
    trend: 'down',
  };
}
