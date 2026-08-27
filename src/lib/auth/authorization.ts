export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseAdminEmails(value: string) {
  return new Set(value.split(",").map(normalizeEmail).filter(Boolean));
}

export function isAdminEmail(email: string, configuredEmails: string) {
  return parseAdminEmails(configuredEmails).has(normalizeEmail(email));
}
