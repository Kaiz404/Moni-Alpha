import { Modal, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryPickerContent } from './category-picker-content';
import {
  SquircleView,
  squircleSmoothing,
} from '@/components/ui/squircle-view';

export type CategoryPickerItem = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

type CategoryPickerModalProps = {
  visible: boolean;
  categories: CategoryPickerItem[];
  suggested?: CategoryPickerItem[];
  selectedId?: string | null;
  title?: string;
  onSelect: (category: CategoryPickerItem) => void;
  onClose: () => void;
  onCreate?: () => void;
};

/** Non-Android fallback for the native Android category bottom sheet. */
export function CategoryPickerModal({
  visible,
  onClose,
  ...props
}: CategoryPickerModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View className="flex-1 justify-end bg-black/40">
        <SquircleView
          className="max-h-[82%] overflow-hidden rounded-[28px] bg-canvas"
          cornerSmoothing={squircleSmoothing.hero}
          style={{ height: Math.round(windowHeight * 0.78) }}
        >
          <View
            className="max-h-full px-5 pb-3 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-border" />
            <CategoryPickerContent
              {...props}
              onClose={onClose}
            />
          </View>
        </SquircleView>
      </View>
    </Modal>
  );
}
