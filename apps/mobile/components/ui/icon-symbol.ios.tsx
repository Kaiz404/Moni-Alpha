import {
  SymbolView,
  SymbolViewProps,
  SymbolWeight,
} from 'expo-symbols';
import { StyleProp, ViewStyle } from 'react-native';

/**
 * Kept broad on iOS because Expo resolves this platform file at runtime while
 * shared screens use the Material-icon vocabulary from icon-symbol.tsx.
 */
export type IconSymbolName = string;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: IconSymbolName | SymbolViewProps['name'];
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <SymbolView
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={name as SymbolViewProps['name']}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}
