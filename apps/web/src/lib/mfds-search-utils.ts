import type { MfdsApiSource } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A UI chip representing one active search filter */
export interface FilterChip {
  field: string;
  label: string;
  value: string;
}

/** Result of auto-detecting which API fields to query */
export interface DetectedSearch {
  /** Primary search filter (always present) */
  primary: Record<string, string>;
  /** Optional fallback filter tried when primary returns no results */
  fallback: Record<string, string> | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** 4+ consecutive digits */
const PURE_DIGITS = /^\d{4,}$/;

/** Digits separated by hyphens, e.g. 645-01-0123 */
const DIGITS_WITH_HYPHEN = /^\d[\d-]+\d$/;

/** Alphanumeric classification code like A01B, C09DA */
const ALPHA_DIGITS_CODE = /^[A-Za-z]\d{2,}[A-Za-z]?\d*$/;

/** Contains at least one Korean character */
const HAS_KOREAN = /[\uAC00-\uD7AF\u3130-\u318F]/;

/** Latin letters only (no digits, no special chars) */
const ALPHA_ONLY = /^[A-Za-z\s]+$/;

// ---------------------------------------------------------------------------
// Main detection function
// ---------------------------------------------------------------------------

/**
 * Analyse a free-text query and decide which MFDS API field(s) to search.
 *
 * The function returns a `primary` filter to use first, and optionally a
 * `fallback` filter the caller can try when the primary yields no results.
 */
export function detectSearchFields(
  query: string,
  tab: MfdsApiSource,
): DetectedSearch {
  const q = query.trim();

  // --- Pure digits (4+ chars) ---
  if (PURE_DIGITS.test(q)) {
    return tab === "drug"
      ? { primary: { BAR_CODE: q }, fallback: { ITEM_SEQ: q } }
      : { primary: { UDIDI_CD: q }, fallback: { PERMIT_NO: q } };
  }

  // --- Digits with hyphens (e.g. EDI code, permit number) ---
  if (DIGITS_WITH_HYPHEN.test(q)) {
    return tab === "drug"
      ? { primary: { EDI_CODE: q }, fallback: { BAR_CODE: q } }
      : { primary: { PERMIT_NO: q }, fallback: { MDEQ_CLSF_NO: q } };
  }

  // --- Alpha + digits classification code (e.g. A01B, C09DA06) ---
  if (ALPHA_DIGITS_CODE.test(q)) {
    return tab === "drug"
      ? { primary: { ATC_CODE: q }, fallback: null }
      : { primary: { MDEQ_CLSF_NO: q }, fallback: null };
  }

  // --- Contains Korean characters ---
  if (HAS_KOREAN.test(q)) {
    return tab === "drug"
      ? { primary: { ITEM_NAME: q }, fallback: { ENTP_NAME: q } }
      : { primary: { PRDLST_NM: q }, fallback: { MNFT_IPRT_ENTP_NM: q } };
  }

  // --- Alpha only (English text) ---
  if (ALPHA_ONLY.test(q)) {
    return tab === "drug"
      ? { primary: { ITEM_NAME: q }, fallback: null }
      : { primary: { FOML_INFO: q }, fallback: null };
  }

  // --- Default ---
  return tab === "drug"
    ? { primary: { ITEM_NAME: q }, fallback: null }
    : { primary: { PRDLST_NM: q }, fallback: null };
}
