import type { Config } from 'tailwindcss';

// Tokens do design system flowly — nao alterar sem atualizar finance-design-system.jsx
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0F1117',
        surface: '#181C27',
        surfaceAlt: '#1E2333',
        border: '#2A2F45',
        borderHover: '#3A4060',
        textPrimary: '#E8EAF0',
        textSecondary: '#7B82A0',
        textMuted: '#4A5070',
        accent: '#5B6EF5',
        accentDim: '#1E2460',
        income: '#2ECC9A',
        incomeDim: '#0D3D2E',
        expense: '#F05C5C',
        expenseDim: '#3D1515',
        warning: '#F5A623',
        warningDim: '#3D2800',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: '4px', md: '8px', lg: '12px' },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        barGrow: { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
      },
      animation: {
        fadeUp: 'fadeUp 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        barGrow: 'barGrow 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
