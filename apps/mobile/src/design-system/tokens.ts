/**
 * Si Design System - Design Tokens
 *
 * Brand-derived design tokens for the Si International Money Transfer app.
 * Colors extracted from official Si logo assets.
 */

// ─── COLORS ─────────────────────────────────────────────────────────────────

export const colors = {
  // Brand Primary - Deep forest green (from Si logo letterform)
  primary: {
    50: '#EDF5F0',
    100: '#D4E8DA',
    200: '#A9D1B6',
    300: '#7EBA91',
    400: '#53A36D',
    500: '#2D7A4E', // Main brand green
    600: '#256841',
    700: '#1E5535',
    800: '#164328',
    900: '#0F301C',
  },

  // Brand Accent - Gold/champagne (from Si star sparkle)
  accent: {
    50: '#FBF6EE',
    100: '#F4E9D5',
    200: '#E9D3AB',
    300: '#DEBD82',
    400: '#D3A758',
    500: '#C4A07A', // Star gold
    600: '#B08A5E',
    700: '#8E6F4B',
    800: '#6C5439',
    900: '#4A3926',
  },

  // Sage - Background tones (from Si logo background)
  sage: {
    50: '#F4F7F5',
    100: '#E8EDEA',
    200: '#D1DBD5',
    300: '#B8C5BE', // Logo background sage
    400: '#9AABA1',
    500: '#7C9184',
    600: '#637767',
    700: '#4A5C4E',
    800: '#324136',
    900: '#1A261D',
  },

  // Neutrals - Clean, professional gray scale
  neutral: {
    0: '#FFFFFF',
    50: '#F8F9FA',
    100: '#F1F3F5',
    200: '#E9ECEF',
    300: '#DEE2E6',
    400: '#ADB5BD',
    500: '#868E96',
    600: '#495057',
    700: '#343A40',
    800: '#212529',
    900: '#0D1117',
  },

  // Semantic
  success: '#12B76A',
  successLight: '#D1FADF',
  warning: '#F79009',
  warningLight: '#FEF0C7',
  error: '#F04438',
  errorLight: '#FEE4E2',
  info: '#2E90FA',
  infoLight: '#D1E9FF',

  // Crypto token colors (industry standard)
  bitcoin: '#F7931A',
  ethereum: '#627EEA',
  usdc: '#2775CA',
  usdt: '#26A17B',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

// ─── TYPOGRAPHY ─────────────────────────────────────────────────────────────

export const typography = {
  // Font families (Inter for clean fintech look)
  family: {
    regular: 'System',     // Will be replaced with Inter once loaded
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },

  // Font sizes - clean scale
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 30,
    '3xl': 36,
    '4xl': 48,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },

  // Font weights (as string for RN)
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },

  // Letter spacing
  tracking: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 1.5,
  },
} as const;

// ─── SPACING ────────────────────────────────────────────────────────────────

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

// ─── RADII ──────────────────────────────────────────────────────────────────

export const radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 9999,
} as const;

// ─── SHADOWS ────────────────────────────────────────────────────────────────

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;

// ─── BRAND GRADIENTS ────────────────────────────────────────────────────────

export const gradients = {
  // Primary brand gradient (from Si LogoG background)
  primary: ['#1B5E3A', '#2D7A4E'] as [string, string],
  primaryExtended: ['#164328', '#1E5535', '#2D7A4E'] as [string, string, string],

  // Gold accent gradient (from star sparkle)
  accent: ['#C4A07A', '#D3A758'] as [string, string],

  // Sage subtle gradient
  sage: ['#E8EDEA', '#D1DBD5'] as [string, string],

  // Crypto-specific gradients
  bitcoin: ['#F7931A', '#E8850F'] as [string, string],
  ethereum: ['#627EEA', '#4E6BD4'] as [string, string],
  usdc: ['#2775CA', '#1E60A8'] as [string, string],
  usdt: ['#26A17B', '#1E8A68'] as [string, string],
} as const;

// ─── ICON SIZE ──────────────────────────────────────────────────────────────

export const iconSize = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
} as const;

// ─── Z-INDEX ────────────────────────────────────────────────────────────────

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
} as const;

// ─── ANIMATION ──────────────────────────────────────────────────────────────

export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: {
    friction: 8,
    tension: 40,
  },
} as const;

// ─── SAFE AREAS ─────────────────────────────────────────────────────────────

export const layout = {
  headerPaddingTop: 56,
  tabBarHeight: 64,
  screenPaddingH: spacing[5], // 20px
} as const;
