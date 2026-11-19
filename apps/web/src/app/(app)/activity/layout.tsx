import type { Metadata } from 'next';
import { ActivityScreen } from '@/components/activity/activity-screen';

export const metadata: Metadata = { title: 'Activity · Moni' };

/** One screen for /activity and /activity/<id>: the open row is the path, so the list never remounts. */
export default function ActivityLayout() {
  return <ActivityScreen />;
}
