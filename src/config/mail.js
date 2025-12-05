import nodemailer from 'nodemailer';

const { SMTP_USER, SMTP_PASSWORD } = process.env;

if (!SMTP_USER || !SMTP_PASSWORD) {
  console.error('❌ SMTP credentials missing (SMTP_USER / SMTP_PASSWORD)');
}

export const sendMail = async ({ to, subject, html }) => {
  if (!SMTP_USER || !SMTP_PASSWORD) return;

  const transporter = nodemailer.createTransport({
    host: 'smtp.zoho.in',
    port: 465,
    secure: true, // Zoho SMTP requires SSL on port 465
    auth: {
      user: SMTP_USER, // no-reply@amanox.in
      pass: SMTP_PASSWORD, // Zoho app password
    },
  });

  await transporter.sendMail({
    from: `"Amanox" <${SMTP_USER}>`,
    to,
    subject,
    html,
  });
};
