import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VinoCellar Pro — Wine & Spirits Inventory Management",
  description: "Professional cloud-based inventory management platform for wine and spirits businesses.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍷</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}