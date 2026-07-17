import { Text, TouchableOpacity, View } from 'react-native';

import { StatCard } from '@/components/debug/stat-card';
import {
  getNotificationDiagnostics,
  PERMISSION_COLORS,
  QUEUE_STATUS_COLORS,
  QUEUE_STATUS_LABELS,
  useNotificationMonitor,
} from '@/lib/debug';

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
    <View className="mx-3 mt-4 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-zinc-200 font-semibold text-base">
          Notification pipeline
        </Text>
        <TouchableOpacity
          onPress={refresh}
          hitSlop={8}
        >
          <Text className="text-xs text-blue-400">Refresh</Text>
        </TouchableOpacity>
      </View>
      <Text className="text-zinc-500 text-xs mt-1 leading-4">
        Listener access (read other apps&apos; alerts). Not the same
        as App Info → Notifications.
      </Text>
      {lastCheckedAt ? (
        <Text className="text-[10px] text-zinc-600 mt-1">
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
              <Text className="text-sm font-semibold text-zinc-100">
                {permissionLabel}
              </Text>
            </View>
          </StatCard>
          <StatCard label="Last captured">
            <Text className="text-sm font-semibold text-zinc-100">
              {formatRelativeTime(snapshot.lastReceivedAt)}
            </Text>
          </StatCard>
        </View>

        <View className="flex-row gap-2">
          <StatCard label="Captured">
            <Text className="text-sm font-semibold text-zinc-100">
              {snapshot.capturedTotal}
            </Text>
          </StatCard>
          <StatCard label="Prefilter pass">
            <Text className="text-sm font-semibold text-green-400">
              {snapshot.prefilterPassed}
            </Text>
          </StatCard>
          <StatCard label="Ignored">
            <Text className="text-sm font-semibold text-zinc-400">
              {snapshot.prefilterIgnored}
            </Text>
          </StatCard>
        </View>
      </View>

      <View className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-zinc-500">
            Queue (notifications only)
          </Text>
          <View className="flex-row items-center">
            <View
              className="w-2 h-2 rounded-full mr-1.5"
              style={{
                backgroundColor: queue.running
                  ? '#22c55e'
                  : '#71717a',
              }}
            />
            <Text className="text-xs text-zinc-400">
              {queue.running ? 'Processing' : 'Idle'}
            </Text>
          </View>
        </View>
        <Text className="text-xs text-zinc-300 mt-1.5 font-mono leading-5">
          {queue.pending} pending · {queue.processing} active ·{' '}
          {queue.done} done · {queue.error} error
        </Text>
      </View>

      <View className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-2.5">
        <Text className="text-xs text-zinc-500">Native status</Text>
        <Text className="text-sm font-mono font-medium text-zinc-200 mt-0.5">
          {permissionStatus}
        </Text>
        <Text className="text-[10px] text-zinc-500 mt-1 leading-4">
          Queried live from Android — not cached. If this disagrees
          with system settings, pull to refresh or revisit this screen
          after changing access.
        </Text>
      </View>

      <View className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-2.5">
        <Text className="text-xs text-zinc-500">Build</Text>
        <Text
          className="text-sm font-medium mt-0.5"
          style={{
            color: diagnostics.isExpoGo ? '#f87171' : '#a5b4fc',
          }}
        >
          {buildLabel}
        </Text>
      </View>

      {!isAndroid ? (
        <Text className="text-xs text-zinc-500 mt-3 leading-4">
          Notification listener is Android-only.
        </Text>
      ) : recent.length === 0 ? (
        <View className="mt-3 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2.5">
          <Text className="text-xs font-semibold text-amber-300/90">
            No captures yet
          </Text>
          {diagnostics.troubleshooting.map((tip, i) => (
            <Text
              key={i}
              className="text-xs text-amber-200/70 mt-1.5 leading-4"
            >
              • {tip}
            </Text>
          ))}
        </View>
      ) : (
        <View className="mt-4">
          <Text className="text-xs text-zinc-500 mb-2">
            Recent captures
          </Text>
          {recent.map((entry) => (
            <View
              key={entry.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 mb-2"
            >
              <View className="flex-row items-start justify-between gap-2">
                <Text
                  className="text-sm font-semibold text-zinc-100 flex-1"
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
              <Text className="text-xs text-zinc-400 mt-1 leading-4">
                {entry.preview}
              </Text>
              <Text className="text-[10px] text-zinc-600 mt-1">
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
