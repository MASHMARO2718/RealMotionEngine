'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import ErrorSuppressor from '../components/shared/ErrorSuppressor';
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';

const inter = Inter({ subsets: ['latin'] });

// ダークテーマの設定
const theme = createTheme({
  primaryColor: 'cyan',
  defaultRadius: 'md',
  fontFamily: inter.style.fontFamily,
});

// クライアントコンポーネントとしてのレイアウト
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <MantineProvider theme={theme} defaultColorScheme="dark">
          <ErrorSuppressor>
            {children}
          </ErrorSuppressor>
        </MantineProvider>
      </body>
    </html>
  );
} 