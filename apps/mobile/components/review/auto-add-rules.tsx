import { useValue } from '@legendapp/state/react';
import { View } from 'react-native';

import { AppBubble } from '@/components/capture-sources/linked-app-row';
import { ListSection } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth/auth-context';
import { categories$ } from '@/lib/store';
import {
  createAutoAddRule,
  deleteAutoAddRule,
  listAutoAddRules,
} from '@/lib/supabase/auto-add-rules';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { autoAddRuleItems, type AutoAddRuleItem } from '@repo/core';

function failed(error: unknown) {
  showToast({ text: error instanceof Error ? error.message : "Couldn't save that change." });
}

function askAgain({ rule, name }: AutoAddRuleItem) {
  try {
    deleteAutoAddRule(rule.id);
  } catch (error) {
    failed(error);
    return;
  }
  showToast({
    text: `Moni will ask about ${name} again`,
    undo: () => {
      void createAutoAddRule({
        merchantKey: rule.merchantKey,
        sourceApp: rule.sourceApp,
        walletId: rule.walletId,
        categoryId: rule.categoryId,
      }).catch(failed);
    },
  });
}

function useAutoAddRuleItems(): AutoAddRuleItem[] {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useValue(() => {
    if (!userId) return [];
    const categories = (categories$.get() ?? {}) as Record<string, { name?: string | null } | undefined>;
    return autoAddRuleItems(listAutoAddRules(userId), {
      aliases: new Map(listMerchantAliases(userId).map((alias) => [alias.rawKey, alias.displayName])),
      categoryNames: Object.fromEntries(
        Object.entries(categories).map(([id, category]) => [id, category?.name ?? undefined]),
      ),
    });
  });
}

/**
 * The "Don't ask about similar" rules, beside Recently reviewed where they were made: each one's
 * alert app, the merchant, what it does, and Ask again to delete it.
 */
export function AutoAddRules() {
  const items = useAutoAddRuleItems();
  if (!items.length) return null;
  return (
    <ListSection label="Don't ask about similar">
      {items.map((item) => (
        <View
          key={item.rule.id}
          className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3"
        >
          <AppBubble packageName={item.rule.sourceApp} />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text
              variant="rowTitle"
              className="text-foreground"
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text
              variant="meta"
              className="text-muted"
              numberOfLines={1}
            >
              {item.line}
            </Text>
          </View>
          <Press
            testID={tid('review', 'rule', item.rule.merchantKey, 'ask-again')}
            onPress={() => askAgain(item)}
            accessibilityLabel={`Ask again about ${item.name}`}
            radius={{ rest: 22, pressed: 16 }}
            pressedClassName="bg-hairline"
            className="h-11 justify-center bg-sand px-3"
          >
            <Text className="text-[15px] leading-[21px] font-display-semibold text-foreground">
              Ask again
            </Text>
          </Press>
        </View>
      ))}
    </ListSection>
  );
}
