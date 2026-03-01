import type { MetadataRoute } from "next";
import { fetchDaoBranding } from "./branding";

function toShortName(name: string) {
  return name.length > 24 ? `${name.slice(0, 21)}...` : name;
}

export default async function manifest({
  params,
}: {
  params: { dao: string };
}): Promise<MetadataRoute.Manifest> {
  const dao = String(params.dao || "").trim();
  const branding = await fetchDaoBranding(dao);
  const basePath = `/dao/${dao}`;
  const iconBase = `${basePath}/pwa-icon`;

  return {
    id: basePath,
    name: branding.name,
    short_name: toShortName(branding.name),
    description: branding.description,
    start_url: basePath,
    scope: basePath,
    display: "standalone",
    orientation: "portrait",
    background_color: branding.backgroundColor,
    theme_color: branding.themeColor,
    icons: [
      { src: `${iconBase}?size=192`, sizes: "192x192", type: "image/png" },
      { src: `${iconBase}?size=512`, sizes: "512x512", type: "image/png" },
      {
        src: `${iconBase}?size=512&maskable=1`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
