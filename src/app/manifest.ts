import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Tutor",
    short_name: "Tutor",
    description: "Learn from your own material with your personal AI tutor.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2FA84F",
    icons: [
      { src: "/icons/tutor-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/tutor-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
