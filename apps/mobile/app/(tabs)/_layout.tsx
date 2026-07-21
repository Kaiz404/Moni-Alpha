import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { SyncStatusIndicator } from '@/components/providers/sync-status-indicator';
import { TabBar } from '@/components/nav/tab-bar';
import { TabBarIcon } from '@/components/nav/tab-bar-icon';
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
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              outline="credit-card-outline"
              filled="credit-card"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              outline="chart-box-outline"
              filled="chart-box"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              outline="chat-outline"
              filled="chat"
            />
          ),
          tabBarHideOnKeyboard: true,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              outline="account-outline"
              filled="account"
            />
          ),
        }}
      />
    </Tabs>
  );
}
