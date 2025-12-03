// src/utils/emailTemplates/resetPassword.js

export function getResetPasswordHtml({ name = 'User', resetLink }) {
  return `
    <div style="font-family: Arial, sans-serif; line-height:1.6;">
      <h2>Hello ${name},</h2>
      <p>You requested a password reset. Click the link below to set a new password. This link will expire in 1 hour.</p>
      <p><a href="${resetLink}" target="_blank">Reset your password</a></p>
      <p>If you did not request this, ignore this email.</p>
      <hr/>
      <p style="font-size:12px;color:#999">If the link doesn't open, copy and paste this URL into your browser:</p>
      <p style="font-size:12px;color:#999">${resetLink}</p>
    </div>
  `;
}
