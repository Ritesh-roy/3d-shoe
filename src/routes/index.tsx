import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@/components/ClientOnly";
import { LeoSite } from "@/components/leo/LeoSite";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LEO FOOTWEAR — Future Starts From Your Feet" },
      {
        name: "description",
        content:
          "A cinematic 3D product experience for LEO FOOTWEAR. Inspect every layer of the LEO silhouette in real time.",
      },
      { property: "og:title", content: "LEO FOOTWEAR" },
      { property: "og:description", content: "Future Starts From Your Feet." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly
      fallback={
        <div className="min-h-screen bg-[#06070a] flex items-center justify-center text-white/60 text-xs tracking-[0.4em]">
          LOADING LEO FOOTWEAR…
        </div>
      }
    >
      <LeoSite />
    </ClientOnly>
  );
}
