 ### Register
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "email": "eso-test@example.com",
  "password": "StrongPassword123!",
  "fullName": "Test ESO Org"
}

### Verify (token from dev-mode console log)
GET {{baseUrl}}/auth/verify-email?token=PASTE_TOKEN

### Login — should return accessToken/refreshToken directly, no MFA involved
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "eso-test@example.com",
  "password": "StrongPassword123!"
}

### Sysadmin provisions a reviewer

POST {{baseUrl}}/internal/users
Authorization: Bearer PASTE_SYSADMIN_ACCESS_TOKEN
Content-Type: application/json

{
  "email": "reviewer@idice.eso.wootlab.ng",
  "password": "ReviewerPass123!",
  "fullName": "Test Reviewer",
  "role": "ROLE_ELIGIBILITY_REVIEWER"
}

### Verify that account's email too (own token from console log)
GET {{baseUrl}}/auth/verify-email?token=PASTE_REVIEWER_TOKEN

### First login attempt — expect { mfaSetupRequired: true, setupToken: "..." }, NOT a session
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "reviewer@idice.eso.wootlab.ng",
  "password": "ReviewerPass123!"
}


### Generate the QR/secret
POST {{baseUrl}}/auth/mfa/setup
Content-Type: application/json

{
  "setupToken": "PASTE_SETUP_TOKEN"
}

### Enable MFA with that code
POST {{baseUrl}}/auth/mfa/enable
Content-Type: application/json

{
  "setupToken": "PASTE_SETUP_TOKEN",
  "code": "PASTE_TOTP_CODE"
}

### Try to login again

POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "reviewer@idice.eso.wootlab.ng",
  "password": "ReviewerPass123!"
}


### MFA verify
POST {{baseUrl}}/auth/mfa/verify
Content-Type: application/json

{
  "mfaToken": "PASTE_MFA_TOKEN",
  "code": "PASTE_FRESH_TOTP_CODE"
}


### MFA verify with Backup CODE
POST {{baseUrl}}/auth/mfa/verify
Content-Type: application/json

{
  "mfaToken": "PASTE_MFA_TOKEN",
  "code": "PASTE_BACKUP_CODE"
}

### generate new backup code

POST {{baseUrl}}/auth/mfa/backup-codes/regenerate
Authorization: Bearer PASTE_REVIEWER_ACCESS_TOKEN

### Wrong password — should be rejected

POST {{baseUrl}}/auth/mfa/disable
Authorization: Bearer PASTE_REVIEWER_ACCESS_TOKEN
Content-Type: application/json

{ "password": "WrongPassword!" }

### Correct password — should succeed

POST {{baseUrl}}/auth/mfa/disable
Authorization: Bearer PASTE_REVIEWER_ACCESS_TOKEN
Content-Type: application/json

{ "password": "ReviewerPass123!" }


### Request reset — same response whether email exists or not

POST {{baseUrl}}/auth/forgot-password
Content-Type: application/json

{ "email": "eso-test@example.com" }

### Also try a nonexistent email — response should look identical

POST {{baseUrl}}/auth/forgot-password
Content-Type: application/json

{ "email": "doesnotexist@example.com" }


### Reset with it

POST {{baseUrl}}/auth/reset-password
Content-Type: application/json

{
  "token": "PASTE_RESET_TOKEN",
  "newPassword": "NewStrongPassword456!"
}

### Old refresh token from before the reset should now be dead
POST {{baseUrl}}/auth/refresh
Content-Type: application/json

{ "refreshToken": "PASTE_OLD_REFRESH_TOKEN" }


POST {{baseUrl}}/auth/change-password
Authorization: Bearer PASTE_ACCESS_TOKEN
Content-Type: application/json

{
  "currentPassword": "NewStrongPassword456!",
  "newPassword": "AnotherPassword789!"
}


### Fire this 5-6 times in a row with a wrong password
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "eso-test@example.com",
  "password": "WrongPassword"
}

### Reviewer token trying a sysadmin-only route — expect 403
POST {{baseUrl}}/internal/users
Authorization: Bearer PASTE_REVIEWER_ACCESS_TOKEN
Content-Type: application/json

{ "email": "x@example.com", "password": "Pass1234!", "fullName": "X", "role": "ROLE_VALIDATOR" }