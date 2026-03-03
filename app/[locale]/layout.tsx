import type { Metadata } from "next";
import "./globals.css";
import { RotationPatternsProvider } from "@/contexts/RotationPatternsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AutoSyncProvider } from "@/contexts/AutoSyncContext";
import { AutoBackupProvider } from "@/contexts/AutoBackupContext";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

export const metadata: Metadata = {
  title: "Shift Manager",
  description: "Gestion intelligente des équipes",
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <AutoSyncProvider>
              <AutoBackupProvider>
                <RotationPatternsProvider>
                  {children}
                </RotationPatternsProvider>
              </AutoBackupProvider>
            </AutoSyncProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}