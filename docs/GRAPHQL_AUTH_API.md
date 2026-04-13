# GraphQL Authentication API Specification

## Overview

This document provides a complete specification for the GraphQL authentication endpoints in the CNC Backend API. The authentication system supports user registration, login, password reset, OAuth integration, and role management.

---

## Table of Contents

1. [Authentication Mechanisms](#authentication-mechanisms)
2. [Type Definitions](#type-definitions)
3. [Mutations](#mutations)
4. [Queries](#queries)
5. [Error Handling](#error-handling)
6. [Security Considerations](#security-considerations)

---

## Authentication Mechanisms

### JWT (JSON Web Tokens)

- **Type**: Bearer token-based authentication
- **Token Generation**: Tokens are generated on successful registration and login
- **Token Payload**: Contains user ID (`sub`), email, and role
- **Usage**: Include in the `Authorization` header as `Bearer <token>`
- **Required for**: Protected endpoints marked with `@UseGuards(JwtAuthGuard)`

### OAuth Integration

- **Provider**: Google OAuth
- **Flow**: Allows users to sign in with Google credentials
- **Role Selection**: New OAuth users must complete role initialization

---

## Type Definitions

### Profile Types

The system includes three profile types that are created alongside user registration:

#### TherapistProfile
```graphql
type TherapistProfile {
  userId: String!
  specialization: String
  licenseNumber: String
  bio: String
  clinicName: String
  interventionThreshold: Float
}
```

#### GuardianProfile
```graphql
type GuardianProfile {
  userId: String!
  relationship: String
  phoneNumber: String
  emergencyContactInfo: String
  notificationPreferences: String
}
```

#### ChildProfile
```graphql
type ChildProfile {
  userId: String!
  therapistId: String!
  guardianId: String
  dateOfBirth: Date
  interests: [String!]
  triggers: [String!]
  behavioralGoals: String
  gamificationData: String
  progressStats: String
}
```

### User

Complete user object including profile information.

```graphql
type User {
  id: String!
  email: String!
  role: String
  firstName: String
  lastName: String
  displayName: String
  avatarUrl: String
  timezone: String
  locale: String
  lastLoginAt: Date
  createdAt: Date!
  updatedAt: Date!
  deletedAt: Date
  therapistProfile: TherapistProfile
  guardianProfile: GuardianProfile
  childProfile: ChildProfile
}
```

### UserAuth

Represents authenticated user information (password hash excluded).

```graphql
type UserAuth {
  id: String!
  email: String!
  role: String
  firstName: String
  lastName: String
  displayName: String
  avatarUrl: String
}
```

**Fields:**
- `id` (String): Unique user identifier
- `email` (String): User's email address
- `role` (String, optional): User role (GUARDIAN, CHILD, THERAPIST, ADMIN)
- `firstName` (String, optional): User's first name
- `lastName` (String, optional): User's last name
- `displayName` (String, optional): User's display name
- `avatarUrl` (String, optional): User's avatar URL

---

### AuthResponse

Response object returned by registration and login endpoints.

```graphql
type AuthResponse {
  access_token: String!
  user: UserAuth
}
```

**Fields:**
- `access_token` (String): JWT token for authentication
- `user` (UserAuth, optional): Authenticated user details

---

### VerifyResponse

Response object for token verification.

```graphql
type VerifyResponse {
  valid: Boolean!
  user: UserAuth!
}
```

**Fields:**
- `valid` (Boolean): Whether the token is valid
- `user` (UserAuth): Current user details

---

### PasswordResetResponse

Response object for password reset operations.

```graphql
type PasswordResetResponse {
  message: String!
  success: Boolean!
}
```

**Fields:**
- `message` (String): Human-readable message about the operation
- `success` (Boolean): Whether the operation was successful

---

### ValidateResetTokenResponse

Response object for reset token validation.

```graphql
type ValidateResetTokenResponse {
  valid: Boolean!
  message: String
}
```

**Fields:**
- `valid` (Boolean): Whether the reset token is valid
- `message` (String, optional): Additional message

---

## Mutations

### register

Creates a new user account with email and password. Automatically creates the associated Guardian or Child profile.

**Signature:**
```graphql
mutation register($registerInput: RegisterInput!): AuthResponse!
```

**Input:**
```graphql
input RegisterInput {
  email: String!
  password: String!
  role: String!
  firstName: String
  lastName: String
  therapistEmail: String  # Required for CHILD role
}
```

**Input Fields:**
- `email` (String): User's email address (must be valid and unique)
- `password` (String): Password (minimum 6 characters)
- `role` (String): User role - must be `GUARDIAN` or `CHILD`
- `firstName` (String, optional): User's first name
- `lastName` (String, optional): User's last name
- `therapistEmail` (String, required for CHILD): Email of the therapist to assign to the child profile. Must be a valid therapist account.

**Output:**
- Returns `AuthResponse` with JWT token and user information (includes profile details)

**Profile Creation:**
- **For GUARDIAN role**: Creates an empty `GuardianProfile` automatically
- **For CHILD role**: Creates a `ChildProfile` linked to the specified therapist

**Example Request - Guardian Registration:**
```graphql
mutation {
  register(registerInput: {
    email: "guardian@example.com"
    password: "securePassword123"
    role: "GUARDIAN"
    firstName: "John"
    lastName: "Doe"
  }) {
    access_token
    user {
      id
      email
      role
      firstName
      lastName
      guardianProfile {
        userId
        relationship
      }
    }
  }
}
```

**Example Request - Child Registration:**
```graphql
mutation {
  register(registerInput: {
    email: "child@example.com"
    password: "securePassword123"
    role: "CHILD"
    firstName: "Jane"
    lastName: "Doe"
    therapistEmail: "therapist@example.com"
  }) {
    access_token
    user {
      id
      email
      role
      firstName
      lastName
      childProfile {
        userId
        therapistId
      }
    }
  }
}
```

**Possible Errors:**
- `CONFLICT`: Email already registered
- `UNAUTHORIZED`: Role is THERAPIST or ADMIN (not allowed via registration)
- `BAD_REQUEST`: Invalid input validation or therapistEmail not a valid email for CHILD role
- `NOT_FOUND`: Therapist with provided therapistEmail not found
- `BAD_REQUEST`: User with therapistEmail is not a therapist

---

### login

Authenticates a user with email and password.

**Signature:**
```graphql
mutation login($loginInput: LoginInput!): AuthResponse!
```

**Input:**
```graphql
input LoginInput {
  email: String!
  password: String!
}
```

**Input Fields:**
- `email` (String): User's email address
- `password` (String): User's password

**Output:**
- Returns `AuthResponse` with JWT token and user information

**Example Request:**
```graphql
mutation {
  login(loginInput: {
    email: "user@example.com"
    password: "securePassword123"
  }) {
    access_token
    user {
      id
      email
      role
    }
  }
}
```

**Possible Errors:**
- `UNAUTHORIZED`: Invalid credentials
- `UNAUTHORIZED`: Account deactivated
- `UNAUTHORIZED`: No password set (account registered via OAuth)

---

### setOAuthRole

Sets the role for an OAuth user after initial signup. **Protected endpoint - requires JWT token.**

**Signature:**
```graphql
mutation setOAuthRole($setRoleInput: SetRoleInput!): UserAuth!
```

**Input:**
```graphql
input SetRoleInput {
  role: String!
}
```

**Input Fields:**
- `role` (String): User role - must be `GUARDIAN` or `CHILD`

**Output:**
- Returns `UserAuth` object with updated user information

**Example Request:**
```graphql
mutation {
  setOAuthRole(setRoleInput: { role: "GUARDIAN" }) {
    id
    email
    role
  }
}
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Possible Errors:**
- `UNAUTHORIZED`: Invalid or missing token
- `UNAUTHORIZED`: Role is THERAPIST or ADMIN (not allowed)
- `NOT_FOUND`: User not found

---

### requestPasswordReset

Initiates a password reset by sending a reset email to the user.

**Signature:**
```graphql
mutation requestPasswordReset($requestInput: RequestPasswordResetInput!): PasswordResetResponse!
```

**Input:**
```graphql
input RequestPasswordResetInput {
  email: String!
}
```

**Input Fields:**
- `email` (String): Email address associated with the account

**Output:**
- Returns `PasswordResetResponse` with success message

**Example Request:**
```graphql
mutation {
  requestPasswordReset(requestInput: {
    email: "user@example.com"
  }) {
    success
    message
  }
}
```

**Response Example:**
```graphql
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Security Note:**
The endpoint returns the same message whether or not the email exists (preventing email enumeration attacks).

---

### validateResetToken

Validates a password reset token without consuming it.

**Signature:**
```graphql
mutation validateResetToken($validateInput: ValidateResetTokenInput!): ValidateResetTokenResponse!
```

**Input:**
```graphql
input ValidateResetTokenInput {
  token: String!
}
```

**Input Fields:**
- `token` (String): The password reset token to validate

**Output:**
- Returns `ValidateResetTokenResponse` with validity status

**Example Request:**
```graphql
mutation {
  validateResetToken(validateInput: {
    token: "reset_token_here"
  }) {
    valid
    message
  }
}
```

**Possible Errors:**
- `BAD_REQUEST`: Invalid or expired token

---

### resetPassword

Resets the user's password with a valid reset token.

**Signature:**
```graphql
mutation resetPassword($resetInput: ResetPasswordInput!): PasswordResetResponse!
```

**Input:**
```graphql
input ResetPasswordInput {
  token: String!
  password: String!
}
```

**Input Fields:**
- `token` (String): The password reset token from the reset email
- `password` (String): New password (minimum 8 characters)

**Output:**
- Returns `PasswordResetResponse` with success message

**Example Request:**
```graphql
mutation {
  resetPassword(resetInput: {
    token: "reset_token_here"
    password: "newSecurePassword123"
  }) {
    success
    message
  }
}
```

**Possible Errors:**
- `BAD_REQUEST`: Password less than 8 characters
- `BAD_REQUEST`: Invalid or expired reset token
- `NOT_FOUND`: User not found

---

## Queries

### profile

Retrieves the current authenticated user's profile information. **Protected endpoint - requires JWT token.**

**Signature:**
```graphql
query profile: UserAuth!
```

**Output:**
- Returns `UserAuth` object with current user's details

**Example Request:**
```graphql
query {
  profile {
    id
    email
    role
    firstName
    lastName
    displayName
    avatarUrl
  }
}
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Possible Errors:**
- `UNAUTHORIZED`: Invalid or missing token
- `NOT_FOUND`: User not found

---

### verifyToken

Verifies that the current JWT token is valid and returns the associated user. **Protected endpoint - requires JWT token.**

**Signature:**
```graphql
query verifyToken: VerifyResponse!
```

**Output:**
- Returns `VerifyResponse` with validation status and user details

**Example Request:**
```graphql
query {
  verifyToken {
    valid
    user {
      id
      email
      role
    }
  }
}
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Possible Errors:**
- `UNAUTHORIZED`: Invalid or missing token

---

## Error Handling

### Error Response Format

GraphQL errors are returned in the standard GraphQL format:

```json
{
  "errors": [
    {
      "message": "Error description",
      "extensions": {
        "code": "ERROR_CODE"
      }
    }
  ]
}
```

### Common HTTP Status Codes

- `200 OK`: Successful query/mutation
- `400 Bad Request`: Invalid input validation
- `401 Unauthorized`: Authentication failed or token invalid
- `409 Conflict`: Resource already exists
- `500 Internal Server Error`: Server error

### Common Error Messages

| Error Type | Message | Cause |
|-----------|---------|-------|
| CONFLICT | User with email already exists | Email already registered |
| UNAUTHORIZED | Invalid credentials | Wrong password or non-existent user |
| UNAUTHORIZED | This account has been deactivated | User account deleted |
| UNAUTHORIZED | This email is already registered with a password | OAuth user attempting password login |
| UNAUTHORIZED | This email is already registered via Google | Password user attempting OAuth login |
| BAD_REQUEST | Password must be at least 8 characters long | Password too short |
| BAD_REQUEST | Invalid or expired reset token | Reset token invalid or expired |
| NOT_FOUND | User not found | User doesn't exist |

---

## Security Considerations

### Token Management

1. **JWT Expiration**: Tokens should have an expiration time set via configuration
2. **Token Storage**: Store tokens securely on the client (avoid localStorage for sensitive apps)
3. **Token Transmission**: Always transmit over HTTPS in the Authorization header

### Password Security

1. **Password Hashing**: Passwords are hashed using bcrypt before storage
2. **Minimum Length**: Passwords must be at least 8 characters (login: 6 characters)
3. **Reset Token Expiration**: Reset tokens expire after 1 hour
4. **Reset Token Strength**: Tokens are generated using cryptographically secure random bytes

### Authentication Guards

1. **JwtAuthGuard**: Validates JWT tokens for protected endpoints
2. **LocalAuthGuard**: Validates email/password for login
3. **GoogleAuthGuard**: Handles Google OAuth authentication

### Best Practices

1. **Rate Limiting**: Consider implementing rate limiting on auth endpoints
2. **Email Verification**: Consider implementing email verification for new registrations
3. **Account Lockout**: Consider implementing account lockout after failed login attempts
4. **Audit Logging**: Log all authentication events for security monitoring
5. **HTTPS Only**: Always use HTTPS in production
6. **CORS Configuration**: Configure CORS properly to restrict cross-origin requests

---

## Implementation Notes

### JWT Configuration

The JWT service should be configured with:
- Secret key (from environment variable `JWT_SECRET`)
- Token expiration time
- Algorithm (typically HS256)

### Password Reset Flow

1. User requests password reset with email
2. System generates cryptographically secure reset token
3. Reset link sent to user's email with token
4. User clicks link and provides new password
5. System validates token, checks expiration, and updates password

### OAuth Integration

1. User initiates Google sign-in
2. OAuth provider authenticates user
3. System validates OAuth profile
4. If new user, account is created without password
5. User must set role via `setOAuthRole` mutation

---

## Sample Complete Workflow

### Registration and Login Flow

```graphql
# 1. Register new user
mutation {
  register(registerInput: {
    email: "john@example.com"
    password: "securePass123"
    role: "GUARDIAN"
    firstName: "John"
  }) {
    access_token
    user {
      id
      email
      role
    }
  }
}

# 2. Later, login with email/password
mutation {
  login(loginInput: {
    email: "john@example.com"
    password: "securePass123"
  }) {
    access_token
    user {
      id
      email
      role
    }
  }
}

# 3. Get profile (with token)
query {
  profile {
    id
    email
    firstName
    role
  }
}

# 4. Verify token is still valid
query {
  verifyToken {
    valid
    user {
      email
    }
  }
}
```

### Password Reset Flow

```graphql
# 1. Request password reset
mutation {
  requestPasswordReset(requestInput: {
    email: "john@example.com"
  }) {
    success
    message
  }
}

# 2. Validate reset token (after user clicks email link)
mutation {
  validateResetToken(validateInput: {
    token: "token_from_email"
  }) {
    valid
    message
  }
}

# 3. Reset password with token
mutation {
  resetPassword(resetInput: {
    token: "token_from_email"
    password: "newSecurePass456"
  }) {
    success
    message
  }
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-21 | Initial API specification |

---

## References

- JWT (JSON Web Tokens): https://jwt.io/
- GraphQL: https://graphql.org/
- NestJS GraphQL Module: https://docs.nestjs.com/graphql/quick-start
- Bcrypt: https://www.npmjs.com/package/bcrypt
