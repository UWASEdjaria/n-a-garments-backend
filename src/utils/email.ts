import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendPasswordResetEmail = async (to: string, name: string, resetUrl: string): Promise<void> => {
  await transporter.sendMail({
    from: `"N&A Tailors" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Reset Your Password — N&A Tailors',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello, ${name}</h2>
        <p>You requested a password reset for your N&A Tailors account.</p>
        <p>Click the button below to reset your password. This link expires in <strong>30 minutes</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block; padding:12px 24px; background:#000; color:#fff; text-decoration:none; border-radius:4px; margin:16px 0;">
          Reset Password
        </a>
        <p>If you did not request this, ignore this email — your password will remain unchanged.</p>
        <p>— N&A Tailors Team</p>
      </div>
    `,
  });
};
