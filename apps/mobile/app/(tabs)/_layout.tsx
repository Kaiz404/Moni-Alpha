import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { SyncStatusIndicator } from '@/components/providers/sync-status-indicator';
import { TabBar } from '@/components/nav/tab-bar';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

export default function TabLayout() {
  const tokens = useThemeTokens();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: tokens.muted,
        headerShown: false,
        headerRight: () => (
          <View className="mr-4">
            <SyncStatusIndicator />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wallets',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="credit-card"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: 'Summary',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="bar-chart"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="chat-bubble-outline"
              color={color}
            />
          ),
          tabBarHideOnKeyboard: true,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="person"
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
