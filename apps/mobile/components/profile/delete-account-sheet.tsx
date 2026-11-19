import { useState } from 'react';
import { View } from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { useExportCsv } from '@/components/profile/export-data-row';
import { Button } from '@/components/ui/button';
import { Sheet, type SheetFrameProps } from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { deleteAccount } from '@/lib/auth/account-functions';
import type { SheetRequestOf } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';

/** DELETE in any letter case, pasted or typed, with stray spaces. */
function confirmsDeletion(typed: string): boolean {
  return typed.trim().toUpperCase() === 'DELETE';
}

/**
 * Profile's Delete your account: one line on what goes, Export data first, and Delete my account,
 * which waits for DELETE. It calls the Edge Function and resolves once the account is gone; the
 * caller signs out.
 */
export function DeleteAccountSheet({
  request,
  onDeleted,
  ...frame
}: SheetFrameProps & { request: SheetRequestOf<'deleteAccount'>; onDeleted: () => void }) {
  const exportCsv = useExportCsv(request.userId);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const confirmed = confirmsDeletion(typed);

  const remove = async () => {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setFailure(null);
    const result = await deleteAccount();
    if (result.kind === 'ok') {
      onDeleted();
      return;
    }
    setDeleting(false);
    setFailure(
      result.kind === 'unreachable'
        ? "Couldn't reach Moni. Check your connection and try again."
        : `Couldn't delete your account. ${result.message}`,
    );
  };

  return (
    <Sheet
      {...frame}
      size="fit"
      title="Delete your account"
      note="Everything Moni keeps for you goes for good, on every device."
      actions={
        <>
          <Button
            testID={tid('profile', 'delete', 'cancel')}
            className="flex-1"
            pinned
            variant="secondary"
            label="Cancel"
            onPress={frame.onDismiss}
          />
          <Button
            testID={tid('profile', 'delete', 'submit')}
            className="flex-1"
            pinned
            variant="destructive"
            label="Delete my account"
            loadingLabel="Deleting"
            loading={deleting}
            disabled={!confirmed}
            onPress={() => void remove()}
          />
        </>
      }
    >
      <View className="gap-3">
        <Button
          testID={tid('profile', 'delete', 'export')}
          variant="tertiary"
          icon="download"
          label="Export data first"
          loading={exportCsv.busy}
          onPress={() => void exportCsv.share()}
          className="self-start"
        />
        <AuthField
          testID={tid('profile', 'delete', 'confirm')}
          label="Type DELETE to confirm"
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="done"
          onSubmitEditing={() => void remove()}
        />
        {failure ? (
          <Text
            variant="body"
            className="text-over"
            accessibilityLiveRegion="polite"
          >
            {failure}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
