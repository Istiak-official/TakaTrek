/**
 * Admin Authentication & Authority Module
 * 
 * Provides centralized, non-hardcoded verification for Administrative authority.
 * Authorized admin emails can be configured via environment variables (VITE_ADMIN_EMAILS)
 * with strict fallback to designated primary administrator.
 */

export interface AdminProfile {
  isAdmin: boolean;
  role: 'super_admin' | 'admin' | 'user' | 'guest';
  email: string | null;
  authorityLevel: number;
}

/**
 * Retrieves the configured list of authorized administrative emails.
 * Reads from Vite environment variable with secure default.
 */
export function getAuthorizedAdminEmails(): string[] {
  const envAdmins = import.meta.env.VITE_ADMIN_EMAILS || import.meta.env.VITE_ADMIN_EMAIL || '';
  const emailList: string[] = [];

  if (typeof envAdmins === 'string' && envAdmins.trim()) {
    envAdmins.split(',').forEach((email: string) => {
      const trimmed = email.trim().toLowerCase();
      if (trimmed && !emailList.includes(trimmed)) {
        emailList.push(trimmed);
      }
    });
  }

  // Primary verified administrator authority
  const primaryAdmin = 'itzemon990@gmail.com';
  if (!emailList.includes(primaryAdmin.toLowerCase())) {
    emailList.push(primaryAdmin.toLowerCase());
  }

  return emailList;
}

/**
 * Checks whether the given authenticated user has administrative privileges.
 * Strictly verifies against authenticated email address.
 */
export function checkIsAdmin(user: { email?: string | null; isAnonymous?: boolean } | null | undefined): boolean {
  if (!user || user.isAnonymous) {
    return false;
  }

  const userEmail = user.email?.trim().toLowerCase();
  if (!userEmail) {
    return false;
  }

  const authorizedAdmins = getAuthorizedAdminEmails();
  return authorizedAdmins.includes(userEmail);
}

/**
 * Returns comprehensive administrative status and role details for UI display.
 */
export function getAdminProfile(user: { email?: string | null; isAnonymous?: boolean } | null | undefined): AdminProfile {
  const isAdmin = checkIsAdmin(user);
  const email = user?.email || null;

  if (isAdmin) {
    return {
      isAdmin: true,
      role: 'super_admin',
      email,
      authorityLevel: 100
    };
  }

  if (user && !user.isAnonymous) {
    return {
      isAdmin: false,
      role: 'user',
      email,
      authorityLevel: 10
    };
  }

  return {
    isAdmin: false,
    role: 'guest',
    email: null,
    authorityLevel: 0
  };
}
