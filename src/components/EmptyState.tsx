import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { RondaRing } from '../motion/RondaRing';
import { useColors } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { Button } from './Button';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
  children?: ReactNode;
}

/** Supportive and instructive: say what is happening and the next step. */
export function EmptyState({ title, body, icon, action, children }: EmptyStateProps) {
  const colors = useColors();
  return (
    <Card padded style={styles.card}>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: colors.brandTint }]}>
          <Icon name={icon} size={24} color={colors.brandInk} />
        </View>
      ) : null}
      <Text variant="rowTitle" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="subhead" color="ink2" align="center">
          {body}
        </Text>
      ) : null}
      {children}
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" size="medium" style={styles.action} /> : null}
    </Card>
  );
}

/** Full-area loading state with the Ronda ring. */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <RondaRing size={44} accessibilityLabel={label} />
    </View>
  );
}

/** A load failed: say so plainly and offer to try again. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon="alert"
      title="We could not load this"
      body={message}
      action={{ label: 'Try again', onPress: onRetry }}
    />
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.gutter, alignItems: 'center', gap: 6 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  action: { marginTop: 10, alignSelf: 'stretch' },
  loading: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
});
