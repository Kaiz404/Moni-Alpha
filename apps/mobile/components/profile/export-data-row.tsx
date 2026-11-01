import { useState } from 'react';

import { ProfileRow } from '@/components/profile/profile-row';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { buildMoniExport, exportFileName } from '@/lib/backup/moni-export';
import { shareCsv } from '@/lib/backup/share-file';
import { readBackupTables } from '@/lib/backup/store-tables';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

/** Export data: one CSV of everything Moni keeps, handed to the Android share sheet. */
export function ExportDataRow({ userId }: { userId: string | null }) {
  const tokens = useThemeTokens();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const now = new Date();
      await shareCsv(exportFileName(now), buildMoniExport(readBackupTables(userId), userId, now));
    } catch {
      showToast({ text: "Couldn't make the CSV. Try again.", tone: 'removed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProfileRow
      icon="download"
      tint="sand"
      title="Export data"
      meta="A CSV of everything in Moni"
      accessory={
        <Press
          testID={tid('profile', 'export-csv')}
          onPress={() => void share()}
          disabled={busy}
          accessibilityLabel="Export a CSV"
          accessibilityHint="Opens the share sheet"
          accessibilityState={{ busy }}
          radius={{ rest: 22, pressed: 16 }}
          pressedClassName="bg-hairline"
          className="h-11 flex-row items-center gap-1.5 bg-sand pl-2.5 pr-3.5"
        >
          <IconSymbol
            name="download"
            size={18}
            color={tokens.foreground}
          />
          <Text className="text-[15px] leading-5 font-display-semibold text-foreground">CSV</Text>
        </Press>
      }
    />
  );
}
