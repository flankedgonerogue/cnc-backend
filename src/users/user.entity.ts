export interface User {
  id: string;
  email: string;
  passwordHash?: string; // Nullable for Google OAuth users
  role?: 'THERAPIST' | 'GUARDIAN' | 'CHILD';
  createdAt: Date;
  updatedAt: Date;
}
