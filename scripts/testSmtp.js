require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

async function main() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: process.env.RESEND_API_KEY
    }
  });

  try {
    const info = await transporter.sendMail({
      from: 'your-verified-domain-email@example.com', // Replace this if needed
      to: 'your-email@example.com', // Replace with your receiving email
      subject: 'Test SMTP connection',
      text: 'This is a test from your local environment.',
    });
    console.log('Message sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

main();
