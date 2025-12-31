import { noStoreJson } from "@/server/httpCache";

export async function PATCH() {
  return noStoreJson({ error: "This endpoint is deprecated." }, 410);
}
