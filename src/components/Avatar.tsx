import { StyleSheet, View } from 'react-native';
import { hashIndex, initials } from '../lib/format';
import { useColors } from '../theme/ThemeProvider';
import { Text } from './Text';

interface AvatarProps {
  name: string;
  size?: number;
  /** 'circle' for people, 'tile' (rounded square) for outlets. */
  shape?: 'circle' | 'tile';
  /** Use the brand fill (the signed-in person on Today and Team). */
  brand?: boolean;
}

export function Avatar({ name, size = 44, shape = 'circle', brand = false }: AvatarProps) {
  const colors = useColors();
  const tint = colors.avatars[hashIndex(name, colors.avatars.length)];
  const bg = brand ? '#0D729E' : tint.bg;
  const ink = brand ? '#FFFFFF' : tint.ink;
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: shape === 'circle' ? size / 2 : Math.round(size * 0.31), backgroundColor: bg },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text variant="captionStrong" color={ink} style={{ fontSize: Math.round(size * 0.34), lineHeight: Math.round(size * 0.44) }} allowFontScaling={false}>
        {initials(name, shape === 'tile' ? 'outlet' : 'person')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
