import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { RegisterServiceWorker } from '@/components/pwa/RegisterServiceWorker';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Flowly — Finanças Pessoais',
  description: 'Registro manual de receitas e despesas com orçamento base zero.',
  applicationName: 'flowly',
  appleWebApp: {
    capable: true,
    title: 'flowly',
    // A barra de status combina com o fundo do app quando instalado no iOS.
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0F1117',
  // O app instalado precisa respeitar o notch e a barra inferior do iOS.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable}`}>
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
