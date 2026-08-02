/**
 * Names are user-controlled text, so policy checks use a comparison key rather
 * than the rendered spelling. NFKD removes compatibility tricks and accents;
 * stripping punctuation catches spaced, hyphenated, and dotted variants.
 */
export function nameComparisonKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[013457@$]/g, (character) =>
      ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" })[
        character
      ] ?? character,
    )
    .replace(/[^a-z0-9]/g, "");
}

// Keep this list intentionally small and explicit. These are names that are
// unambiguously abusive or impersonation-oriented in a profile name, not a
// general-purpose dictionary of sensitive words.
const BLOCKED_NAME_KEYS = [
  "racist",
  "racists",
  "rapist",
  "rapists",
  "prisoner",
  "prisoners",
  "hitler",
  "epstein",
  "nword",
  "nigger",
  "nigga",
] as const;

// These are protected identity keys, not a public reservation. They are only
// claimable by an authenticated owner whose email appears in OWNER_EMAILS.
const OWNER_NAME_KEYS = [
  "nikolassapa",
  "niksapa",
  "nikolassapalidis",
  "niksapalidis",
] as const;

export type NamePolicyResult =
  | { ok: true }
  | { ok: false; code: "name_not_allowed" | "owner_name_reserved" };

export function validateProfileName(value: string, ownerClaim = false): NamePolicyResult {
  const key = nameComparisonKey(value);
  if (!key) return { ok: true };

  if (BLOCKED_NAME_KEYS.some((blocked) => key.includes(blocked))) {
    return { ok: false, code: "name_not_allowed" };
  }

  if (!ownerClaim && OWNER_NAME_KEYS.some((ownerName) => key.includes(ownerName))) {
    return { ok: false, code: "owner_name_reserved" };
  }

  return { ok: true };
}
