import type { Metadata } from "next";
import "./globals.css";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { ColourNotationProvider } from "@/components/colour-notation-provider";
import SkipLink from "@/components/ui/skip-link";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/branding";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  icons: {
    icon: "/malpitools-icon.svg",
    shortcut: "/malpitools-icon.svg",
    apple: "/malpitools-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ColourNotationProvider>
          <SidebarProvider>
            <SkipLink />
            <AppSidebar />
            <SidebarInset>
              <AppHeader />
              <main
                className="flex-1 overflow-auto"
                id="main-content"
                tabIndex={-1}
              >
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </ColourNotationProvider>
      </body>
    </html>
  );
}
