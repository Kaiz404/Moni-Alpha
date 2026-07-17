import { useEffect, useRef } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  clearImmediateProposalReview,
  useImmediateProposalReview,
} from '@/lib/proposals/immediate-review';

const MIN_PROCESSING_DURATION_MS = 520;

function ProcessingDot({
  index,
  reducedMotion,
}: {
  index: number;
  reducedMotion: boolean;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      pulse.value = withTiming(0.45, { duration: 140 });
      return;
    }
    pulse.value = withDelay(
      index * 120,
      withRepeat(
        withTiming(1, {
          duration: 520,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(pulse);
  }, [index, pulse, reducedMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.34 + pulse.value * 0.66,
    transform: [{ translateY: reducedMotion ? 0 : -pulse.value * 4 }],
  }));

  return (
    <Animated.View
      className="h-2.5 w-2.5 rounded-full bg-primary"
      style={style}
    />
  );
}

/**
 * A transparent, source-aware bridge between explicit AI capture and the
 * full-screen review artifact. Background notification extraction never uses
 * this overlay.
 */
export function FabReceiptProcessingOverlay() {
  const tokens = useThemeTokens();
  const reducedMotion = useReducedMotion();
  const { active, proposalId, copy, readyAt, startedAt } =
    useImmediateProposalReview();
  const navigatedProposalId = useRef<string | null>(null);

  useEffect(() => {
    if (
      !active ||
      !proposalId ||
      !readyAt ||
      navigatedProposalId.current === proposalId
    ) {
      return;
    }

    const elapsed = Date.now() - (startedAt ?? readyAt);
    const delay = Math.max(0, MIN_PROCESSING_DURATION_MS - elapsed);
    const timer = setTimeout(() => {
      navigatedProposalId.current = proposalId;
      clearImmediateProposalReview(proposalId);
      router.push({
        pathname: '/proposal/[id]',
        params: { id: proposalId },
      } as never);
    }, delay);

    return () => clearTimeout(timer);
  }, [active, proposalId, readyAt, startedAt]);

  useEffect(() => {
    if (!active) navigatedProposalId.current = null;
  }, [active]);

  if (!active || !copy) return null;

  const icon =
    copy.icon === 'chat'
      ? 'chat-bubble-outline'
      : copy.icon === 'voice'
        ? 'mic-none'
        : 'receipt-long';

  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? 'fade' : 'none'}
      statusBarTranslucent
      onRequestClose={() =>
        clearImmediateProposalReview(proposalId ?? undefined)
      }
    >
      <View className="flex-1 items-center justify-center bg-foreground/15 px-7">
        <View className="w-full max-w-sm items-center rounded-[28px] border border-border bg-card px-7 py-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-muted">
            <MaterialIcons
              name={icon}
              size={31}
              color={tokens.primary}
            />
          </View>
          <Text className="mt-5 text-center text-xl font-bold text-foreground">
            {readyAt ? 'Ready for your review' : copy.title}
          </Text>
          <Text className="mt-2 text-center text-sm leading-5 text-muted">
            {readyAt
              ? 'Nothing has been saved. Check the details first.'
              : copy.detail}
          </Text>
          <View
            className="mt-6 flex-row gap-2"
            accessibilityLabel="Processing"
          >
            {[0, 1, 2].map((index) => (
              <ProcessingDot
                key={index}
                index={index}
                reducedMotion={reducedMotion}
              />
            ))}
          </View>
          <Pressable
            className="mt-6 rounded-full px-4 py-2"
            onPress={() =>
              clearImmediateProposalReview(proposalId ?? undefined)
            }
            accessibilityRole="button"
            accessibilityLabel="Continue processing in the background"
          >
            <Text className="text-sm font-semibold text-primary">
              Continue in background
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
