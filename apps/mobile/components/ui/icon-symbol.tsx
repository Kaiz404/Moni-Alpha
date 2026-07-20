import { Feather } from '@react-native-vector-icons/feather';
import { FontAwesome6 } from '@react-native-vector-icons/fontawesome6';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import type { ComponentProps, ComponentType } from 'react';
import type { ColorValue, StyleProp, TextStyle } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type FeatherIconName = ComponentProps<typeof Feather>['name'];
type FontAwesomeIconName = ComponentProps<
  typeof FontAwesome6
>['name'];
type MaterialDesignIconName = ComponentProps<
  typeof MaterialDesignIcons
>['name'];

export type IconSymbolFamily =
  | 'ionicons'
  | 'feather'
  | 'font-awesome-6'
  | 'material-design';

/** Icon names supported by Moni's installed React Native Vector Icons sets. */
export type IconSymbolName =
  | IoniconName
  | FeatherIconName
  | FontAwesomeIconName
  | MaterialDesignIconName;

type SharedIconSymbolProps = {
  size?: number;
  color: ColorValue;
  style?: StyleProp<TextStyle>;
  /** Selects the Font Awesome 6 font face when that family is in use. */
  fontAwesomeStyle?: 'regular' | 'solid' | 'brand';
};

type IconSymbolProps = SharedIconSymbolProps & {
  name: IconSymbolName;
  family?: IconSymbolFamily;
};

const FontAwesomeIcon = FontAwesome6 as ComponentType<{
  name: FontAwesomeIconName;
  size: number;
  color: ColorValue;
  style?: StyleProp<TextStyle>;
  iconStyle?: 'regular' | 'solid' | 'brand';
}>;

/**
 * Moni's single React Native Vector Icons boundary. Material Design Icons are
 * the default; use `family` only when another installed icon set is required.
 */
export function IconSymbol({
  name,
  family = 'material-design',
  size = 24,
  color,
  style,
  fontAwesomeStyle,
}: IconSymbolProps) {
  switch (family) {
    case 'ionicons':
      return (
        <Ionicons
          color={color}
          size={size}
          name={name as IoniconName}
          style={style}
        />
      );
    case 'feather':
      return (
        <Feather
          color={color}
          size={size}
          name={name as FeatherIconName}
          style={style}
        />
      );
    case 'font-awesome-6':
      return (
        <FontAwesomeIcon
          color={color}
          size={size}
          name={name as FontAwesomeIconName}
          style={style}
          iconStyle={fontAwesomeStyle}
        />
      );
    default:
      return (
        <MaterialDesignIcons
          color={color}
          size={size}
          name={name as MaterialDesignIconName}
          style={style}
        />
      );
  }
}
