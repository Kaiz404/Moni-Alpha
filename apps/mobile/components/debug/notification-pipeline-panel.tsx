import { Text, TouchableOpacity, View } from 'react-native';

import { StatCard } from '@/components/debug/stat-card';
import {
  getNotificationDiagnostics,
  PERMISSION_COLORS,
  QUEUE_STATUS_COLORS,
  QUEUE_STATUS_LABELS,
  useNotificationMonitor,
} from '@/lib/debug';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)
    return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationPipelinePanel() {
  const tokens = useThemeTokens();
  const { snapshot, permissionStatus, lastCheckedAt, refresh } =
    useNotificationMonitor();
  const { queue, recent, isAndroid } = snapshot;
  const diagnostics = getNotificationDiagnostics(permissionStatus);

  const permissionLabel =
    permissionStatus === 'authorized'
      ? 'Authorized'
      : permissionStatus === 'denied'
        ? 'Denied'
        : permissionStatus === 'unavailable'
          ? 'N/A (iOS)'
          : 'Unknown';

  const buildLabel = diagnostics.isExpoGo
    ? 'Expo Go (unsupported)'
    : diagnostics.isDevClient
      ? 'Dev client'
      : 'Production build';

  return (
    <View className="mx-5 mt-5 rounded-[22px] border border-border bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-foreground">
          Notification pipeline
        </Text>
        <TouchableOpacity
          onPress={refresh}
          hitSlop={8}
        >
          <Text className="text-xs font-semibold text-primary">Refresh</Text>
        </TouchableOpacity>
      </View>
      <Text className="mt-1 text-xs leading-4 text-muted">
        Listener access (read other apps&apos; alerts). Not the same
        as App Info → Notifications.
      </Text>
      {lastCheckedAt ? (
        <Text className="mt-1 text-[10px] text-muted">
          Permission re-checked {formatRelativeTime(lastCheckedAt)}
        </Text>
      ) : null}

      <View className="mt-4 gap-2">
        <View className="flex-row gap-2">
          <StatCard label="Permission">
            <View className="flex-row items-center">
              <View
                className="w-2 h-2 rounded-full mr-1.5"
                style={{
                  backgroundColor:
                    PERMISSION_COLORS[permissionStatus],
                }}
              />
              <Text className="text-sm font-semibold text-foreground">
                {permissionLabel}
              </Text>
            </View>
          </StatCard>
          <StatCard label="Last captured">
            <Text className="text-sm font-semibold text-foreground">
              {formatRelativeTime(snapshot.lastReceivedAt)}
            </Text>
          </StatCard>
        </View>

        <View className="flex-row gap-2">
          <StatCard label="Captured">
            <Text className="text-sm font-semibold text-foreground">
              {snapshot.capturedTotal}
            </Text>
          </StatCard>
          <StatCard label="Prefilter pass">
            <Text className="text-sm font-semibold text-success">
              {snapshot.prefilterPassed}
            </Text>
          </StatCard>
          <StatCard label="Ignored">
            <Text className="text-sm font-semibold text-muted">
              {snapshot.prefilterIgnored}
            </Text>
          </StatCard>
        </View>
      </View>

      <View className="mt-3 rounded-2xl border border-border bg-surface-2 px-3 py-2.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-muted">
            Queue (notifications only)
          </Text>
          <View className="flex-row items-center">
            <View
              className="w-2 h-2 rounded-full mr-1.5"
              style={{
                backgroundColor: queue.running
                  ? tokens.success
                  : tokens.muted,
              }}
            />
            <Text className="text-xs text-muted">
              {queue.running ? 'Processing' : 'Idle'}
            </Text>
          </View>
        </View>
        <Text className="mt-1.5 text-xs font-mono leading-5 text-foreground">
          {queue.pending} pending · {queue.processing} active ·{' '}
          {queue.done} done · {queue.error} error
        </Text>
      </View>

      <View className="mt-3 rounded-2xl border border-border bg-surface-2 px-3 py-2.5">
        <Text className="text-xs text-muted">Native status</Text>
        <Text className="mt-0.5 text-sm font-mono font-medium text-foreground">
          {permissionStatus}
        </Text>
        <Text className="mt-1 text-[10px] leading-4 text-muted">
          Queried live from Android — not cached. If this disagrees
          with system settings, pull to refresh or revisit this screen
          after changing access.
        </Text>
      </View>

      <View className="mt-3 rounded-2xl border border-border bg-surface-2 px-3 py-2.5">
        <Text className="text-xs text-muted">Build</Text>
        <Text
          className="text-sm font-medium mt-0.5"
          style={{
            color: diagnostics.isExpoGo
              ? tokens.danger
              : tokens.states.pending,
          }}
        >
          {buildLabel}
        </Text>
      </View>

      {!isAndroid ? (
        <Text className="mt-3 text-xs leading-4 text-muted">
          Notification listener is Android-only.
        </Text>
      ) : recent.length === 0 ? (
        <View className="mt-3 rounded-2xl border border-warning/30 bg-accent-lemon/20 px-3 py-2.5">
          <Text className="text-xs font-semibold text-warning">
            No captures yet
          </Text>
          {diagnostics.troubleshooting.map((tip, i) => (
            <Text
              key={i}
              className="mt-1.5 text-xs leading-4 text-muted"
            >
              • {tip}
            </Text>
          ))}
        </View>
      ) : (
        <View className="mt-4">
          <Text className="mb-2 text-xs text-muted">
            Recent captures
          </Text>
          {recent.map((entry) => (
            <View
              key={entry.id}
              className="mb-2 rounded-2xl border border-border bg-surface-2 px-3 py-2.5"
            >
              <View className="flex-row items-start justify-between gap-2">
                <Text
                  className="flex-1 text-sm font-semibold text-foreground"
                  numberOfLines={1}
                >
                  {entry.app}
                </Text>
                <View
                  className="rounded px-2 py-0.5 shrink-0"
                  style={{
                    backgroundColor: `${QUEUE_STATUS_COLORS[entry.queueStatus]}22`,
                  }}
                >
                  <Text
                    className="text-[10px] font-semibold"
                    style={{
                      color: QUEUE_STATUS_COLORS[entry.queueStatus],
                    }}
                  >
                    {QUEUE_STATUS_LABELS[entry.queueStatus]}
                  </Text>
                </View>
              </View>
              <Text className="mt-1 text-xs leading-4 text-muted">
                {entry.preview}
              </Text>
              <Text className="mt-1 text-[10px] text-muted">
                {formatRelativeTime(entry.receivedAt)}
                {!entry.prefilterPassed
                  ? ' · prefilter rejected'
                  : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
