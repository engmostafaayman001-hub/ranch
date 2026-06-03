import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME_AR, APP_NAME_EN, SITE_DESCRIPTION_AR } from "@/lib/constants";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import { AuthHydrator } from "@/components/auth-hydrator";
import { PwaRegistrar } from "@/components/pwa-registrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://ranch.vercel.app"),
  title: `${APP_NAME_AR} | طلب طعام سريع وتتبع لحظي`,
  description: SITE_DESCRIPTION_AR,
  applicationName: `${APP_NAME_AR} - ${APP_NAME_EN}`,
  openGraph: {
    title: `${APP_NAME_AR} | طلب طعام سريع وتتبع لحظي`,
    description: SITE_DESCRIPTION_AR,
    url: "/",
    siteName: `${APP_NAME_AR} - ${APP_NAME_EN}`,
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: "/favicon.png?v=20260603-logo",
        width: 1024,
        height: 1024,
        alt: `${APP_NAME_AR} ${APP_NAME_EN} logo`,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: `${APP_NAME_AR} | طلب طعام سريع وتتبع لحظي`,
    description: SITE_DESCRIPTION_AR,
    images: ["/favicon.png?v=20260603-logo"],
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
      lang="en"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50">
        <LanguageProvider>
          <ThemeProvider>
            <AuthHydrator />
            <PwaRegistrar />
            {children}
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
