// --- SHARED CONSTANTS & STYLES ---
const currentYear = new Date().getFullYear();

// Brand Colors
const colors = {
  primary: '#18cb96', // Amanox Mint
  secondary: '#373643', // Amanox Charcoal
  bg: '#f8fafc', // Light background
  white: '#ffffff',
  lightMint: '#e8fcf6', // For OTP background
  error: '#ef4444',
};

// Logo URL (Dynamic based on environment)
const logoUrl = `${process.env.SERVER_URL}/images/amanox-logo.png`;

// Shared CSS Styles
const baseStyles = `
  body { background-color: ${colors.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  .container { max-width: 480px; background: ${colors.white}; margin: 40px auto; border-radius: 24px; padding: 0; overflow: hidden; box-shadow: 0 10px 40px rgba(55, 54, 67, 0.08); }
  .accent-bar { width: 100%; height: 6px; background: linear-gradient(90deg, ${colors.primary} 0%, ${colors.secondary} 100%); }
  .header { text-align: center; padding: 40px 0 10px; }
  .logo-img { display: block; margin: 0 auto; max-width: 160px; height: auto; border: 0; outline: none; text-decoration: none; }
  .content { padding: 20px 40px 40px; text-align: center; }
  .title { font-size: 24px; font-weight: 700; color: ${colors.secondary}; margin-bottom: 8px; letter-spacing: -0.5px; }
  .text { color: #6b7280; font-size: 15px; line-height: 1.6; margin-bottom: 20px; }
  .footer { text-align: center; padding: 20px; background: #f9fafb; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 12px; }
  .link { color: ${colors.primary}; text-decoration: none; font-weight: 600; }
  .link-muted { color: #9ca3af; text-decoration: underline; }
`;

// --- TEMPLATE 1: OTP VERIFICATION ---
export function getOtpHtml({ email, otp }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Verify your identity</title>
<style>
  ${baseStyles}
  .user-email { font-weight: 600; color: ${colors.secondary}; }
  .otp-box { background: ${colors.lightMint}; color: ${colors.secondary}; font-size: 32px; letter-spacing: 8px; font-weight: 700; padding: 20px; border-radius: 16px; border: 1px dashed ${colors.primary}; text-align: center; display: inline-block; margin: 10px 0 30px; width: 80%; max-width: 250px; }
</style>
</head>
<body>
<div class="container">
  <div class="accent-bar"></div>
  <div class="header">
    <img src="${logoUrl}" alt="Amanox" class="logo-img" />
  </div>
  <div class="content">
    <h1 class="title">Verify Your Identity</h1>
    <p class="text">Please use the following code to complete your login for <span class="user-email">${email}</span>.</p>
    <div class="otp-box">${otp}</div>
    <p class="text" style="font-size: 13px; margin-bottom: 0;">This code expires in 5 minutes. If you didn't request this, please ignore this email.</p>
  </div>
  <div class="footer">
    <p>© ${currentYear} Amanox AI. All rights reserved.</p>
    <p>Need help? <a href="#" class="link">Contact Support</a></p>
  </div>
</div>
</body>
</html>`;
}

// --- TEMPLATE 2: RESET PASSWORD ---
export function getResetPasswordHtml({ name = 'User', resetLink }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Reset Password</title>
<style>
  ${baseStyles}
  .btn { background: ${colors.primary}; color: ${colors.white}; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 700; display: inline-block; margin: 20px 0; box-shadow: 0 4px 14px rgba(24, 203, 150, 0.4); transition: transform 0.2s; }
  .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(24, 203, 150, 0.6); }
  .divider { border-top: 1px solid #e5e7eb; margin: 30px 0 20px; }
  .break-link { word-break: break-all; color: ${colors.primary}; font-size: 12px; }
</style>
</head>
<body>
<div class="container">
  <div class="accent-bar"></div>
  <div class="header">
    <img src="${logoUrl}" alt="Amanox" class="logo-img" />
  </div>
  <div class="content">
    <h1 class="title">Reset Your Password</h1>
    <p class="text">Hello <strong>${name}</strong>,<br/>We received a request to reset the password for your Amanox account.</p>
    
    <!-- Big Action Button -->
    <a href="${resetLink}" class="btn">Reset Password</a>

    <p class="text" style="font-size: 13px;">This link is valid for <strong>1 hour</strong>.</p>
    <p class="text" style="font-size: 13px; color: #9ca3af;">If you didn't request a password reset, you can safely ignore this email.</p>

    <!-- Fallback Link -->
    <div class="divider"></div>
    <p class="text" style="font-size: 12px; color: #9ca3af; margin-bottom: 8px;">Button not working? Copy and paste this link:</p>
    <a href="${resetLink}" class="break-link">${resetLink}</a>
  </div>
  <div class="footer">
    <p>© ${currentYear} Amanox AI. All rights reserved.</p>
  </div>
</div>
</body>
</html>`;
}
