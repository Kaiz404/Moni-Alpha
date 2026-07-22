import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type TactilePressableProps = Omit<PressableProps, 'style'> & {
  /** Press feedback is opacity-only so Reduce Motion users get the same cue. */
  style?: PressableProps['style'];
  className?: string;
};

/**
 * Shared press treatment for controls. It avoids scale/bounce animation so it
 * remains calm and accessible when Reduce Motion is enabled.
 */
export function TactilePressable({
  className,
  style,
  accessibilityRole = 'button',
  ...props
}: TactilePressableProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole={accessibilityRole}
      className={className}
      style={(state) => {
        const supplied =
          typeof style === 'function' ? style(state) : style;
        return [
          supplied,
          {
            opacity: state.pressed ? 0.82 : 1,
          } satisfies StyleProp<ViewStyle>,
        ];
      }}
    />
  );
}
