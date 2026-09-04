import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || 'aw.waqarporfolio11@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'hdwn qvxy ctud rqcu';
const CONTACT_RECEIVER = process.env.CONTACT_RECEIVER_EMAIL || 'aw.waqarporfolio11@gmail.com';

/**
 * Creates and returns a reusable Nodemailer transporter.
 */
export function getMailTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    // Useful timeouts to prevent hanging serverless routes
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

export interface ContactMailData {
  name: string;
  email: string;
  subject?: string;
  message: string;
  phone?: string;
  accountEmail?: string;
  userRole?: string;
  businessType?: string;
}

/**
 * Sends a Contact Us inquiry to the business administrator.
 */
export async function sendContactEmail(data: ContactMailData) {
  const transporter = getMailTransporter();
  const subjectLine = data.subject?.trim() || `New Contact Message from ${data.name}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.025em; }
          .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 14px; }
          .content { padding: 28px 24px; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: #e0e7ff; color: #4338ca; margin-bottom: 16px; }
          .details-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .details-table td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
          .details-table td.label { font-weight: 600; color: #64748b; width: 35%; background: #f8fafc; }
          .details-table td.val { color: #0f172a; font-weight: 500; }
          .message-box { background: #f8fafc; border-left: 4px solid #6366f1; padding: 16px 20px; border-radius: 8px; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap; margin-top: 12px; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MindVault Support & Contact</h1>
            <p>You received a new inquiry from your web application</p>
          </div>
          <div class="content">
            <span class="badge">Inquiry Details</span>
            <table class="details-table">
              <tr>
                <td class="label">Sender Name</td>
                <td class="val"><strong>${data.name}</strong></td>
              </tr>
              <tr>
                <td class="label">Email Address</td>
                <td class="val"><a href="mailto:${data.email}" style="color: #4f46e5; text-decoration: none;">${data.email}</a></td>
              </tr>
              ${data.phone ? `
              <tr>
                <td class="label">Phone / WhatsApp</td>
                <td class="val">${data.phone}</td>
              </tr>` : ''}
              ${data.accountEmail && data.accountEmail !== data.email ? `
              <tr>
                <td class="label">Account Email</td>
                <td class="val">${data.accountEmail}</td>
              </tr>` : ''}
              ${data.userRole ? `
              <tr>
                <td class="label">Role</td>
                <td class="val">${data.userRole}</td>
              </tr>` : ''}
              ${data.businessType ? `
              <tr>
                <td class="label">Business Type</td>
                <td class="val">${data.businessType}</td>
              </tr>` : ''}
              <tr>
                <td class="label">Subject</td>
                <td class="val">${subjectLine}</td>
              </tr>
            </table>

            <div style="font-weight: 600; font-size: 14px; color: #1e293b; margin-top: 18px;">Message:</div>
            <div class="message-box">${data.message}</div>
          </div>
          <div class="footer">
            Sent automatically via MindVault App &bull; SMTP: ${SMTP_HOST}
          </div>
        </div>
      </body>
    </html>
  `;

  const info = await transporter.sendMail({
    from: `"MindVault Contact" <${SMTP_USER}>`,
    to: CONTACT_RECEIVER,
    replyTo: data.email,
    subject: `[MindVault Inquiry] ${subjectLine}`,
    text: `From: ${data.name} (${data.email})\nPhone: ${data.phone || 'N/A'}\nSubject: ${subjectLine}\n\nMessage:\n${data.message}`,
    html: htmlContent,
  });

  return info;
}

/**
 * Optional: Send a polite automated confirmation receipt to the user.
 */
export async function sendContactAcknowledgment(data: { name: string; email: string; subject?: string }) {
  const transporter = getMailTransporter();

  const acknowledgmentHtml = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; padding: 32px 24px;">
          <h2 style="color: #4338ca; margin-top: 0; font-size: 20px;">Thank you for contacting MindVault!</h2>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">
            Hello <strong>${data.name}</strong>,<br/><br/>
            We have received your message regarding: <em>"${data.subject || 'Your Inquiry'}"</em>.
          </p>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">
            Our support team has been notified and will review your request shortly. If urgent, we will reply directly to this email address.
          </p>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">
            MindVault &bull; All-in-one Business, ERP & Financial Suite
          </p>
        </div>
      </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"MindVault Support" <${SMTP_USER}>`,
      to: data.email,
      subject: `We received your message: ${data.subject || 'Inquiry Received'}`,
      html: acknowledgmentHtml,
    });
  } catch (err) {
    // Acknowledgment failure shouldn't fail the primary contact send
    console.warn('Failed to send auto-acknowledgment to sender:', err);
  }
}
