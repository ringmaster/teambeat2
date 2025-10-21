export function emailVerificationTemplate(verifyUrl: string, userName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #39495C;">Welcome to TeamBeat, ${userName}!</h1>
      <p>Thank you for registering. Please verify your email address to start creating boards and collaborating with your team.</p>
      <p style="margin: 30px 0;">
        <a href="${verifyUrl}" style="background-color: #39495C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Verify Email Address
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        Or copy and paste this link into your browser:<br>
        <a href="${verifyUrl}" style="color: #39495C;">${verifyUrl}</a>
      </p>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        This link expires in 24 hours. If you didn't create a TeamBeat account, you can safely ignore this email.
      </p>
    </body>
    </html>
  `;
}

export function passwordResetTemplate(resetUrl: string, userName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #39495C;">Password Reset Request</h1>
      <p>Hi ${userName},</p>
      <p>We received a request to reset your TeamBeat password. Click the button below to create a new password:</p>
      <p style="margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #39495C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        Or copy and paste this link into your browser:<br>
        <a href="${resetUrl}" style="color: #39495C;">${resetUrl}</a>
      </p>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
    </body>
    </html>
  `;
}
