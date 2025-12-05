export function getOtpHtml({ email, otp }) {
  const currentYear = new Date().getFullYear();

  // IMAGE SETUP:
  // 1. Paste 'amanox-logo.png' into your backend's 'public' folder.
  // 2. Ensure your backend serves static files: app.use(express.static('public'));
  // 3. This URL dynamically finds the image based on your server configuration.
  const logoUrl = `${process.env.SERVER_URL}/images/amanox-logo.png`;

  // Brand Colors
  const colors = {
    primary: '#18cb96', // Amanox Mint
    secondary: '#373643', // Amanox Charcoal
    bg: '#f8fafc', // Light background
    white: '#ffffff',
    lightMint: '#e8fcf6', // For OTP background
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Verify your identity</title>
<style>
  body {
    background-color: ${colors.bg};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }
  .container {
    max-width: 480px;
    background: ${colors.white};
    margin: 40px auto;
    border-radius: 24px;
    padding: 0;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(55, 54, 67, 0.08);
  }
  .accent-bar {
    width: 100%;
    height: 6px;
    background: linear-gradient(90deg, ${colors.primary} 0%, ${colors.secondary} 100%);
  }
  .header {
    text-align: center;
    padding: 40px 0 10px;
  }
  .logo-img {
    display: block;
    margin: 0 auto;
    max-width: 160px; /* Adjust based on your logo size */
    height: auto;
    border: 0;
    outline: none;
    text-decoration: none;
  }
  .content {
    padding: 20px 40px 40px;
    text-align: center;
  }
  .title {
    font-size: 24px;
    font-weight: 700;
    color: ${colors.secondary};
    margin-bottom: 8px;
    letter-spacing: -0.5px;
  }
  .text {
    color: #6b7280;
    font-size: 15px;
    line-height: 1.6;
    margin-bottom: 20px;
  }
  .user-email {
    font-weight: 600;
    color: ${colors.secondary};
  }
  .otp-box {
    background: ${colors.lightMint};
    color: ${colors.secondary};
    font-size: 32px;
    letter-spacing: 8px;
    font-weight: 700;
    padding: 20px;
    border-radius: 16px;
    border: 1px dashed ${colors.primary};
    text-align: center;
    display: inline-block;
    margin: 10px 0 30px;
    width: 80%;
    max-width: 250px;
  }
  .footer {
    text-align: center;
    padding: 20px;
    background: #f9fafb;
    border-top: 1px solid #f3f4f6;
    color: #9ca3af;
    font-size: 12px;
  }
  .link {
    color: ${colors.primary};
    text-decoration: none;
  }
</style>
</head>
<body>
<div class="container">
  <!-- Top Gradient Accent -->
  <div class="accent-bar"></div>

  <!-- Header with Image -->
  <div class="header">
    <!-- Make sure the logo URL is accessible publicly -->
    <img src="${logoUrl}" alt="Amanox" class="logo-img" />
  </div>

  <!-- Content -->
  <div class="content">
    <h1 class="title">Verify Your Identity</h1>
    <p class="text">
      Please use the following code to complete your login for <span class="user-email">${email}</span>.
    </p>

    <!-- OTP Box -->
    <div class="otp-box">${otp}</div>

    <p class="text" style="font-size: 13px; margin-bottom: 0;">
      This code expires in 5 minutes. If you didn't request this, please ignore this email.
    </p>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>© ${currentYear} Amanox. All rights reserved.</p>
    <p>
      Need help? <a href="https://www.amanox.in/contact-us" class="link">Contact Support</a>
    </p>
  </div>
</div>
</body>
</html>`;
}
