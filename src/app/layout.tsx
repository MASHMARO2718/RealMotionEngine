'use client';

// import { Inter } from 'next/font/google';
// const inter = Inter({ subsets: ['latin'] });
import './globals.css';
import ErrorSuppressor from '../components/shared/ErrorSuppressor';

// ダークテーマの設定
const theme = {
  primaryColor: 'cyan',
  defaultRadius: 'md',
  fontFamily: 'Orbitron, sans-serif',
};

// クライアントコンポーネントとしてのレイアウト
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <ErrorSuppressor>
          {children}
        </ErrorSuppressor>
      </body>
    </html>
  );
} 