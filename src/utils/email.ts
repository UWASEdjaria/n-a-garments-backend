import { Resend } from 'resend';

type EmailMessage = {
  from: string;
  to: string | string[] | undefined;
  subject: string;
  html: string;
  replyTo?: string;
};

const sendEmail = async (message: EmailMessage): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  const recipient = message.to;

  if (
    !recipient ||
    (Array.isArray(recipient) && recipient.length === 0)
  ) {
    throw new Error('Email recipient is not configured.');
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: message.from,
    to: recipient,
    subject: message.subject,
    html: message.html,
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
  });

  if (error) {
    console.error('Resend email send failed:', error.message);
    throw new Error('Email provider failed to send the message.');
  }
};

export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  resetUrl: string
): Promise<void> => {
  try {
    await sendEmail({
      from: process.env.EMAIL_FROM || 'nagarmentss <nagarmentss@nagarments.com>',
      to,
      subject: 'Reset Your Password — nagarments',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello, ${name}</h2>
          <p>You requested a password reset for your nagarments account.</p>
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

          <p>— nagarments Team</p>
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
    await sendEmail({
      from: process.env.EMAIL_FROM || 'nagarmentss <nagarmentss@nagarments.com>',
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `New Custom Order Request — ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #111111;">
          <div style="background: #123B5D; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">
              nagarments
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
            <p>— nagarments Team</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send custom order email:', error);
    throw new Error('Could not send custom order email.');
  }
};

export const sendVerificationEmail = async (
  to: string,
  name: string,
  verificationUrl: string
): Promise<void> => {
  
  try {
    await sendEmail({
      from: process.env.EMAIL_FROM || 'nagarmentss <nagarmentss@nagarments.com>',
      to,
      subject: 'Verify Your Email — Nagarmentss',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111111;">
          <div style="background: #123B5D; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">Nagarmentss</h1>
          </div>

          <div style="padding: 24px;">
            <h2>Hello, ${name}</h2>

            <p>Thank you for creating your Nagarmentss account.</p>
            <p>Please verify your email address by clicking the button below.</p>

            <a
              href="${verificationUrl}"
              style="display: inline-block; padding: 12px 24px; background: #123B5D; color: #ffffff; text-decoration: none; border-radius: 4px; margin: 16px 0;"
            >
              Verify Email
            </a>

            <p>This link expires in 30 minutes.</p>
            <p>If you did not create this account, you can ignore this email.</p>

            <p>Nagarmentss Team</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Could not send verification email.');
  }
};
