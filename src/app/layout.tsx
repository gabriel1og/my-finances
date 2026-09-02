import type { Metadata, Viewport } from 'next';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { RegisterServiceWorker } from '@/components/pwa/RegisterServiceWorker';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
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
    <html lang="pt-BR" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
