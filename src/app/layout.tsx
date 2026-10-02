import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Light or dark before anything is drawn (no white flash): your choice from the switch in the top
// bar, or else your computer's setting. The public QR form (/s/...) that sellers see stays light.
const THEME_SCRIPT = `(function(){try{var p=location.pathname.indexOf("/s/")===0;var t=localStorage.getItem("omcc-theme");var d=!p&&(t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}})()`

export const metadata: Metadata = {
  title: "One Marketing Command Center",
  description: "Google Ads results, website leads and phone calls in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The theme script below sets the dark class before the page shows.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
