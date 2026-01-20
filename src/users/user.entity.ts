export interface User {
  id: string;
  email: string;
  passwordHash?: string; // Nullable for Google OAuth users
  role?: 'THERAPIST' | 'GUARDIAN' | 'CHILD';
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  timezone?: string;
  locale?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
