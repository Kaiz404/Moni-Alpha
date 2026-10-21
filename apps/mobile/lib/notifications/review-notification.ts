/**
 * The Android review notification (R2) on expo-notifications. Swapping the library touches
 * only this file: payloads live in review-notification.core.js, decisions in review-actions.
 */
import { observe, syncState, when, type Observable } from '@legendapp/state';
import type { ProposedTransaction } from '@repo/types';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

import { merchantName } from '@/lib/finance/merchant-name';
import { captureSourceLabel } from '@/lib/proposals/capture-source';
import {
  approve,
  dontAskAboutSimilar,
  later,
  notMine,
  undo,
  type ApprovedOutcome,
} from '@/lib/proposals/review-actions';
import {
  ALL_STORE_OBSERVABLES,
  autoAddRules$,
  categories$,
  enableStoreSync,
  proposedTransactions$,
  transactions$,
  wallets$,
} from '@/lib/store';
import { authReady$ } from '@/lib/store/auth-sync';
import { getRecordValues } from '@/lib/store/helpers';
import { supabase } from '@/lib/supabase/client';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { listAwaitingReview } from '@/lib/supabase/proposed-transactions';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import { resolveInitialWalletId } from '@/lib/wallets/proposal-wallet';
import { readLinkedPackagesFromCache } from './linked-packages-cache';
import {
  APPROVED_ACTIONS,
  APPROVED_CATEGORY,
  APPROVED_MS,
  HEADS_UP_CHANNEL,
  QUIET_CHANNEL,
  REVIEW_ACTIONS,
  REVIEW_CATEGORY,
  buildApprovedNotification,
  buildOpenAppNotification,
  buildReviewNotification,
  identifierFor,
} from './review-notification.core.js';

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
type ReviewData = { kind: 'review' | 'approved'; proposalId: string; outcome?: ApprovedOutcome };

/** A Later row snoozed past any real date still counts as unreviewed. */
const END_OF_TIME = new Date(8.64e15);
/** Bounds the wait for Supabase to accept the writes before the headless task ends. */
const SYNC_WAIT_MS = 10_000;
const FIRST_SHOWN_KEY = 'first-review-alert-shown';
const storage = createMMKV({ id: 'moni-review-notification' });

let setup: Promise<void> | null = null;

function ensureSetup(): Promise<void> {
  setup ??= (async () => {
    await Notifications.setNotificationChannelAsync(HEADS_UP_CHANNEL, {
      name: 'New capture',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync(QUIET_CHANNEL, {
      name: 'Captures to review',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    const buttons = (actions: { id: string; title: string }[]) =>
      actions.map((action) => ({
        identifier: action.id,
        buttonTitle: action.title,
        options: { opensAppToForeground: false },
      }));
    await Notifications.setNotificationCategoryAsync(REVIEW_CATEGORY, buttons(REVIEW_ACTIONS));
    await Notifications.setNotificationCategoryAsync(APPROVED_CATEGORY, buttons(APPROVED_ACTIONS));
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
  return { amountMinor: proposal.amountMinor ?? 0, currency: proposal.currency };
}

function reviewPayload(proposal: ProposedTransaction, firstAlert: boolean): Payload {
  const category = getRecordValues<{ id: string; name: string | null }>(categories$).find(
    (c) => c.id === proposal.categoryId,
  );
  return buildReviewNotification({
    proposalId: proposal.id,
    sourceLabel: captureSourceLabel(proposal),
    merchant: shownMerchant(proposal),
    ...amountOf(proposal),
    categoryName: category?.name ?? null,
    firstAlert,
  });
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

async function waitForSync(tables: Observable<unknown>[]): Promise<void> {
  const synced = Promise.all(
    tables.map((table$) => when(() => (syncState(table$).numPendingSets.get() ?? 0) === 0)),
  );
  await Promise.race([synced, new Promise((resolve) => setTimeout(resolve, SYNC_WAIT_MS))]);
}

/**
 * With the app killed, nothing has turned sync on: the React tree's StoreSyncActivator does
 * that. Turn it on here for a signed-in user, run the decision, and wait for Supabase.
 */
async function withStore(run: () => Promise<void>): Promise<void> {
  if (authReady$.peek()) {
    await run();
    return;
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return;
  const disposers = ALL_STORE_OBSERVABLES.map((obs$) => observe(() => obs$.get()));
  authReady$.set(true);
  try {
    await enableStoreSync();
    await run();
    await waitForSync([transactions$, proposedTransactions$, autoAddRules$]);
  } finally {
    disposers.forEach((dispose) => dispose());
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function clearApprovedLater(proposalId: string): Promise<void> {
  await sleep(APPROVED_MS);
  const shown = await Notifications.getPresentedNotificationsAsync();
  const still = shown.find(
    (n) =>
      n.request.identifier === identifierFor(proposalId) &&
      (n.request.content.data as ReviewData | undefined)?.kind === 'approved',
  );
  if (still) await Notifications.dismissNotificationAsync(still.request.identifier);
}

async function act(action: string, data: ReviewData): Promise<void> {
  const id = identifierFor(data.proposalId);
  if (action === 'undo' || action === 'similar') {
    if (!data.outcome) return;
    if (action === 'similar') {
      await dontAskAboutSimilar(data.outcome);
      await Notifications.dismissNotificationAsync(id);
      return;
    }
    await undo(data.outcome);
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
    if (result.status === 'done') await Notifications.dismissNotificationAsync(id);
    return;
  }
  if (action !== 'approve') return;

  const wallets = getRecordValues<{ id: string; currency: string | null }>(wallets$);
  const result = await approve(proposal, {
    walletId: resolveInitialWalletId(proposal, wallets, getDefaultWalletId()),
  });
  const shown = { proposalId: proposal.id, merchant: shownMerchant(proposal), ...amountOf(proposal) };
  if (result.status === 'done' && result.outcome.action === 'approve') {
    await present(buildApprovedNotification({ ...shown, outcome: result.outcome }));
    await clearApprovedLater(proposal.id);
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
  const data = response.notification.request.content.data as ReviewData | undefined;
  if (!data?.proposalId || response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return;
  }
  try {
    await withStore(() => act(response.actionIdentifier, data));
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
  const data = response.notification.request.content.data as ReviewData | undefined;
  return data?.kind === 'review' || data?.kind === 'approved' ? data.proposalId : null;
}

/** Android 13+ needs POST_NOTIFICATIONS. Asked once a banking app is linked, never before. */
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
