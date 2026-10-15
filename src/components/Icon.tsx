import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Line icons drawn on the design boards (24 × 24, round caps and joins). */
const ICONS = {
  outlets: (
    <>
      <Path d="M3 8l1.5-4.2A1.2 1.2 0 0 1 5.6 3h12.8a1.2 1.2 0 0 1 1.1.8L21 8" />
      <Path d="M3 8h18v1a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" />
      <Path d="M5 12.5V20h14v-7.5" />
      <Path d="M10 20v-4.5h4V20" />
    </>
  ),
  tasks: (
    <>
      <Path d="m4 7 1.6 1.6L8.5 5.7" />
      <Path d="m4 15.5 1.6 1.6 2.9-2.9" />
      <Path d="M12 7h8M12 16h8" />
    </>
  ),
  forms: (
    <>
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <Path d="M14 3v5h5" />
      <Path d="M9 13h6M9 17h4" />
    </>
  ),
  formCheck: (
    <>
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <Path d="M14 3v5h5" />
      <Path d="m9 15 2 2 4-4" />
    </>
  ),
  formReject: (
    <>
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <Path d="M14 3v5h5" />
      <Path d="m9.5 12.5 5 5M14.5 12.5l-5 5" />
    </>
  ),
  records: (
    <>
      <Rect x={4} y={4} width={16} height={16} rx={3} />
      <Path d="M8 9h8M8 13h8M8 17h5" />
    </>
  ),
  document: (
    <>
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <Path d="M14 3v5h5" />
    </>
  ),
  link: (
    <>
      <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <Path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  arrowRight: <Path d="M5 12h14M13 6l6 6-6 6" />,
  review: (
    <>
      <Rect x={5} y={4} width={14} height={17} rx={2} />
      <Path d="M9 4V3h6v1" />
      <Path d="m9 13 2 2 4-4" />
    </>
  ),
  visits: (
    <>
      <Rect x={5} y={4} width={14} height={17} rx={2} />
      <Path d="M9 4V3h6v1" />
      <Path d="M9 10h6M9 14h6M9 18h3" />
    </>
  ),
  receipt: (
    <>
      <Path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
      <Path d="M9 8h6M9 12h6" />
    </>
  ),
  trend: (
    <>
      <Path d="m3 17 6-6 4 4 8-8" />
      <Path d="M15 7h6v6" />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  bell: (
    <>
      <Path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9Z" />
      <Path d="M10.2 20.5a2 2 0 0 0 3.6 0" />
    </>
  ),
  chevronRight: <Path d="m9 6 6 6-6 6" />,
  chevronLeft: <Path d="m15 6-6 6 6 6" />,
  chevronDown: <Path d="m6 9 6 6 6-6" />,
  search: (
    <>
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="m20 20-4.2-4.2" />
    </>
  ),
  map: (
    <>
      <Path d="m3 6.5 6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5Z" />
      <Path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  check: <Path d="m5 12.5 4.2 4.2L19 7" />,
  pin: (
    <>
      <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <Circle cx={12} cy={10} r={2.4} />
    </>
  ),
  camera: (
    <>
      <Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2L9.2 5h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
      <Circle cx={12} cy={13} r={3.2} />
    </>
  ),
  phone: (
    <Path d="M5 4h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 4.9 4.9l1.3-2 4 1.6V17a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  ),
  message: <Path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" />,
  directions: <Path d="M12 3 20 20l-8-4-8 4Z" />,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  eye: (
    <>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  eyeOff: (
    <>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <Circle cx={12} cy={12} r={3} />
      <Path d="M4 4l16 16" />
    </>
  ),
  alert: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 8v4.5M12 16h.01" />
    </>
  ),
  copy: (
    <>
      <Rect x={8} y={8} width={12} height={12} rx={2} />
      <Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  mic: (
    <>
      <Rect x={9} y={3} width={6} height={11} rx={3} />
      <Path d="M6 11a6 6 0 0 0 12 0M12 17v3" />
    </>
  ),
  arrowUp: <Path d="M12 19V5M6 11l6-6 6 6" />,
  person: (
    <>
      <Circle cx={12} cy={8.5} r={3.6} />
      <Path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  sliders: (
    <>
      <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <Circle cx={15} cy={7} r={2} />
      <Circle cx={9} cy={17} r={2} />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  calendar: (
    <>
      <Rect x={4} y={5} width={16} height={15} rx={2} />
      <Path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  trash: (
    <>
      <Path d="M5 7h14M10 7V5h4v2" />
      <Path d="M7 7l1 13h8l1-13" />
    </>
  ),
  pause: <Path d="M9 6v12M15 6v12" />,
  bookmark: <Path d="M7 4h10v16l-5-3.5L7 20Z" />,
  refresh: (
    <>
      <Path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <Path d="M4 4v4h4" />
      <Path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <Path d="M20 20v-4h-4" />
    </>
  ),
  logout: (
    <>
      <Path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4" />
      <Path d="M14 8l4 4-4 4M18 12H9" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color, strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ICONS[name]}
    </Svg>
  );
}

/** Three dots, filled (the "More" button). */
export function MoreDots({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={5.5} cy={12} r={1.7} />
      <Circle cx={12} cy={12} r={1.7} />
      <Circle cx={18.5} cy={12} r={1.7} />
    </Svg>
  );
}

/** The Ronda ring as a small icon (Today and Team tabs, Ask Ronda). */
export function RingIcon({ size = 24, color, dot, strokeWidth = 2.2 }: { size?: number; color: string; dot: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle
        cx={12}
        cy={12}
        r={8}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="41.9 8.4"
        transform="rotate(-60 12 12)"
      />
      <Circle cx={12} cy={4} r={2.2} fill={dot} />
    </Svg>
  );
}
