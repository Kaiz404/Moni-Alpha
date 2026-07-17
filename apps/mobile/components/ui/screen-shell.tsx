import {
  SafeAreaView,
  type SafeAreaViewProps,
} from 'react-native-safe-area-context';

type ScreenShellProps = Omit<SafeAreaViewProps, 'className'> & {
  className?: string;
  /** Soft mint/canvas chrome used on form/auth screens. Default: solid background. */
  variant?: 'default' | 'canvas';
};

/**
 * Full-screen root with semantic background tokens.
 *
 * Form and detail routes render their own safe-area-aware `BrandHeader`, so
 * this shell reserves the bottom inset by default without double-padding the
 * top of those screens.
 */
export function ScreenShell({
  className,
  variant = 'default',
  edges = ['bottom'],
  style,
  ...props
}: ScreenShellProps) {
  const bg = variant === 'canvas' ? 'bg-canvas' : 'bg-background';
  return (
    <SafeAreaView
      edges={edges}
      className={`flex-1 ${bg} ${className ?? ''}`}
      style={[{ flex: 1 }, style]}
      {...props}
    />
  );
}
