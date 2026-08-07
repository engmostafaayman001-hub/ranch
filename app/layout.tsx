import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME_AR, APP_NAME_EN, SITE_DESCRIPTION_AR, SITE_TAGLINE_AR } from "@/lib/constants";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import { AuthHydrator } from "@/components/auth-hydrator";
import { PwaRegistrar } from "@/components/pwa-registrar";
import { FloatingInstallButton } from "@/components/floating-install-button";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const arabicTitle = `${APP_NAME_AR} | ${SITE_TAGLINE_AR}`;
const shareImage = "/og-ar.png?v=20260603-ar";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://ranch1.shop"),
  title: arabicTitle,
  description: SITE_DESCRIPTION_AR,
  applicationName: `${APP_NAME_AR} - ${APP_NAME_EN}`,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: arabicTitle,
    description: SITE_DESCRIPTION_AR,
    url: "/",
    siteName: APP_NAME_AR,
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: shareImage,
        width: 1200,
        height: 630,
        alt: `${APP_NAME_AR} - ${SITE_TAGLINE_AR}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: arabicTitle,
    description: SITE_DESCRIPTION_AR,
    images: [shareImage],
  },
  icons: {
    icon: "/favicon.png?v=20260603-logo",
    shortcut: "/favicon.png?v=20260603-logo",
    apple: "/apple-icon.png?v=20260603-logo",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50">
        <LanguageProvider>
          <ThemeProvider>
            <AuthHydrator />
            <PwaRegistrar />
            {children}
            <FloatingInstallButton />
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
