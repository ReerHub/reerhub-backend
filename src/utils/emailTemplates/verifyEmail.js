export function getVerifyEmailHtml({ email, token }) {
  const appName = process.env.APP_NAME || "Authentication App";
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const verifyUrl = `${baseUrl.replace(/\/+$/, "")}/token/${encodeURIComponent(
    token
  )}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${appName} - Verify Email</title>
<style>
  body {
    background: #f6f7fb;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
  .container {
    max-width: 600px;
    margin: 20px auto;
    padding: 24px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e9ecf3;
  }
  .title { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
  .text { color: #444; font-size: 15px; line-height: 1.6; }
  .btn {
    display: inline-block;
    background: #111827;
    padding: 12px 18px;
    border-radius: 8px;
    color: #fff !important;
    text-decoration: none;
    margin: 20px 0;
  }
  .link {
    font-size: 14px;
    color: #111827;
    text-decoration: underline;
    word-break: break-all;
  }
  .footer { text-align: center; margin-top: 24px; color: #6b7280; font-size: 12px; }
</style>
</head>
<body>
<div class="container">
  <h1 class="title">Verify your account - ${email}</h1>

  <p class="text">Click the button below to verify your account:</p>

  <a href="${verifyUrl}" target="_blank" class="btn">Verify Email</a>

  <p class="text">If the button doesn’t work, copy and paste this link:</p>

  <p class="link">${verifyUrl}</p>

  <p class="footer">© ${new Date().getFullYear()} ${appName}</p>
</div>
</body>
</html>`;
}
