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

export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  resetUrl: string
): Promise<void> => {
  try {
    await transporter.sendMail({
      from:
        process.env.EMAIL_FROM ||
        `"na-garments" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Reset Your Password — na-garments',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello, ${name}</h2>
          <p>You requested a password reset for your na-garments account.</p>
          <p>
            Click the button below to reset your password.
            This link expires in <strong>30 minutes</strong>.
          </p>

          <a
            href="${resetUrl}"
            style="display:inline-block; padding:12px 24px; background:#000; color:#fff; text-decoration:none; border-radius:4px; margin:16px 0;"
          >
            Reset Password
          </a>

          <p>
            If you did not request this, ignore this email —
            your password will remain unchanged.
          </p>

          <p>— na-garments Team</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Could not send password reset email.');
  }
};

export const sendCustomOrderEmail = async (
  name: string,
  email: string,
  phone: string,
  garmentType: string,
  quantity: number,
  measurements: string | undefined,
  description: string,
  additionalReqs: string | undefined,
  referenceImageUrls: string[]
): Promise<void> => {
  try {
    await transporter.sendMail({
      from:
        process.env.EMAIL_FROM ||
        `"N&A Garments" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `New Custom Order Request — ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #111111;">
          <div style="background: #123B5D; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">
              N&A Garments
            </h1>

            <p style="color: #ffffff; margin: 8px 0 0;">
              New Custom Order Request
            </p>
          </div>

          <div style="padding: 24px;">
            <h2 style="color: #123B5D;">
              Customer Details
            </h2>

            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>

            <h2 style="color: #123B5D; margin-top: 24px;">
              Order Details
            </h2>

            <p><strong>Garment Type:</strong> ${garmentType}</p>
            <p><strong>Quantity:</strong> ${quantity}</p>

            <p>
              <strong>Measurements:</strong>
              ${measurements || 'Not provided'}
            </p>

            <p>
              <strong>Description:</strong><br />
              ${description}
            </p>

            <p>
              <strong>Additional Requirements:</strong><br />
              ${additionalReqs || 'None provided'}
            </p>

            ${
        referenceImageUrls.length > 0
    ? `
      <h2 style="color: #123B5D; margin-top: 24px;">
        Reference / Inspiration Images
      </h2>

      ${referenceImageUrls
        .map(
          (url, index) => `
            <p>
              <strong>Image ${index + 1}:</strong>
              <a
                href="${url}"
                target="_blank"
                style="color: #123B5D;"
              >
                View Image
              </a>
            </p>
           `
             )
          .join('')}
          `
          : `
         <p style="margin-top: 24px;">
        <strong>Reference / Inspiration Images:</strong>
        None provided
       </p>
      `
       }

            <div
              style="margin-top: 24px; padding: 16px; background: #EEF3F6; border-left: 4px solid #F28C28;"
            >
              <p style="margin: 0;">
                Please review this request and contact the customer with a quote.
              </p>
            </div>
          </div>

          <div style="padding: 16px; text-align: center; color: #666666;">
            <p>— N&A Garments Team</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send custom order email:', error);
    throw new Error('Could not send custom order email.');
  }
};