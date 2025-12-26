import { Suspense } from "react";
import { MapClient } from "./MapClient";

export default function MapPage() {
  return (
    <Suspense fallback={<p className="text-sm text-foreground/70">Loading map…</p>}>
      <MapClient />
    </Suspense>
  );
}
