/**
 * MIU identity rules, shared by the registration form and the API so the two
 * can never disagree about what a valid student looks like.
 *
 * A student ID is `20xx/xxxxx` — a four-digit intake year starting with 20,
 * then a five-digit serial. The university email embeds those same nine digits
 * after the student's name:
 *
 *   ID     2024/15832
 *   Email  ahmed202415832@miuegypt.edu.eg
 *
 * Cross-checking the two catches typos and makes a mismatched pair impossible
 * to register with.
 */

export const MIU_EMAIL_DOMAIN = "miuegypt.edu.eg";

export const MIU_ID_PATTERN = /^20\d{2}\/\d{5}$/;

/** name (letters, dots and hyphens) + the nine ID digits + the university domain. */
const MIU_EMAIL_PATTERN = new RegExp(
  `^([a-zA-Z][a-zA-Z.\\-]*)(\\d{9})@${MIU_EMAIL_DOMAIN.replace(/\./g, "\\.")}$`
);

export const MIU_ID_HINT = "Student ID must look like 2024/15832";
export const MIU_EMAIL_HINT = `University email must look like ahmed202415832@${MIU_EMAIL_DOMAIN}`;

/** Trims and normalizes an ID; also accepts a dash or space where the slash goes. */
export function normalizeMiuId(raw: string) {
  return raw.trim().replace(/[\s-]+/g, "/");
}

export function isValidMiuId(raw: string) {
  return MIU_ID_PATTERN.test(normalizeMiuId(raw));
}

/** "2024/15832" -> "202415832". Returns null when the ID is malformed. */
export function miuIdDigits(raw: string) {
  const id = normalizeMiuId(raw);
  if (!MIU_ID_PATTERN.test(id)) return null;
  return id.replace("/", "");
}

export function normalizeMiuEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export function isValidMiuEmail(raw: string) {
  return MIU_EMAIL_PATTERN.test(normalizeMiuEmail(raw));
}

/** The nine digits embedded in a university email, or null if it isn't one. */
export function miuEmailDigits(raw: string) {
  const match = MIU_EMAIL_PATTERN.exec(normalizeMiuEmail(raw));
  return match ? match[2] : null;
}

/**
 * Validates an ID/email pair together. Returns null when they're consistent,
 * or a message suitable for showing on the registration form.
 */
export function validateMiuIdentity(rawId: string, rawEmail: string): string | null {
  const idDigits = miuIdDigits(rawId);
  if (!idDigits) return MIU_ID_HINT;

  const emailDigits = miuEmailDigits(rawEmail);
  if (!emailDigits) return MIU_EMAIL_HINT;

  if (idDigits !== emailDigits) {
    return "Your university email must contain the same digits as your student ID";
  }

  return null;
}

/**
 * Egyptian mobile numbers, with or without the country code:
 * 01012345678, +201012345678, 00201012345678.
 */
const PHONE_PATTERN = /^(?:\+?20|0020|0)?1[0125]\d{8}$/;

export const PHONE_HINT = "Enter a valid Egyptian mobile number, e.g. 01012345678";

/** Strips spaces, dashes and brackets before matching. */
export function normalizePhone(raw: string) {
  const cleaned = raw.replace(/[\s()\-.]/g, "");
  if (!PHONE_PATTERN.test(cleaned)) return null;

  // Store one canonical shape so duplicates can be detected.
  const local = cleaned.replace(/^(?:\+?20|0020)/, "");
  return `+20${local.replace(/^0/, "")}`;
}

export function isValidPhone(raw: string) {
  return normalizePhone(raw) !== null;
}
