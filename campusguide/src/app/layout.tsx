import type { Metadata } from "next";
import { JetBrains_Mono, Oxanium, Press_Start_2P } from "next/font/google";
import "./globals.css";
import { AppSessionProvider } from "@/components/SessionProvider";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CursorGlow } from "@/components/CursorGlow";

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

export const viewport: Metadata["viewport"] = {
  width: "device-width",
  initialScale: 1,
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
          <div className="min-h-screen bg-background text-foreground">
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <div className="flex-1">{children}</div>
              <Footer />
            </div>
          </div>
        </AppSessionProvider>
      </body>
    </html>
  );
}
