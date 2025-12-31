import { noStoreJson } from "@/server/httpCache";

export async function GET() {
  return noStoreJson({ error: "This endpoint is deprecated." }, 410);
}

export async function POST() {
  return noStoreJson({ error: "This endpoint is deprecated." }, 410);
}
