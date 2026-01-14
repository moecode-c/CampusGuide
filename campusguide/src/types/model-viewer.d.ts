import type * as React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        poster?: string;
        alt?: string;
        autoplay?: boolean;
        "animation-name"?: string;
        "camera-controls"?: boolean;
        "disable-zoom"?: boolean;
        "shadow-intensity"?: string | number;
        exposure?: string | number;
        ar?: boolean;
        "touch-action"?: string;
      };
    }
  }
}

export {};
