import {
  type DebtWalletChoice,
  NO_WALLET,
  pickDebtWallet,
} from '@/components/debts/debt-wallets';
import { WalletBubble } from '@/components/ui/field-bubble';
import { PickerField } from '@/components/ui/picker-field';
import type { TestId } from '@/lib/test-ids';
import { compactWalletNames, type FinanceWallet } from '@repo/core';

/**
 * Where a debt's money went: a wallet, or "Wallet: Not used" when no money moved. Empty shows
 * Choose until the user picks.
 */
export function DebtWalletField({
  testID,
  label,
  noneLabel,
  wallets,
  choice,
  onChoose,
}: {
  testID: TestId;
  label: string;
  /** The sheet's top row, such as "Money didn't leave my wallet". */
  noneLabel: string;
  wallets: FinanceWallet[];
  choice: DebtWalletChoice;
  onChoose: (choice: DebtWalletChoice) => void;
}) {
  const none = choice === NO_WALLET;
  const wallet = wallets.find((item) => item.id === choice) ?? null;
  return (
    <PickerField
      testID={testID}
      className="flex-1"
      label={none ? 'Wallet' : label}
      value={none ? 'Not used' : wallet ? compactWalletNames(wallets)[wallet.id] : ''}
      spokenValue={none ? noneLabel : wallet?.name}
      icon={none ? 'note-text-outline' : 'wallet-outline'}
      leading={wallet ? <WalletBubble wallet={wallet} /> : undefined}
      onPress={async () => {
        const picked = await pickDebtWallet(label, wallets, choice, noneLabel);
        if (picked) onChoose(picked);
      }}
    />
  );
}
