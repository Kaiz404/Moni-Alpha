import { useValue } from '@legendapp/state/react';
import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '@/components/ui/empty-tile';
import { Page } from '@/components/ui/page';
import { WalletForm } from '@/components/wallets/wallet-form';
import { DEFAULT_WALLET_CARD_STYLE_ID } from '@/constants/wallet-card-styles';
import { WALLET_TYPE_OPTIONS } from '@/constants/wallet-form';
import { useAuth } from '@/lib/auth/auth-context';
import { transactions$, walletById$ } from '@/lib/finance/selectors';
import { useWalletAlertLink } from '@/lib/wallets/wallet-link';

/** `/wallet/edit?id=<walletId>`: Edit wallet, pushed from the wallet page's ⋯ menu. */
export default function EditWalletScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const wallet = useValue(walletById$(id));
  const link = useWalletAlertLink(id);
  const transactionCount = useValue(
    () =>
      transactions$({ userId: user?.id ?? null, walletId: id })
        .get()
        .filter((transaction) => transaction.walletId === id).length,
  );

  if (!wallet) {
    return (
      <Page
        screen="wallet"
        kind="task"
        title="Edit wallet"
      >
        <NotFound
          icon="wallet"
          title="This wallet isn't here any more"
          body="It may have been deleted on another phone."
        />
      </Page>
    );
  }

  return (
    <WalletForm
      key={wallet.id}
      mode={{ kind: 'edit', walletId: wallet.id, transactionCount }}
      initial={{
        name: wallet.name,
        type:
          WALLET_TYPE_OPTIONS.find(
            (option) => option.value === wallet.type,
          )?.value ?? 'bank',
        currency: wallet.currency,
        cardStyleId:
          wallet.cardStyleId ?? DEFAULT_WALLET_CARD_STYLE_ID,
        link,
      }}
    />
  );
}
