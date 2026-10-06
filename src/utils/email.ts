import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendPasswordResetEmail = async (to: string, name: string, resetUrl: string): Promise<void> => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"na-garments" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Reset Your Password — na-garments',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello, ${name}</h2>
        <p>You requested a password reset for your na-garments account.</p>
        <p>Click the button below to reset your password. This link expires in <strong>30 minutes</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block; padding:12px 24px; background:#000; color:#fff; text-decoration:none; border-radius:4px; margin:16px 0;">
          Reset Password
        </a>
        <p>If you did not request this, ignore this email — your password will remain unchanged.</p>
        <p>— na-garments Team</p>
      </div>
    `,
  });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Could not send password reset email.');
  }
};
