const nodemailer = require('nodemailer');
const prompt = require('prompt-sync')({sigint: true});

async function main() {
  console.log('--- Resend SMTP Debugger ---');
  const apiKey = prompt('Enter your Resend API Key: ');
  const senderEmail = prompt('Enter your Sender Email (e.g. hello@yourdomain.com): ');
  const recipientEmail = prompt('Enter an Email to receive the test: ');

  if (!apiKey || !senderEmail || !recipientEmail) {
      console.error('All fields are required.');
      return;
  }

  console.log('\nConnecting to smtp.resend.com...');

  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: apiKey.trim()
    }
  });

  try {
    const info = await transporter.sendMail({
      from: senderEmail.trim(),
      to: recipientEmail.trim(),
      subject: 'ISIT Game - Test SMTP Connection',
      text: 'If you are reading this, your Resend API key and Sender Domain are working perfectly!',
    });
    console.log('\n✅ SUCCESS! Message sent.');
    console.log('Message ID: %s', info.messageId);
    console.log('\nIf this worked, but Supabase didn\'t, the issue is a typo in the Supabase Dashboard settings.');
  } catch (error) {
    console.error('\n❌ ERROR FAILED TO SEND:');
    if (error.responseCode === 554) {
        console.error('Reason: Your sender domain is not verified in Resend, or the API key does not have permission for that domain. Note: Resend requires a custom domain, you cannot use a @gmail.com or @yahoo.com address as the sender.');
    } else if (error.responseCode === 535) {
        console.error('Reason: Authentication Failed. Your API key might be invalid or copied incorrectly.');
    } else {
        console.error(error);
    }
  }
}

main();
