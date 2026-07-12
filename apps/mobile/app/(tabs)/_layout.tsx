import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SyncStatusIndicator } from '@/components/sync-status-indicator';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

export default function TabLayout() {
  const tokens = useThemeTokens();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: tokens.muted,
        headerShown: false,
        headerRight: () => (
          <View className="mr-4">
            <SyncStatusIndicator />
          </View>
        ),
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wallets',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="credit-card" color={color} />,
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: 'Summary',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bar-chart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Moni Agent',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="smart-toy" color={color} />,
          tabBarHideOnKeyboard: true,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person" color={color} />,
        }}
      />
    </Tabs>
  );
}
