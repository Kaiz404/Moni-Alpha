import { Text } from '@/components/ui/text';

export function ProfileSectionTitle({
  children,
}: {
  children: string;
}) {
  return (
    <Text className="mb-2 text-[13px] font-display-semibold text-muted">
      {children}
    </Text>
  );
}
