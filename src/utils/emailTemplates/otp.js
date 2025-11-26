export function getOtpHtml({ email, otp }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>OTP Verification</title>
<style>
  body {
    background: #f6f7fb;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    background: #fff;
    margin: 20px auto;
    border-radius: 12px;
    padding: 24px;
    border: 1px solid #e9ecf3;
  }
  .title { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
  .text { color: #444; font-size: 15px; line-height: 1.6; }
  .otp {
    font-size: 32px;
    letter-spacing: 6px;
    padding: 12px 18px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    text-align: center;
    display: inline-block;
    font-weight: 700;
    margin: 20px 0;
  }
  .footer {
    text-align: center;
    color: #6b7280;
    margin-top: 24px;
    font-size: 12px;
  }
</style>
</head>
<body>
<div class="container">
  <h1 class="title">Verify your email - ${email}</h1>
  <p class="text">
    Use the OTP below to complete your login.
  </p>

  <div class="otp">${otp}</div>

  <p class="text">This OTP expires in 5 minutes.</p>

  <p class="footer">© ${new Date().getFullYear()} Authentication App</p>
</div>
</body>
</html>`;
}
