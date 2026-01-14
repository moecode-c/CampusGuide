import Script from "next/script";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ModelViewerSection({
  src = "/robot-playground.glb",
  animationName = "Experiment",
}: {
  src?: string;
  animationName?: string;
}) {
  return (
    <section className="mt-10">
      <Script
        type="module"
        src="https://unpkg.com/@google/model-viewer@4.1.0/dist/model-viewer.min.js"
        strategy="afterInteractive"
      />

      <Card className="border-foreground/10 bg-panel/40 overflow-hidden">
        <CardHeader>
          <CardTitle>Robot Playground</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full overflow-hidden rounded-2xl border border-foreground/10 bg-linear-to-br from-primary/10 via-background to-accent/10 sm:h-110 lg:h-130">
            <model-viewer
              src={src}
              alt="Robot Playground 3D model"
              autoplay
              animation-name={animationName}
              camera-controls
              touch-action="pan-y"
              shadow-intensity="1"
              shadow-softness="0.7"
              environment-image="neutral"
              exposure="1.35"
              className="block h-full w-full saturate-150 contrast-125"
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
