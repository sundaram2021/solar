/**
 * Secret hygiene: scan for leaked credentials and mask them before logs/traces
 * are persisted (defense in depth for sandbox exec output and agent summaries).
 */

const SECRET_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /sk-ant-[A-Za-z0-9_-]{10,}/, label: "anthropic key" },
  { re: /sk-[A-Za-z0-9]{20,}/, label: "api key" },
  { re: /gh[pousr]_[A-Za-z0-9]{20,}/, label: "github token" },
  { re: /x-access-token:[^@\s]+@/, label: "embedded git credential" },
  { re: /sb_secret_[A-Za-z0-9_-]{10,}/, label: "supabase secret" },
  { re: /tl_apiKey_[A-Za-z0-9_-]{10,}/, label: "tensorlake key" },
  { re: /ak_live_[A-Za-z0-9]{10,}/, label: "armoriq key" },
  { re: /-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----/, label: "private key" },
  { re: /AKIA[0-9A-Z]{16}/, label: "aws key" },
];

export function scanSecrets(text: string): string[] {
  const hits: string[] = [];
  for (const { re, label } of SECRET_PATTERNS) {
    if (re.test(text)) hits.push(label);
  }
  return [...new Set(hits)];
}

/** Mask credentials before persisting logs/traces (defense in depth). */
export function scrubSecrets(text: string): string {
  let out = text;
  out = out.replace(/x-access-token:[^@\s]+@/g, "x-access-token:***@");
  out = out.replace(/sk-ant-[A-Za-z0-9_-]{10,}/g, "sk-ant-***");
  out = out.replace(/gh[pousr]_[A-Za-z0-9]{20,}/g, "ghp-***");
  out = out.replace(/sb_secret_[A-Za-z0-9_-]{10,}/g, "sb_secret-***");
  out = out.replace(/tl_apiKey_[A-Za-z0-9_-]{10,}/g, "tl_apiKey-***");
  out = out.replace(/ak_live_[A-Za-z0-9]{10,}/g, "ak_live-***");
  out = out.replace(/-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (RSA |OPENSSH )?PRIVATE KEY-----/g, "***PRIVATE KEY***");
  return out;
}
