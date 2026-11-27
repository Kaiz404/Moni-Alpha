import { router } from 'expo-router';

type Kind = 'expense' | 'income';

let waiting: ((categoryId: string | null) => void) | null = null;

/** The category form's answer: the id it created, or null once it closes without one. */
export function settleNewCategory(categoryId: string | null) {
  const resolve = waiting;
  waiting = null;
  resolve?.(categoryId);
}

/**
 * Opens the category form over the page that asked, and resolves to the category it creates, so the
 * caller picks it on the same screen it left: the Review card, Type it, or a transaction.
 */
export function pickNewCategory(type: Kind): Promise<string | null> {
  settleNewCategory(null);
  return new Promise((resolve) => {
    waiting = resolve;
    router.push({ pathname: '/categories/form', params: { type } });
  });
}
