import { View, type ViewProps } from 'react-native';

type ScreenShellProps = ViewProps & {
  className?: string;
  /** Soft mint/canvas chrome used on form/auth screens. Default: solid background. */
  variant?: 'default' | 'canvas';
};

/** Full-screen root with semantic background tokens. */
export function ScreenShell({
  className,
  variant = 'default',
  ...props
}: ScreenShellProps) {
  const bg = variant === 'canvas' ? 'bg-canvas' : 'bg-background';
  return <View className={`flex-1 ${bg} ${className ?? ''}`} {...props} />;
}
