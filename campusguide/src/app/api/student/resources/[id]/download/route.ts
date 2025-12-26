import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/env";
import { connectToDatabase } from "@/server/db";
import { Resource } from "@/server/models/Resource";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { getR2Client } from "@/server/r2/client";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "student:resources:download");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  const resDoc = await Resource.findById(id).lean();
  if (!resDoc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  if (!resDoc.objectKey) {
    return new Response(JSON.stringify({ error: "No file for this resource" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  if (!env.R2_BUCKET) {
    return new Response(JSON.stringify({ error: "Storage not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const client = getR2Client();
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: resDoc.objectKey }),
    { expiresIn: 60 }
  );

  return new Response(JSON.stringify({ url }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
