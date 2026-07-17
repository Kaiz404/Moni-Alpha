import MaterialIcons from '@react-native-vector-icons/material-icons';
import type { ComponentProps } from 'react';
import type {
  ColorValue,
  StyleProp,
  TextStyle,
} from 'react-native';

/** The icon-name contract follows the installed Material Icons package. */
export type IconSymbolName = ComponentProps<
  typeof MaterialIcons
>['name'];

type IconSymbolProps = {
  name: IconSymbolName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<TextStyle>;
};

/**
 * Moni's single icon boundary. Screens should use this instead of importing
 * vector-icon packages directly so icon naming and visual weight stay stable.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: IconSymbolProps) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={name}
      style={style}
    />
  );
}
