import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "flowly — Finanças Pessoais",
    short_name: "flowly",
    description:
      "Registro manual de receitas e despesas, com orçamento por categoria e fluxo mensal.",
    start_url: "/dashboard",
    display: "standalone",
    lang: "pt-BR",
    background_color: "#0F1117",
    theme_color: "#0F1117",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
