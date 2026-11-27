import type { ReactNode } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { Palette } from '../theme/tokens';
import { useColors } from '../theme/ThemeProvider';

/** Grey for every status; red only for Rejected, the one the rep must act on (quiet palette). */
export function signColor(colors: Palette, status: number): string {
  return Number(status) === 7 ? colors.tones.critical.ink : colors.ink2;
}

/**
 * A task's status as a small sign, one shape per status so it reads without
 * colour: new (a ring), in progress (half filled), done (a tick), verified
 * and completed (filled, with a tick), kept in view (a bookmark), rejected
 * (a cross), on hold (bars). The status sheet, the Tasks lists and the
 * manager's list all use it, so a status looks the same everywhere.
 */
export function StatusSign({
  status,
  size = 22,
  strokeWidth = 2.2,
  knock,
}: {
  status: number;
  size?: number;
  strokeWidth?: number;
  /** The surface behind it, for the tick cut out of a filled sign (the card by default). */
  knock?: string;
}) {
  const colors = useColors();
  const ink = signColor(colors, status);
  const line = { fill: 'none', stroke: ink, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const ring = <Circle cx={12} cy={12} r={8.5} {...line} />;
  let sign: ReactNode;
  switch (Number(status)) {
    case 2:
      sign = (
        <>
          {ring}
          <Path d="M12 6.5a5.5 5.5 0 0 1 0 11Z" fill={ink} />
        </>
      );
      break;
    case 3:
      sign = (
        <>
          {ring}
          <Path d="m8.6 12.3 2.3 2.3 4.6-4.8" {...line} />
        </>
      );
      break;
    case 4:
    case 5:
      sign = (
        <>
          <Circle cx={12} cy={12} r={9.2} fill={ink} />
          <Path d="m8.4 12.3 2.4 2.4 4.8-5" {...line} stroke={knock ?? colors.panel} strokeWidth={strokeWidth + 0.2} />
        </>
      );
      break;
    case 6:
      sign = <Path d="M7.5 4.5h9a.5.5 0 0 1 .5.5v14.2l-5-3.4-5 3.4V5a.5.5 0 0 1 .5-.5Z" {...line} />;
      break;
    case 7:
      sign = (
        <>
          {ring}
          <Path d="m9.5 9.5 5 5M14.5 9.5l-5 5" {...line} />
        </>
      );
      break;
    case 8:
      sign = (
        <>
          {ring}
          <Path d="M10 9v6M14 9v6" {...line} />
        </>
      );
      break;
    default:
      sign = ring;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {sign}
    </Svg>
  );
}
