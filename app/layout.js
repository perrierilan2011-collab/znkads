export const metadata = {
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata = {
    other: {
    monetag: "843b0926bb1e138278af968e479779d4"
  }
};
  title: "ZNK Ads — Regarde. Valide. Encaisse.",
  description:
    "ZNK Ads rémunère le visionnage de publicités partenaires. Les gains sont crédités uniquement après validation réelle de la régie publicitaire.",
  applicationName: "ZNK Ads",
  openGraph: {
    title: "ZNK Ads",
    description:
      "Plateforme de publicités rémunérées avec validation réelle par la régie publicitaire.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#0D0D12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
