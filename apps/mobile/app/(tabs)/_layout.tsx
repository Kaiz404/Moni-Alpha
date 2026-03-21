import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PowerSyncStatusIndicator } from '@/components/power-sync-status-indicator';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        headerRight: () => (
          <View className="mr-4">
            <PowerSyncStatusIndicator />
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
