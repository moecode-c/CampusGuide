import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Oxanium, Press_Start_2P } from "next/font/google";
import "./globals.css";
import { AppSessionProvider } from "@/components/SessionProvider";
import { AppChrome } from "@/components/AppChrome";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CursorGlow } from "@/components/CursorGlow";
import { Analytics } from "@/components/Analytics";

const geistSans = Oxanium({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistDisplay = Press_Start_2P({
  variable: "--font-geist-display",
  subsets: ["latin"],
  weight: ["400"],
});

const geistMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CampusGuide",
  description: "Student platform: GPA, attendance, schedule, resources, and campus map.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#01051a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${geistSans.variable} ${geistDisplay.variable} ${geistMono.variable} antialiased`}>
        <CursorGlow />
        <AppSessionProvider>
          <div className="min-h-dvh min-w-0 overflow-x-clip bg-background text-foreground">
            <AppChrome navbar={<Navbar />} footer={<Footer />}>
              {children}
            </AppChrome>
          </div>
        </AppSessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
