import { cacheGet, cacheSet, cacheDel } from "@/server/cache/cache";
import { connectToDatabase } from "@/server/db";
import { SemesterTemplate } from "@/server/models/SemesterTemplate";

const keyForYear = (academicYear: number) => `semesterTemplate:year:${academicYear}`;

export async function getSemesterTemplateForYear(academicYear: number) {
  const key = keyForYear(academicYear);
  const cached = cacheGet<any>(key);
  if (cached) return cached;

  await connectToDatabase();
  const tpl = await SemesterTemplate.findOne({ academicYear }).sort({ createdAt: -1 }).lean();
  if (!tpl) return null;

  cacheSet(key, tpl, 1000 * 60 * 10);
  return tpl;
}

export function invalidateSemesterTemplateCache(academicYear: number) {
  cacheDel(keyForYear(academicYear));
}
