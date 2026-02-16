import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login' as any);
  };

  return (
    <View className="flex-1 p-6 bg-white dark:bg-gray-900">
      <Text className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Profile</Text>
      {user && (
        <View className="mb-6">
          <Text className="text-base text-gray-600 dark:text-gray-400">{user.email}</Text>
        </View>
      )}
      <TouchableOpacity className="bg-red-500 dark:bg-red-600 p-3.5 rounded-lg items-center" onPress={handleSignOut}>
        <Text className="text-white text-base font-semibold">Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

