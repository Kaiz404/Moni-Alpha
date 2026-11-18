/**
 * The Android review notification (R2) on expo-notifications. Swapping the library touches
 * only this file: payloads live in review-notification.core.js, decisions in review-actions.
 */
import { decimalToMinor, type MinorAmount, type ProposedTransaction } from '@repo/types';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

import { merchantKey } from '@/lib/ai/routine';
import { merchantName } from '@/lib/finance/merchant-name';
import { financeProjection$, rehydrateFinanceProjection } from '@/lib/finance/projection';
import { budgetProgress$ } from '@/lib/finance/selectors';
import { budgetLine } from '@/lib/proposals/budget-line';
import { captureBankName } from '@/lib/proposals/capture-source';
import {
  approve,
  dontAskAboutSimilar,
  later,
  notMine,
  undo,
  type ReviewOutcome,
} from '@/lib/proposals/review-actions';
import {
  autoAddRules$,
  categories$,
  proposedTransactions$,
  transactions$,
  wallets$,
} from '@/lib/store';
import { withStore } from '@/lib/store/headless-sync';
import { getRecordValues } from '@/lib/store/helpers';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { listAwaitingReview } from '@/lib/supabase/proposed-transactions';
import { deleteTransaction } from '@/lib/supabase/transactions';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import { resolveInitialWalletId } from '@/lib/wallets/proposal-wallet';
import { readLinkedPackagesFromCache } from './linked-packages-cache';
import {
  ACCENT,
  AUTO_ADDED_ACTIONS,
  AUTO_ADDED_CATEGORY,
  AUTO_ADDED_CHANNEL,
  AUTO_ADDED_IDENTIFIER,
  APPROVED_ACTIONS,
  APPROVED_CATEGORY,
  APPROVED_MS,
  DECIDED_ACTIONS,
  DECIDED_CATEGORY,
  HEADS_UP_CHANNEL,
  QUIET_CHANNEL,
  REVIEW_ACTIONS,
  REVIEW_CATEGORY,
  addToAutoAddedDigest,
  buildApprovedNotification,
  buildAutoAddedDigestNotification,
  buildAutoAddedNotification,
  buildOpenAppNotification,
  buildReviewNotification,
  buildSetAsideNotification,
  identifierFor,
} from './review-notification.core.js';
import { deviceCalendar } from '@/lib/dates/device-calendar';

export { REVIEW_TASK, isOwnNotification } from './review-notification.core.js';

/** What every builder in the core returns. */
type Payload = {
  identifier: string;
  channelId: string;
  title: string;
  subtitle: string | null;
  body: string;
  categoryIdentifier: string | null;
  actionIds: string[];
  data: Record<string, unknown>;
};
/** `decided` carries the outcome its Undo (and, after Approve, Don't ask about similar) needs. */
type ReviewData =
  | { kind: 'review'; proposalId: string }
  | { kind: 'decided'; proposalId: string; outcome: ReviewOutcome };
/** The day's auto-added digest: its latest transaction, and how many it counts. */
type AutoAddedData = { kind: 'auto-added'; transactionId: string; count: number };
type NotificationData = ReviewData | AutoAddedData;

type AutoAddedItem = {
  transactionId: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  type: string;
};
type AutoAddedDigest = { day: string; items: AutoAddedItem[] };

/** A Later row snoozed past any real date still counts as unreviewed. */
const END_OF_TIME = new Date(8.64e15);
const FIRST_SHOWN_KEY = 'first-review-alert-shown';
const DIGEST_KEY = 'auto-added-digest';
const storage = createMMKV({ id: 'moni-review-notification' });

let setup: Promise<void> | null = null;

