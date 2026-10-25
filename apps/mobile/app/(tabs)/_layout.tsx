import { Tabs } from 'expo-router';

import { BillReminderSync } from '@/components/budget/bill-reminder-sync';
import { TabBar, TABS } from '@/components/nav/tab-bar';
import { SheetHost } from '@/components/ui/sheet/sheet-host';

export default function TabLayout() {
  return (
    <>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          transitionSpec: {
            animation: 'timing',
            config: { duration: 150 },
          },
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{ title: tab.title }}
          />
        ))}
      </Tabs>
      <SheetHost layer="tabs" />
      <BillReminderSync />
    </>
  );
}
