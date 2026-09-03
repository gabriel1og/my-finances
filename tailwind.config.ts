import type { Config } from 'tailwindcss';

// Tokens do design system flowly — nao alterar sem atualizar finance-design-system.jsx.
// Exceção: a tipografia divergiu de propósito em 03/09 (ver claude/decisao-tipografia.md).
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
      // Escala tipográfica fechada: antes conviviam text-[10px], text-[11px] e
      // seis tamanhos nomeados sem regra. Cada passo já carrega o line-height,
      // para densidade não depender de quem escreve a classe.
      // Escala tipográfica fechada: cada passo carrega o line-height, para a
      // densidade não depender de quem escreve a classe. Subiu 2px em todos os
      // passos (02/09) — o texto estava pequeno demais na tela real.
      fontSize: {
        '3xs': ['0.75rem', { lineHeight: '1rem' }], // 12px — selo, contador
        '2xs': ['0.8rem', { lineHeight: '1.1rem' }], // 13px — legenda, meta
        xs: ['0.9rem', { lineHeight: '1.25rem' }], // 14px — apoio
        sm: ['1rem', { lineHeight: '1.5rem' }], // 16px — corpo
        base: ['1.1rem', { lineHeight: '1.6rem' }], // 18px
        lg: ['1.2rem', { lineHeight: '1.75rem' }], // 20px — título de página
        xl: ['1.3rem', { lineHeight: '1.8rem' }], // 22px — número-título de card
        '2xl': ['1.4rem', { lineHeight: '2rem' }], // 26px — KPI
      },
      // A Inter vem do next/font em app/layout.tsx, que define --font-inter e
      // auto-hospeda os arquivos. `mono` fica só para <code>/<pre> — nenhum
      // dado numérico usa font-mono; ver a regra .num em globals.css.
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
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
