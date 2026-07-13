import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['"LINE Seed JP"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Roboto', '"Hiragino Sans"', '"Noto Sans JP"', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        /* LDSG Role Color(機能固定の意味色) */
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--on-success))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--on-warning))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--on-info))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* --- M3 直接参照用(新規コード向け) --- */
        surface: {
          DEFAULT: 'hsl(var(--md-surface))',
          dim: 'hsl(var(--md-surface-dim))',
          bright: 'hsl(var(--md-surface-bright))',
        },
        'surface-container': {
          lowest: 'hsl(var(--md-surface-container-lowest))',
          low: 'hsl(var(--md-surface-container-low))',
          DEFAULT: 'hsl(var(--md-surface-container))',
          high: 'hsl(var(--md-surface-container-high))',
          highest: 'hsl(var(--md-surface-container-highest))',
        },
        'on-surface': {
          DEFAULT: 'hsl(var(--md-on-surface))',
          variant: 'hsl(var(--md-on-surface-variant))',
        },
        'primary-container': 'hsl(var(--md-primary-container))',
        'on-primary-container': 'hsl(var(--md-on-primary-container))',
        'secondary-container': 'hsl(var(--md-secondary-container))',
        'on-secondary-container': 'hsl(var(--md-on-secondary-container))',
        tertiary: {
          DEFAULT: 'hsl(var(--md-tertiary))',
          container: 'hsl(var(--md-tertiary-container))',
        },
        'on-tertiary-container': 'hsl(var(--md-on-tertiary-container))',
        outline: {
          DEFAULT: 'hsl(var(--md-outline))',
          variant: 'hsl(var(--md-outline-variant))',
        },
        scrim: 'hsl(var(--md-scrim))',
        'inverse-surface': 'hsl(var(--md-inverse-surface))',
        'inverse-on-surface': 'hsl(var(--md-inverse-on-surface))',
      },
      /* M3 type scale(主要段のみ) */
      fontSize: {
        'display-sm': ['2.25rem', { lineHeight: '2.75rem' }],
        'headline-md': ['1.75rem', { lineHeight: '2.25rem' }],
        'title-lg': ['1.375rem', { lineHeight: '1.75rem' }],
        'title-md': ['1rem', { lineHeight: '1.5rem', fontWeight: '500' }],
        'body-lg': ['1rem', { lineHeight: '1.5rem' }],
        'body-md': ['0.875rem', { lineHeight: '1.25rem' }],
        'label-lg': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
        'label-md': ['0.75rem', { lineHeight: '1rem', fontWeight: '500' }],
        /* LDSG Typography 2系統: Title=締まった行間(見出し・行タイトル)、
           Text(body)=読ませる行間+日本語向け letter-spacing */
        'title-xl': ['24px', { lineHeight: '1.3', fontWeight: '700' }],
        'title-s': ['15px', { lineHeight: '1.3', fontWeight: '500' }],
        'title-xs': ['13px', { lineHeight: '1.3', fontWeight: '700' }],
        'body-xs': ['13px', { lineHeight: '1.5' }],
      },
      boxShadow: {
        'elevation-1': 'var(--elevation-1)',
        'elevation-2': 'var(--elevation-2)',
        'elevation-3': 'var(--elevation-3)',
        /* LDSG on-white shadow(ダークでは CSS 変数側で none) */
        l100: 'var(--shadow-l100)',
        l200: 'var(--shadow-l200)',
        l300: 'var(--shadow-l300)',
      },
      transitionDuration: {
        'short-2': '100ms',
        'short-4': '200ms',
        'medium-2': '300ms',
        'long-2': '500ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
        'emphasized-decelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
        'emphasized-accelerate': 'cubic-bezier(0.3, 0, 0.8, 0.15)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        /* LDSG Object Styles: 画面占有率で使い分ける4段(badge<control<card<sheet) */
        badge: 'var(--radius-badge)',
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        sheet: 'var(--radius-sheet)',
      },
    },
  },
  plugins: [],
} satisfies Config;
