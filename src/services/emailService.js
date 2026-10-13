const nodemailer = require('nodemailer');

/**
 * Configure Nodemailer transport
 */
const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback to test/console transport for seamless local development
  return null;
};

/**
 * Send Employee Welcome Email with Login Credentials
 */
const sendEmployeeWelcomeEmail = async ({
  to,
  employeeName,
  employeeId,
  tempPassword,
  loginUrl = 'http://localhost:5173/login',
}) => {
  const fromAddress = process.env.EMAIL_FROM || '"Nexus HRMS Enterprise" <noreply@enterprisehrms.com>';

  const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Nexus HRMS</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
    .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
    .intro { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .credentials-card { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .cred-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .cred-row:last-child { border-bottom: none; }
    .cred-label { font-weight: 600; color: #64748b; }
    .cred-value { font-weight: 700; color: #0f172a; font-family: monospace; font-size: 15px; }
    .temp-password-badge { background: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 4px; font-family: monospace; font-weight: bold; }
    .cta-container { text-align: center; margin: 32px 0; }
    .cta-button { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
    .security-notice { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px; font-size: 13px; color: #92400e; line-height: 1.5; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nexus HRMS Enterprise</h1>
      <p>Official Employee Onboarding & Account Notification</p>
    </div>
    <div class="content">
      <div class="greeting">Welcome aboard, ${employeeName}!</div>
      <p class="intro">
        Your corporate HRMS profile has been successfully provisioned. You can now access your self-service portal to view attendance, apply for leaves, download payslips, and manage your assignments.
      </p>

      <div class="credentials-card">
        <div class="cred-row">
          <span class="cred-label">Employee ID:</span>
          <span class="cred-value">${employeeId}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Login Email:</span>
          <span class="cred-value">${to}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Temporary Password:</span>
          <span class="temp-password-badge">${tempPassword}</span>
        </div>
      </div>

      <div class="security-notice">
        <strong>⚠️ Mandatory Security Action:</strong>
        For security compliance, this temporary password must be changed immediately upon your first login. You will not be able to access the dashboard until you set your permanent password.
      </div>

      <div class="cta-container">
        <a href="${loginUrl}" class="cta-button" target="_blank">Login to Employee Portal</a>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
        If you experience any difficulties accessing your account, please reach out to your HR Operations desk or System Administrator.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Nexus HRMS Enterprise. All rights reserved.<br>
      This is an automated system notification. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
  `;

  try {
    const transporter = createTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject: `Welcome to Nexus HRMS — Your Account Credentials (${employeeId})`,
        html: htmlTemplate,
      });
      console.log(`[Email Service] Credentials email dispatched to ${to} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } else {
      // Local development/test log
      console.log(`
============================================================
📧 [EMAIL SERVICE - LOCAL SIMULATION]
------------------------------------------------------------
To: ${to}
Subject: Welcome to Nexus HRMS — Your Account Credentials (${employeeId})
Employee Name: ${employeeName}
Employee ID:   ${employeeId}
Login URL:     ${loginUrl}
Temporary Pwd: ${tempPassword}
Notice: First login password change is enforced!
============================================================
      `);
      return { success: true, simulated: true };
    }
  } catch (error) {
    console.error(`[Email Service Error] Failed to send email to ${to}:`, error.message);
    // Return gracefully so the employee creation doesn't fail if SMTP server is down
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmployeeWelcomeEmail,
};
