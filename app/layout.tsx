import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME_EN, SITE_DESCRIPTION_EN } from "@/lib/constants";
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
  title: `${APP_NAME_EN} - Fresh Food, Fast Delivery`,
  description: SITE_DESCRIPTION_EN,
  applicationName: APP_NAME_EN,
  openGraph: {
    title: `${APP_NAME_EN} - Fresh Food, Fast Delivery`,
    description: SITE_DESCRIPTION_EN,
    url: "/",
    siteName: APP_NAME_EN,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${APP_NAME_EN} logo and app preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME_EN} - Fresh Food, Fast Delivery`,
    description: SITE_DESCRIPTION_EN,
    images: ["/opengraph-image"],
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
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
