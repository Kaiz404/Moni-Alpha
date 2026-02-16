import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '@/lib/supabase/client';

export function ConnectivityStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      setIsChecking(true);
      try {
        // Simple health check - try to get user session
        const { error } = await supabase.auth.getSession();
        setIsConnected(!error);
      } catch {
        setIsConnected(false);
      } finally {
        setIsChecking(false);
      }
    };

    // Check immediately
    checkConnection();

    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  if (isConnected) {
    return (
      <View className="flex-row items-center px-3 py-1 bg-green-100 dark:bg-green-900 rounded-full">
        <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
        <Text className="text-xs text-green-700 dark:text-green-300 font-medium">
          Online
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center px-3 py-1 bg-red-100 dark:bg-red-900 rounded-full">
      <View className="w-2 h-2 bg-red-500 rounded-full mr-2" />
      <Text className="text-xs text-red-700 dark:text-red-300 font-medium">
        {isChecking ? 'Checking...' : 'Offline'}
      </Text>
    </View>
  );
}