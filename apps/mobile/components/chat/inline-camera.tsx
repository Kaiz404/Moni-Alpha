import { Modal, View } from 'react-native';
import { ReceiptCamera } from '@/components/receipt/receipt-camera';

type InlineCameraProps = {
  visible: boolean;
  onClose: () => void;
  onCapture: (uri: string) => void;
};

/** Modal shell around the shared receipt scanner for the chat tab's inline camera entry point. */
export function InlineCamera({ visible, onClose, onCapture }: InlineCameraProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        {visible ? (
          <ReceiptCamera
            variant="modal"
            onCancel={onClose}
            onComplete={(uri) => {
              onCapture(uri);
              onClose();
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}
