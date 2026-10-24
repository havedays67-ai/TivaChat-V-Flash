import { eq } from "drizzle-orm";
import { db } from "@/db";
import { patches } from "@/db/schema";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXTENSIONS: Record<string, string> = { java: "java", xml: "xml", gradle: "gradle", bash: "sh" };

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  await ensureSeed();
  const [patch] = await db.select().from(patches).where(eq(patches.key, key)).limit(1);
  if (!patch) {
    return Response.json({ error: "پچ پیدا نشد." }, { status: 404 });
  }

  const fileName = patch.target.split("/").pop() ?? `${patch.key}.txt`;
  const extension = EXTENSIONS[patch.language] ?? "txt";
  const downloadName = fileName.endsWith(`.${extension}`) ? fileName : `${fileName}.${extension}`;

  return new Response(patch.content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "no-store",
    },
  });
}
