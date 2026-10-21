import {
  newWalletValues,
  WalletForm,
} from '@/components/wallets/wallet-form';
import { useMainCurrency } from '@/lib/finance/main-currency';

export default function NewWalletScreen() {
  const currency = useMainCurrency();
  return (
    <WalletForm
      mode={{ kind: 'new' }}
      initial={newWalletValues(currency)}
    />
  );
}
