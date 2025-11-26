import nodemailer from "nodemailer";

const { SMTP_USER, SMTP_PASSWORD } = process.env;

if (!SMTP_USER || !SMTP_PASSWORD) {
  console.error("❌ SMTP credentials missing (SMTP_USER / SMTP_PASSWORD)");
}

export const sendMail = async ({ to, subject, html }) => {
  if (!SMTP_USER || !SMTP_PASSWORD) return;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: SMTP_USER,
    to,
    subject,
    html,
  });
};
