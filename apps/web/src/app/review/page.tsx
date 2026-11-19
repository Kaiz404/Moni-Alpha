import { redirect } from 'next/navigation';
import { oldReviewHref } from '@/lib/review-view';

/** Review used to be its own page; old links and bookmarks open Home with the drawer (#104). */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { view, capture } = await searchParams;
  redirect(oldReviewHref(typeof view === 'string' ? view : null, typeof capture === 'string' ? capture : null));
}
