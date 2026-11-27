import { StyleSheet, View } from 'react-native';
import { hashIndex, initials } from '../lib/format';
import { useColors } from '../theme/ThemeProvider';
import { Text } from './Text';

interface AvatarProps {
  name: string;
  size?: number;
  /** 'circle' for people, 'tile' (rounded square) for outlets. */
  shape?: 'circle' | 'tile';
}

/**
 * Initials in a circle (a person) or a rounded tile (an outlet). The quiet
 * palette gives everyone the same grey, the signed-in person included; the
 * hash stays so a palette with several tints still spreads them by name.
 */
export function Avatar({ name, size = 44, shape = 'circle' }: AvatarProps) {
  const colors = useColors();
  const tint = colors.avatars[hashIndex(name, colors.avatars.length)];
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: shape === 'circle' ? size / 2 : Math.round(size * 0.31), backgroundColor: tint.bg },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text variant="captionStrong" color={tint.ink} style={{ fontSize: Math.round(size * 0.34), lineHeight: Math.round(size * 0.44) }} allowFontScaling={false}>
        {initials(name, shape === 'tile' ? 'outlet' : 'person')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
