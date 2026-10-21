import { Directory } from 'expo-file-system';
import { useState } from 'react';

import { ProfileRow } from '@/components/profile/profile-row';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  categoryNameMap$,
  transactions$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import { showToast } from '@/lib/toast/toast-store';
import { tid } from '@/lib/test-ids';
import {
  exportFileName,
  transactionsCsv,
} from '@/lib/transactions/export-csv';

type ExportState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; fileName: string };

function cancelled(error: unknown): boolean {
  return error instanceof Error && /cancel/i.test(error.message);
}

/** Export data: picks a folder through Android's file picker and writes one CSV there. */
export function ExportDataRow({ userId }: { userId: string | null }) {
  const tokens = useThemeTokens();
  const [state, setState] = useState<ExportState>({ kind: 'idle' });

  const save = async () => {
    setState({ kind: 'saving' });
    try {
      const walletNames = Object.fromEntries(
        walletsForUser$(userId)
          .peek()
          .map((wallet) => [wallet.id, wallet.name]),
      );
      const csv = transactionsCsv(
        transactions$({ userId }).peek(),
        walletNames,
        categoryNameMap$(userId).peek(),
      );
      const folder = await Directory.pickDirectoryAsync();
      const fileName = exportFileName(new Date());
      folder.createFile(fileName, 'text/csv').write(csv);
      setState({ kind: 'saved', fileName });
    } catch (error) {
      setState({ kind: 'idle' });
      if (!cancelled(error)) {
        showToast({ text: "Couldn't save the CSV. Try again.", tone: 'removed' });
      }
    }
  };

  const saved = state.kind === 'saved';
  return (
    <ProfileRow
      icon="download"
      tint="sand"
      title="Export data"
      meta={saved ? `Saved ${state.fileName}` : 'A CSV of every transaction'}
      accessory={
        <Press
          testID={tid('profile', 'export-csv')}
          onPress={() => void save()}
          disabled={state.kind === 'saving'}
          accessibilityLabel={saved ? 'Saved. Export again' : 'Export a CSV'}
          accessibilityState={{ busy: state.kind === 'saving' }}
          radius={{ rest: 22, pressed: 16 }}
          pressedClassName={saved ? 'bg-mint/60' : 'bg-hairline'}
          className={`h-11 flex-row items-center gap-1.5 pl-2.5 pr-3.5 ${saved ? 'bg-primary-muted' : 'bg-sand'}`}
        >
          <IconSymbol
            name={saved ? 'check' : 'download'}
            size={18}
            color={saved ? tokens.states.approved : tokens.foreground}
          />
          <Text
            className={`text-[15px] leading-5 font-display-semibold ${saved ? 'text-state-approved' : 'text-foreground'}`}
          >
            {saved ? 'Saved' : 'CSV'}
          </Text>
        </Press>
      }
    />
  );
}
