// metadataをエクスポートするためのファイル
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ErrorSuppressor from '../components/ErrorSuppressor';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RealMotionEngine',
  description: 'Browser-first real-time motion-tracking and research platform',
};

// サーバーコンポーネントとしてのレイアウト
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <ErrorSuppressor>
          {children}
        </ErrorSuppressor>
      </body>
    </html>
  );
} 