import { Text } from 'react-native';

export function ProfileSectionTitle({
  children,
}: {
  children: string;
}) {
  return (
    <Text className="mb-2 text-[13px] font-semibold text-muted">
      {children}
    </Text>
  );
}
