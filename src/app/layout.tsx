import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { SCRIPT_DO_TEMA } from "@/lib/tema";
import "./globals.css";

// O texto usa a pilha de fontes do sistema definida em `--fonte` (globals.css),
// como no design system. Só o código mantém uma fonte carregada.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bimo",
  description: "Converse com as suas notas do Obsidian.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: o script abaixo escreve `data-tema` no <html> antes
    // de o React hidratar — sem isso o React trataria a diferença como erro.
    <html
      lang="pt-BR"
      className={`${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Aplica o tema salvo antes da primeira pintura (guia "preventing flash before hydration" do Next). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
      </head>
      {/* h-screen + overflow-hidden: a página não rola, só o interior dos painéis */}
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
