const DEFAULT_ADMIN_EMAIL = "killscomfort@gmail.com";

export function getAdminEmail() {
  return import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase() || DEFAULT_ADMIN_EMAIL;
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return email.trim().toLowerCase() === getAdminEmail();
}
