import type { AiUse } from '@repo/types';
import { View } from 'react-native';

import { AiTag } from '@/components/ui/ai-tag';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Page, PageScroll } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import { Toggle } from '@/components/ui/toggle';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import { turnOnFor, UNASKED, type AiConsent, type ConsentChange } from '@/lib/ai/consent/model';
import { changeAiConsent, useAiConsent } from '@/lib/ai/consent/state';
import { chatTime } from '@/components/chat/chat-time';
import { formatDate } from '@/lib/dates/day-label';
import { tid, type TestId } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

const USES: { use: AiUse; icon: IconSymbolName; title: string; meta?: string }[] = [
  {
    use: 'alerts',
    icon: 'bell-outline',
    title: 'Payment alerts from the apps you link',
    meta: 'One-time codes never leave your phone.',
  },
  {
    use: 'add',
    icon: 'microphone',
    title: 'What you say in Add',
    meta: 'Voice is turned into text on your phone when it can be.',
  },
  { use: 'receipts', icon: 'line-scan', title: 'Receipt photos you scan' },
  {
    use: 'chat',
    icon: 'message-text-outline',
    title: 'What you send in Moni chat',
    meta: 'With the figures Moni needs to answer.',
  },
];

function masterMeta(consent: AiConsent): string {
  if (consent.kind === 'unasked') return 'Off. Nothing goes to AI.';
  const when = `${formatDate(consent.at)}, ${chatTime(consent.at)}`;
  return `Turned ${consent.on ? 'on' : 'off'} by you on ${when}`;
}

function SwitchRow({
  icon,
  title,
  meta,
  value,
  disabled,
  testID,
  onChange,
}: {
  icon?: IconSymbolName;
  title: string;
  meta?: string;
  value: boolean;
  disabled?: boolean;
  testID: TestId;
  onChange: (next: boolean) => void;
}) {
  const tokens = useThemeTokens();
  return (
    <View className={`min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3 ${disabled ? 'opacity-50' : ''}`}>
      {icon ? (
        <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-sand">
          <IconSymbol
            name={icon}
            size={20}
            color={tokens.foreground}
          />
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
        >
          {title}
        </Text>
        {meta ? (
          <Text
            variant="meta"
            className="text-muted"
          >
            {meta}
          </Text>
        ) : null}
      </View>
      <Toggle
        testID={testID}
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </View>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <View className="gap-0.5 rounded-card bg-sand px-[18px] py-3.5">
      <Text
        variant="rowTitle"
        className="text-foreground"
      >
        {title}
      </Text>
      <Text
        variant="meta"
        className="text-ink-2"
      >
        {body}
      </Text>
    </View>
  );
}

/** Profile › Moni's AI (W2-Parts "Settings › Moni's AI"): the master switch and one per use. */
export default function MoniAiScreen() {
  const consent = useAiConsent() ?? UNASKED;
  const on = consent.kind === 'answered' && consent.on;

  const change = (next: ConsentChange) => {
    changeAiConsent(next)
      .then(() => startBackgroundProcessor())
      .catch(() => showToast({ text: "Couldn't save the change. Check your connection." }));
  };

  return (
    <Page
      headerScrolls
      screen="ai"
      kind="pushed"
      title="Moni's AI"
      titleTag={<AiTag />}
    >
      <PageScroll
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <ListCard>
          <SwitchRow
            testID={tid('ai', 'switch', 'all')}
            title="Let Moni use AI"
            meta={masterMeta(consent)}
            value={on}
            onChange={(next) =>
              change(next && consent.kind === 'unasked' ? turnOnFor(consent, 'chat') : { all: next })
            }
          />
        </ListCard>

        <View className="gap-2">
          <Text
            variant="caps"
            className="px-1 text-muted"
            accessibilityRole="header"
          >
            What Moni sends, and only when you use it
          </Text>
          <ListCard>
            {USES.map((row) => (
              <SwitchRow
                key={row.use}
                testID={tid('ai', 'switch', row.use)}
                icon={row.icon}
                title={row.title}
                meta={row.meta}
                value={consent.kind === 'answered' && consent.uses[row.use]}
                disabled={!on}
                onChange={(next) => change({ [row.use]: next })}
              />
            ))}
          </ListCard>
        </View>

        <Note
          title="Who reads it"
          body="OpenRouter, an AI service in the US, passes it to the AI model that reads it. Neither keeps it or trains on it."
        />
        <Note
          title="What Moni keeps"
          body="The transaction it makes, stored in your account in Moni's cloud database, the same as one you add by hand."
        />
        <Text
          variant="meta"
          className="px-1 text-ink-2"
        >
          With AI off you can still add, edit and import by hand; alerts, receipts and voice wait for you.
        </Text>
      </PageScroll>
    </Page>
  );
}
