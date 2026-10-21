import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { CaptureResult } from '@/components/capture/capture-result-card';
import {
  CaptureAdded,
  CaptureFailed,
  CaptureReading,
} from '@/components/capture/scan-stages';
import { useCaptureFlow } from '@/components/capture/use-capture-flow';
import { Page } from '@/components/ui/page';
import { scanAndNormalizeReceipt } from '@/lib/receipts/scan-receipt';

/**
 * Scan a receipt: the ML Kit document scanner is the camera stage (D11), then
 * Moni reads the image and the check page approves it straight to the ledger.
 */
export default function ScanScreen() {
  const flow = useCaptureFlow('camera');
  const { stage, read, dispatch } = flow;
  const opened = useRef(false);

  useEffect(() => {
    if (stage.name !== 'capture') {
      opened.current = false;
      return;
    }
    if (opened.current) return;
    opened.current = true;
    void scanAndNormalizeReceipt().then((imageUri) => {
      if (imageUri) void read({ source: 'camera', imageUri });
      else router.back();
    });
  }, [read, stage.name]);

  const retake = () => dispatch({ type: 'retry' });

  switch (stage.name) {
    case 'capture':
      return (
        <Page
          screen="capture"
          kind="task"
          title="Scan a receipt"
        >
          {null}
        </Page>
      );
    case 'reading':
      return <CaptureReading quote={stage.quote} />;
    case 'result':
      return (
        <CaptureResult
          quote={stage.quote}
          draft={stage.draft}
          onEdit={(patch) => dispatch({ type: 'edit', patch })}
          again={{
            label: 'Retake',
            icon: 'camera-retake-outline',
            onPress: retake,
          }}
          onApprove={() => void flow.approve()}
          approving={flow.approving}
        />
      );
    case 'approved':
      return flow.added ? (
        <CaptureAdded
          row={flow.added}
          categoryName={flow.categoryName}
          another={{ label: 'Scan another', onPress: retake }}
        />
      ) : null;
    case 'failed':
      return (
        <CaptureFailed
          quote={stage.quote}
          failure={stage.failure}
          title="Scan a receipt"
          onRetry={retake}
        />
      );
  }
}
