import { NextRequest, NextResponse } from 'next/server';
import { sendContactEmail, sendContactAcknowledgment } from '@/lib/services/emailService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { name, email, subject, message, phone, accountEmail, userRole, businessType } = body;

    // Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Please provide a valid email address' }, { status: 400 });
    }

    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return NextResponse.json({ error: 'Message must be at least 5 characters long' }, { status: 400 });
    }

    // Send the email to the admin/support inbox
    await sendContactEmail({
      name: name.trim(),
      email: email.trim(),
      subject: subject?.trim(),
      message: message.trim(),
      phone: phone?.trim(),
      accountEmail: accountEmail?.trim(),
      userRole: userRole?.trim(),
      businessType: businessType?.trim(),
    });

    // Send automatic acknowledgment to user (fire and forget / non-blocking)
    sendContactAcknowledgment({
      name: name.trim(),
      email: email.trim(),
      subject: subject?.trim(),
    }).catch((err) => {
      console.warn('Acknowledgment email failed:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'Thank you! Your message has been sent successfully. Our support team will get back to you shortly.',
    });
  } catch (error: any) {
    console.error('Contact API Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to send message. Please try again later or contact us directly.',
      },
      { status: 500 }
    );
  }
}
