import { noStoreJson } from "@/server/httpCache";

export async function GET() {
  return noStoreJson(
    {
      error: "File downloads are disabled. Open the resource link instead.",
    },
    410
  );
}
