import { useValue } from '@legendapp/state/react';
import { userPreferencesSchema, type MoniTone } from '@repo/types';
import { useState } from 'react';
import { Modal, View } from 'react-native';

import { PROFILE_TINT_CLASS, ProfileRow, type ProfileTint } from '@/components/profile/profile-row';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Sheet, SheetRows } from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { profilePreferences$ } from '@/lib/store';
import { updateProfilePreferences } from '@/lib/supabase/profile';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

const TONES: Record<MoniTone, { title: string; meta: string; icon: IconSymbolName; tint: ProfileTint }> = {
  friendly: { title: 'Friendly', meta: 'Warm and short, with a kind word', icon: 'emoticon-happy-outline', tint: 'mint' },
  direct: { title: 'Straight to the point', meta: 'Just the answer and its number', icon: 'target', tint: 'aqua' },
  playful: { title: 'Playful', meta: 'Short, with a little joke', icon: 'party-popper', tint: 'lemon' },
};

/** Shows the pick at once, then writes `preferences.moni_tone`; a failed write puts the old one back. */
async function saveTone(tone: MoniTone) {
  const previous = profilePreferences$.peek();
  profilePreferences$.set({ ...userPreferencesSchema.parse(previous ?? {}), moni_tone: tone });
  try {
    profilePreferences$.set(await updateProfilePreferences({ moni_tone: tone }));
  } catch {
    profilePreferences$.set(previous);
    showToast({ text: "Couldn't change Moni's tone. Try again.", tone: 'removed' });
  }
}

/** Profile's Moni's tone row and the sheet it opens, where the user picks how Moni sounds in chat. */
export function MoniToneRow() {
  const tokens = useThemeTokens();
  const picked = useValue(() => profilePreferences$.get()?.moni_tone ?? 'friendly');
  const [sheet, setSheet] = useState<'closed' | 'open' | 'closing'>('closed');

  return (
    <>
      <ProfileRow
        testID={tid('profile', 'moni-tone')}
        icon="chat-processing-outline"
        tint="mint"
        title="Moni's tone"
        value={TONES[picked].title}
        chevron="down"
        onPress={() => setSheet('open')}
      />
      <Modal
        transparent
        visible={sheet !== 'closed'}
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setSheet('closing')}
      >
        <Sheet
          open={sheet === 'open'}
          onDismiss={() => setSheet('closing')}
          onExited={() => setSheet('closed')}
          size="fit"
          title="Moni's tone"
          note="How Moni sounds in chat. The numbers stay the same."
          closeLabel="Close"
        >
          <SheetRows>
            {(Object.keys(TONES) as MoniTone[]).map((tone) => {
              const entry = TONES[tone];
              const selected = tone === picked;
              return (
                <Press
                  key={tone}
                  testID={tid('profile', 'tone', tone)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${entry.title}, ${entry.meta}`}
                  className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3"
                  onPress={() => {
                    setSheet('closing');
                    if (!selected) void saveTone(tone);
                  }}
                >
                  <View
                    className={`h-[42px] w-[42px] items-center justify-center rounded-full ${PROFILE_TINT_CLASS[entry.tint]}`}
                  >
                    <IconSymbol
                      name={entry.icon}
                      size={22}
                      color={tokens.onCategory}
                    />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      variant="rowTitle"
                      className="text-foreground"
                      numberOfLines={1}
                    >
                      {entry.title}
                    </Text>
                    <Text
                      variant="meta"
                      className="text-muted"
                      numberOfLines={1}
                    >
                      {entry.meta}
                    </Text>
                  </View>
                  <IconSymbol
                    name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={24}
                    color={selected ? tokens.foreground : tokens.muted}
                  />
                </Press>
              );
            })}
          </SheetRows>
        </Sheet>
      </Modal>
    </>
  );
}
