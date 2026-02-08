import type { Metadata } from "next";
import "./globals.css";
import { RotationPatternsProvider } from "@/contexts/RotationPatternsContext";
import { AuthProvider } from "@/contexts/AuthContext";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Shift Manager",
  description: "Gestion intelligente des équipes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">
        <AuthProvider>
          <RotationPatternsProvider>
            {children}
          </RotationPatternsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}