import { useValue } from '@legendapp/state/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import { NotFound } from '@/components/ui/empty-tile';
import { Page } from '@/components/ui/page';
import { WalletHero } from '@/components/wallets/wallet-hero';
import { WalletMenu } from '@/components/wallets/wallet-menu';
import {
  ReviewStrip,
  WalletAlerts,
  WalletTransactions,
} from '@/components/wallets/wallet-sections';
import { useAuth } from '@/lib/auth/auth-context';
import {
  categoriesForUser$,
  pendingProposals$,
  transactions$,
  walletBalanceMinor$,
  walletById$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import type { RowLookups } from '@/lib/transactions/row';
import { confirmDeleteWallet } from '@/lib/wallets/delete-wallet';
import { useWalletAlertLink } from '@/lib/wallets/wallet-link';

/**
 * V2H-WalletDetail at `/wallet/<id>`. `?edit=balance` opens it with the
 * balance field focused: the Home check-in's Fix it uses it.
 */
export default function WalletScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    edit?: string;
  }>();
  const id = params.id ?? '';
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const wallet = useValue(walletById$(id));
  const balanceMinor = useValue(walletBalanceMinor$(id));
  const link = useWalletAlertLink(id);
  const transactions = useValue(
    transactions$({ userId, walletId: id }),
  );
  const proposals = useValue(pendingProposals$(userId));
  const wallets = useValue(walletsForUser$(userId));
  const categories = useValue(categoriesForUser$(userId));

  const lookups = useMemo<RowLookups>(
    () => ({
      categoriesById: Object.fromEntries(
        categories.map((category) => [category.id, category]),
      ),
      walletNames: Object.fromEntries(
        wallets.map((item) => [item.id, item.name]),
      ),
    }),
    [categories, wallets],
  );
  const waiting = useMemo(
    () =>
      proposals.filter(
        (proposal) =>
          proposal.walletId === id &&
          proposal.currency === wallet?.currency,
      ),
    [id, proposals, wallet?.currency],
  );

  // The page closes itself once its wallet is deleted, here, from Edit wallet, or on another phone.
  const seen = useRef(false);
  useEffect(() => {
    if (wallet) seen.current = true;
    else if (seen.current && router.canGoBack()) router.back();
  }, [wallet]);

  if (!wallet) {
    return (
      <Page
        screen="wallet"
        kind="pushed"
        title="Wallet"
      >
        <NotFound
          icon="wallet"
          title="This wallet isn't here any more"
          body="It may have been deleted on another phone."
        />
      </Page>
    );
  }

  const ownRows = transactions.filter(
    (transaction) => transaction.walletId === wallet.id,
  ).length;

  return (
    <Page
      screen="wallet"
      kind="pushed"
      title="Wallet"
      trailing={
        <WalletMenu
          walletName={wallet.name}
          onEdit={() =>
            router.push({
              pathname: '/wallet/edit',
              params: { id: wallet.id },
            })
          }
          onDelete={() => void confirmDeleteWallet(wallet, ownRows)}
        />
      }
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3.5 px-5 pb-10"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <WalletHero
            key={wallet.id}
            wallet={wallet}
            balanceMinor={balanceMinor}
            link={link}
            initialEdit={params.edit === 'balance' ? 'balance' : null}
          />
          <ReviewStrip
            proposals={waiting}
            currency={wallet.currency}
          />
          <WalletTransactions
            wallet={wallet}
            transactions={transactions}
            lookups={lookups}
          />
          <WalletAlerts
            wallet={wallet}
            link={link}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Page>
  );
}
