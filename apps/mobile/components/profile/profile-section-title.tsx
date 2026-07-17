import { Text } from 'react-native';

export function ProfileSectionTitle({
  children,
}: {
  children: string;
}) {
  return (
    <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
      {children}
    </Text>
  );
}
