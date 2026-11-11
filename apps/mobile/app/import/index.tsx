import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useState } from 'react';

import { Banner } from '@/components/ui/banner';
import { EmptyTile } from '@/components/ui/empty-tile';
import { Page, PageScroll } from '@/components/ui/page';
import { useAuth } from '@/lib/auth/auth-context';
import { pickFile, readPickedFile, setImportSession } from '@/lib/backup/import-session';
import { storeHasPulled } from '@/lib/backup/store-tables';
import { tid } from '@/lib/test-ids';

/** Import data: choose a file; a Moni export goes to its preview, any other CSV to its columns. */
export default function ImportScreen() {
  const { user } = useAuth();
  const ready = useValue(storeHasPulled);
  const [problem, setProblem] = useState<string | null>(null);

  const choose = async () => {
    if (!user) return;
    setProblem(null);
    try {
      const picked = await pickFile();
      if (!picked) return;
      const read = readPickedFile(picked.name, picked.bytes, user.id);
      if (read.kind === 'problem') {
        setProblem(read.reason);
        return;
      }
      setImportSession(read.session);
      router.push(read.session.kind === 'restore' ? '/import/preview' : '/import/columns');
    } catch {
      setProblem("That file can't be opened. Try again.");
    }
  };

  return (
    <Page
      headerScrolls
      screen="import"
      kind="pushed"
      title="Import data"
    >
      <PageScroll
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {ready ? null : (
          <Banner
            tone="offline"
            title="Moni is still loading your data."
            body="Connect to the internet, and importing opens here."
          />
        )}
        {problem ? (
          <Banner
            tone="syncError"
            title={problem}
          />
        ) : null}
        <EmptyTile
          icon="file-upload-outline"
          title="Choose a CSV"
          body="A Moni export restores what it holds. Any other CSV gets a step to match its columns. You see what is new before anything is added."
          action={
            ready
              ? {
                  testID: tid('import', 'choose'),
                  label: 'Choose a file',
                  icon: 'file-outline',
                  onPress: () => void choose(),
                }
              : undefined
          }
        />
      </PageScroll>
    </Page>
  );
}