function ensureSetup(): Promise<void> {
  setup ??= (async () => {
    // Money stays off the lock screen (`XA-Notification` 4). Android keeps a channel's first settings.
    await Notifications.setNotificationChannelAsync(HEADS_UP_CHANNEL, {
      name: 'New capture',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    await Notifications.setNotificationChannelAsync(QUIET_CHANNEL, {
      name: 'Captures to review',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    // Shade only: no sound and no heads-up, because nothing waits on the user.
    await Notifications.setNotificationChannelAsync(AUTO_ADDED_CHANNEL, {
      name: 'Added automatically',
      importance: Notifications.AndroidImportance.LOW,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    const buttons = (actions: { id: string; title: string }[]) =>
      actions.map((action) => ({
        identifier: action.id,
        buttonTitle: action.title,
        options: { opensAppToForeground: false },
      }));
    await Notifications.setNotificationCategoryAsync(REVIEW_CATEGORY, buttons(REVIEW_ACTIONS));
    await Notifications.setNotificationCategoryAsync(APPROVED_CATEGORY, buttons(APPROVED_ACTIONS));
    await Notifications.setNotificationCategoryAsync(DECIDED_CATEGORY, buttons(DECIDED_ACTIONS));
    await Notifications.setNotificationCategoryAsync(AUTO_ADDED_CATEGORY, buttons(AUTO_ADDED_ACTIONS));
  })().catch((error: unknown) => {
    setup = null;
    throw error;
  });
  return setup;
}

async function present(payload: Payload): Promise<void> {
  await ensureSetup();
  await Notifications.scheduleNotificationAsync({
    identifier: payload.identifier,
    content: {
      title: payload.title,
      subtitle: payload.subtitle ?? undefined,
      body: payload.body,
      color: ACCENT,
      data: payload.data,
      categoryIdentifier: payload.categoryIdentifier ?? undefined,
    },
    trigger: { channelId: payload.channelId },
  });
}

function findProposal(id: string): ProposedTransaction | undefined {
  return listAwaitingReview(END_OF_TIME).find((p) => p.id === id);
}

function shownMerchant(proposal: ProposedTransaction): string {
  const aliases = proposal.userId ? listMerchantAliases(proposal.userId) : [];
  return merchantName(proposal.merchant, aliases) ?? proposal.description ?? 'Capture';
}

function amountOf(proposal: ProposedTransaction) {
  return { amountMinor: proposal.amountMinor ?? 0, currency: proposal.currency, type: proposal.type };
}

function categoryOf(proposal: ProposedTransaction) {
  return getRecordValues<{ id: string; name: string | null }>(categories$).find(
    (c) => c.id === proposal.categoryId,
  );
}

/** How many ledger rows from this merchant the user filed under the capture's category. */
function seenCount(proposal: ProposedTransaction): number {
  const key = merchantKey(proposal.merchant);
  if (!key || !proposal.categoryId) return 0;
  return getRecordValues<{ user_id: string; merchant: string | null; category_id: string | null }>(
    transactions$,
  ).filter(
    (row) =>
      row.user_id === proposal.userId &&
      row.category_id === proposal.categoryId &&
      merchantKey(row.merchant) === key,
  ).length;
}

function reviewPayload(proposal: ProposedTransaction, firstAlert: boolean): Payload {
  return buildReviewNotification({
    proposalId: proposal.id,
    bankName: captureBankName(proposal),
    merchant: shownMerchant(proposal),
    ...amountOf(proposal),
    alertText: proposal.notificationBody,
    categoryName: categoryOf(proposal)?.name ?? null,
    seenCount: seenCount(proposal),
    firstAlert,
  });
}

/**
 * "Food & Dining: RM76 left after this", read before Approve writes so the capture is not
 * counted twice. With the app killed the finance projection has not been built yet.
 */
function budgetTextBefore(proposal: ProposedTransaction): string | null {
  const category = categoryOf(proposal);
  if (proposal.type !== 'expense' || !category?.name || !proposal.userId) return null;
  if (!Object.keys(financeProjection$.categoriesById.peek()).length) rehydrateFinanceProjection();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const progress = budgetProgress$(proposal.userId, timezone)
    .peek()
    .find((p) => p.categoryId === category.id && p.currency === proposal.currency);
  return budgetLine(
    category.name,
    progress,
    (proposal.amountMinor ?? 0) as MinorAmount,
    proposal.currency,
  ).text;
}

/** Posts `XA-Notification` for a new notification capture. Never throws into the pipeline. */
export async function postReviewNotification(proposalId: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  const proposal = findProposal(proposalId);
  if (!proposal) return;
  try {
    const firstAlert = !storage.getBoolean(FIRST_SHOWN_KEY);
    await present(reviewPayload(proposal, firstAlert));
    if (firstAlert) storage.set(FIRST_SHOWN_KEY, true);
  } catch (error) {
    console.warn('[ReviewNotif] not posted:', error instanceof Error ? error.message : error);
  }
}

function readDigest(): AutoAddedDigest | null {
  try {
    const raw = storage.getString(DIGEST_KEY);
    return raw ? (JSON.parse(raw) as AutoAddedDigest) : null;
  } catch {
    return null;
  }
}

type TransactionRow = {
  id: string;
  user_id: string | null;
  merchant: string | null;
  description: string | null;
  amount: string | number | null;
  currency: string | null;
  type: string;
  category_id: string | null;
};

/** The category's month with this transaction already in it, so it counts once. */
function budgetTextAfter(row: TransactionRow): string | null {
  const category = getRecordValues<{ id: string; name: string | null }>(categories$).find(
    (c) => c.id === row.category_id,
  );
  if (row.type !== 'expense' || !category?.name || !row.user_id) return null;
  if (!Object.keys(financeProjection$.categoriesById.peek()).length) rehydrateFinanceProjection();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const currency = row.currency ?? 'MYR';
  const progress = budgetProgress$(row.user_id, timezone)
    .peek()
    .find((p) => p.categoryId === category.id && p.currency === currency);
  return budgetLine(category.name, progress, 0 as MinorAmount, currency).text;
}

/**
 * Posts or replaces the day's "Added automatically" digest for a transaction Moni added without
 * asking (`XA-Notification`, LOW). Never throws into the pipeline.
 */
export async function postAutoAddedNotification(transactionId: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  const row = transactions$[transactionId].peek() as TransactionRow | undefined;
  if (!row) return;
  try {
    const amountMinor = Math.abs(decimalToMinor(row.amount ?? 0));
    const aliases = row.user_id ? listMerchantAliases(row.user_id) : [];
    const digest = addToAutoAddedDigest(
      readDigest(),
      {
        transactionId,
        merchant: merchantName(row.merchant, aliases) ?? row.description ?? 'Transaction',
        amountMinor,
        currency: row.currency ?? 'MYR',
        type: row.type,
      },
      deviceCalendar.dayKey(new Date()),
    ) as AutoAddedDigest;
    storage.set(DIGEST_KEY, JSON.stringify(digest));
    const categoryName =
      getRecordValues<{ id: string; name: string | null }>(categories$).find(
        (c) => c.id === row.category_id,
      )?.name ?? null;
    await present(
      buildAutoAddedDigestNotification({
        digest,
        categoryName,
        budgetText: budgetTextAfter(row),
      }),
    );
  } catch (error) {
    console.warn('[AutoAddedNotif] not posted:', error instanceof Error ? error.message : error);
  }
}

/** Undo on the digest: the latest add goes, and nothing more. */
async function undoAutoAdded(transactionId: string): Promise<void> {
  await deleteTransaction(transactionId);
  const digest = readDigest();
  if (digest) {
    const items = digest.items.filter((item) => item.transactionId !== transactionId);
    storage.set(DIGEST_KEY, JSON.stringify({ ...digest, items }));
  }
  await Notifications.dismissNotificationAsync(AUTO_ADDED_IDENTIFIER);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Shows a decision with its Undo, then clears it after APPROVED_MS unless Undo brought the capture back. */
async function showDecided(payload: Payload): Promise<void> {
  await present(payload);
  await sleep(APPROVED_MS);
  const shown = await Notifications.getPresentedNotificationsAsync();
  const still = shown.find(
    (n) =>
      n.request.identifier === payload.identifier &&
      (n.request.content.data as ReviewData | undefined)?.kind === 'decided',
  );
  if (still) await Notifications.dismissNotificationAsync(still.request.identifier);
}

async function act(action: string, data: ReviewData): Promise<void> {
  const id = identifierFor(data.proposalId);
  if (data.kind === 'decided') {
    const { outcome } = data;
    if (action === 'similar' && outcome.action === 'approve') {
      const ruled = await dontAskAboutSimilar(outcome);
      await present(
        buildAutoAddedNotification({
          proposalId: data.proposalId,
          merchant: shownMerchant(outcome.proposal),
          ...amountOf(outcome.proposal),
          outcome: ruled,
        }),
      );
      return;
    }
    if (action !== 'undo') return;
    await undo(outcome);
    const restored = findProposal(data.proposalId);
    if (restored) await present(reviewPayload(restored, false));
    return;
  }

  const proposal = findProposal(data.proposalId);
  if (!proposal) {
    await Notifications.dismissNotificationAsync(id);
    return;
  }
  if (action === 'not-mine' || action === 'later') {
    const result = action === 'later' ? await later(proposal) : await notMine(proposal);
    if (result.status === 'done') {
      await showDecided(buildSetAsideNotification({ proposalId: proposal.id, outcome: result.outcome }));
    }
    return;
  }
  if (action !== 'approve') return;

  const wallets = getRecordValues<{ id: string; currency: string | null }>(wallets$);
  const budgetText = budgetTextBefore(proposal);
  const result = await approve(proposal, {
    walletId: resolveInitialWalletId(proposal, wallets, getDefaultWalletId()),
  });
  const shown = { proposalId: proposal.id, merchant: shownMerchant(proposal), ...amountOf(proposal) };
  if (result.status === 'done' && result.outcome.action === 'approve') {
    await showDecided(buildApprovedNotification({ ...shown, budgetText, outcome: result.outcome }));
    return;
  }
  // Android blocks opening an activity from here, so the notification asks for a tap instead.
  await present(
    buildOpenAppNotification({
      ...shown,
      reason: result.status === 'needsInput' ? 'Pick a wallet in Moni' : "Couldn't save. Tap to review",
    }),
  );
}

/**
 * Runs a Not mine, Later, Approve, Undo or Don't ask about similar tap through
 * review-actions, with no React. A tap on the body opens the app instead.
 */
export async function handleReviewNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const data = response.notification.request.content.data as NotificationData | undefined;
  if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  if (data?.kind === 'auto-added') {
    if (response.actionIdentifier !== AUTO_ADDED_ACTIONS[0]!.id) return;
    try {
      await withStore([transactions$], () => undoAutoAdded(data.transactionId));
    } catch (error) {
      console.error('[AutoAddedNotif] Undo failed:', error instanceof Error ? error.message : error);
    }
    return;
  }
  if (!data?.proposalId) return;
  try {
    await withStore([transactions$, proposedTransactions$, autoAddRules$], () =>
      act(response.actionIdentifier, data),
    );
  } catch (error) {
    console.error('[ReviewNotif] action failed:', error instanceof Error ? error.message : error);
  }
}

/** The task body expo-task-manager runs for an action tap while the app is in the background or killed. */
export async function handleReviewNotificationTask(body: { data?: unknown }): Promise<void> {
  const payload = body.data;
  if (payload && typeof payload === 'object' && 'actionIdentifier' in payload) {
    await handleReviewNotificationResponse(payload as Notifications.NotificationResponse);
  }
}

export function reviewProposalIdOf(response: Notifications.NotificationResponse): string | null {
  const data = response.notification.request.content.data as NotificationData | undefined;
  return data?.kind === 'review' || data?.kind === 'decided' ? data.proposalId : null;
}

/** What a tap on the digest opens: the one transaction, or Activity for several. */
export function autoAddedTargetOf(
  response: Notifications.NotificationResponse,
): { transactionId: string; count: number } | null {
  const data = response.notification.request.content.data as NotificationData | undefined;
  return data?.kind === 'auto-added' ? { transactionId: data.transactionId, count: data.count } : null;
}

/** Android 13+ needs POST_NOTIFICATIONS. Asked once an app is linked, never before. */
export async function ensureReviewNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || readLinkedPackagesFromCache().length === 0) return;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return;
  await Notifications.requestPermissionsAsync();
}

/** While Moni is open its review notification still shows, quietly. */
export function showReviewNotificationsInForeground(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
