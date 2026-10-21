import { Tabs } from 'expo-router';
import React from 'react';

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
              outline="home-outline"
              filled="home"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              outline="receipt-text-outline"
              filled="receipt-text"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: 'Budget',
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
        name="debts"
        options={{
          title: 'Debts',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              outline="handshake-outline"
              filled="handshake"
            />
          ),
        }}
      />
    </Tabs>
  );
}
