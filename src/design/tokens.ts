/**
 * Design tokens for EgyBay mobile.
 *
 * These are not new values. The app already used a coherent Tailwind slate/blue
 * palette -- it just spelled it out as ~1,000 hex literals across 28 screens,
 * so nothing could be adjusted in one place and drift was invisible. This
 * codifies what is already on screen.
 *
 * Where the app disagreed with itself, the token follows the dominant usage:
 *   #2563EB (161 uses) is the primary, not #3665F3 (25) or #3B82F6 (32).
 *
 * Scales follow Apple's Human Interface Guidelines, which this app ships
 * against on iOS:
 *   - 8pt grid with 4pt subdivisions
 *   - minimum 44x44pt tap target (also WCAG 2.1 AAA)
 *   - type scale 34/28/22/20/17/16/15/13/12/11, nothing below 11
 */

/** 4pt grid. 43% of the app's spacing values were off-grid (10, 6, 14, 2, 3, 5). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/**
 * iOS type scale. The app had 28 distinct font sizes including 8, 9, 10, 10.5,
 * 11.5, 12.5, 14.5, 19 and 21 -- noise rather than a scale. Apple's smallest
 * style is caption2 at 11pt; anything under that is below the platform's own
 * legibility floor, and the app used 8-10pt in 74 places.
 */
export const font = {
  largeTitle: 34,
  title1: 28,
  title2: 22,
  title3: 20,
  headline: 17,
  body: 17,
  callout: 16,
  subhead: 15,
  footnote: 13,
  caption: 12,
  caption2: 11,
} as const;

/** The smallest text this app may render. Below this is illegible on device. */
export const MIN_FONT_SIZE = font.caption2;

export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
  black: '900',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/**
 * Semantic colour roles. Prefer these over hex literals so a change lands
 * everywhere at once -- and so it is obvious when a screen invents a colour.
 */
export const color = {
  // Brand
  primary: '#2563EB',        // blue-600  (161 uses -- the real primary)
  primaryDark: '#1D4ED8',
  primarySoft: '#EFF6FF',    // blue-50
  primaryBorder: '#BFDBFE',  // blue-200

  // Text
  text: '#0F172A',           // slate-900
  textSecondary: '#475569',  // slate-600
  textMuted: '#64748B',      // slate-500
  textFaint: '#94A3B8',      // slate-400
  textInverse: '#FFFFFF',

  // Surfaces
  bg: '#F8FAFC',             // slate-50
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',     // slate-100
  border: '#E2E8F0',         // slate-200
  borderStrong: '#CBD5E1',   // slate-300
  ink: '#0F172A',            // dark panels
  inkAlt: '#1E293B',         // slate-800

  // Status. These carry meaning in an escrow marketplace -- success must never
  // be used for a payment that has not been confirmed.
  success: '#10B981',        // emerald-500
  successDark: '#059669',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',        // amber-500
  warningDark: '#D97706',
  warningSoft: '#FFFBEB',
  danger: '#EF4444',         // red-500
  dangerDark: '#DC2626',
  dangerSoft: '#FEF2F2',

  // Accents used by Live / boost surfaces
  accent: '#6366F1',         // indigo-500
  accentAlt: '#7C3AED',      // violet-600
} as const;

/**
 * Apple HIG minimum tap target, also WCAG 2.1 AAA. Android/Material asks 48dp.
 * Where a control must render smaller than this, give it hitSlop so the
 * *touchable* area still clears 44 even though the ink does not.
 */
export const MIN_TAP_TARGET = 44;

/** hitSlop that expands a control of `size` up to MIN_TAP_TARGET. */
export function tapSlop(size: number) {
  const pad = Math.max(0, Math.ceil((MIN_TAP_TARGET - size) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
}

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;
