import MaterialIcons from '@react-native-vector-icons/material-icons';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconSymbolName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Cross-platform icon wrapper (Material Icons on Android; SF Symbols on iOS).
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return <MaterialIcons color={color} size={size} name={name} style={style} />;
}
