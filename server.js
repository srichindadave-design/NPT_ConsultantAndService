const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files from the current directory
app.use(express.static(__dirname));

const dbPath = path.join(__dirname, 'db.json');
const otpStore = new Map();

// Helper to create nodemailer transporter dynamically
function getTransporter(smtpConfig) {
  if (!smtpConfig || !smtpConfig.user || !smtpConfig.pass) {
    return null;
  }
 return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com', // ใช้ Host ของ Brevo
    port: 465,                    // ใช้ Port 465
    secure: true,                // true สำหรับ port 465
    auth: {
        user: process.env.EMAIL_USER,    // ใส่ค่าอีเมล Login ของ Brevo
        pass: process.env.EMAIL_PASS     // ใส่ค่า SMTP Key ของ Brevo
    }
});
}

// --- DATABASE JSON ENDPOINTS ---

// 1. Get database data
app.get('/api/db', (req, res) => {
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf8');
      return res.json(JSON.parse(data));
    } catch (e) {
      console.error('[Database] อ่านไฟล์ db.json ล้มเหลว:', e);
      return res.status(500).json({ success: false, message: 'อ่านฐานข้อมูลล้มเหลว' });
    }
  } else {
    // Return null if file database does not exist yet (let client upload initial localStorage data)
    return res.json(null);
  }
});

// 2. Save database data
app.post('/api/db', (req, res) => {
  const data = req.body;
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('[Database] บันทึกข้อมูลลงไฟล์ db.json เรียบร้อยแล้ว');
    return res.json({ success: true, message: 'บันทึกฐานข้อมูลสำเร็จ' });
  } catch (e) {
    console.error('[Database] เขียนไฟล์ db.json ล้มเหลว:', e);
    return res.status(500).json({ success: false, message: 'เขียนไฟล์ฐานข้อมูลล้มเหลว' });
  }
});

// --- OTP & EMAIL ENDPOINTS ---

// Send OTP
app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  let smtpConfig = req.body.smtpConfig;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'กรุณากรอก Gmail/Email ให้ถูกต้อง' });
  }

  // Fallback to server db.json config if not sent by client
  if (!smtpConfig && fs.existsSync(dbPath)) {
    try {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      smtpConfig = db.smtpConfig;
    } catch (e) {
      console.error('[OTP Email] Error reading smtpConfig from db.json:', e);
    }
  }

  // Fallback to default hardcoded config if still null
  if (!smtpConfig || !smtpConfig.user || !smtpConfig.pass) {
    smtpConfig = {
      user: "srichindadave@gmail.com",
      pass: "zpux ziwz yhbx umeq"
    };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 5 * 60 * 1000; // Expires in 5 minutes

  otpStore.set(email.toLowerCase(), { otp, expires });

  console.log(`[OTP Email] อีเมล: ${email} | รหัส OTP: ${otp} (หมดอายุใน 5 นาที)`);

  let sentRealEmail = false;
  const transporter = getTransporter(smtpConfig);
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"NPT Portal" <${smtpConfig.user}>`,
        to: email,
        subject: 'NPT Portal: รหัส OTP สำหรับเข้าใช้งานระบบ',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b; max-width: 500px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f46e5; margin-bottom: 20px;">NPT Portal OTP</h2>
            <p>คุณได้ทำการขอรหัส OTP สำหรับเข้าใช้งานระบบบริหารจัดการงาน NPT Portal</p>
            <div style="background: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin: 20px 0;">
              <span style="font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #1e293b;">${otp}</span>
            </div>
            <p style="font-size: 13px; color: #64748b;">รหัสนี้มีอายุการใช้งาน 5 นาที หากคุณไม่ได้ทำรายการนี้ โปรดละเลยอีเมลฉบับนี้</p>
          </div>
        `
      });
      sentRealEmail = true;
      console.log(`[OTP Email] ส่งรหัส OTP ไปยังอีเมลจริง ${email} สำเร็จ`);
    } catch (e) {
      console.error('[OTP Email] ล้มเหลวในการส่งอีเมลจริง:', e.message);
    }
  }

  return res.json({
    success: true,
    message: sentRealEmail ? 'ส่งรหัส OTP ไปยัง Gmail ของคุณเรียบร้อยแล้ว' : 'ส่งรหัส OTP เรียบร้อยแล้ว (จำลองการส่ง)',
    mockOtp: otp
  });
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุอีเมลและรหัส OTP' });
  }

  const record = otpStore.get(email.toLowerCase());

  if (!record) {
    return res.status(400).json({ success: false, message: 'ไม่พบรหัส OTP หรือกรุณากดขอรหัสอีกครั้ง' });
  }

  if (Date.now() > record.expires) {
    otpStore.delete(email.toLowerCase());
    return res.status(400).json({ success: false, message: 'รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่' });
  }

  if (record.otp === otp) {
    otpStore.delete(email.toLowerCase());
    const isAdmin = email.toLowerCase() === 'nptconsultant2017@gmail.com' || email.toLowerCase() === 'davezaa1642@gmail.com';

    return res.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      isAdmin: isAdmin,
      email: email.toLowerCase()
    });
  } else {
    return res.status(400).json({ success: false, message: 'รหัส OTP ไม่ถูกต้อง' });
  }
});

// Ping endpoint to test backend online status
app.get('/api/ping', (req, res) => {
  res.json({ success: true });
});

// Direct passwordless email login
app.post('/api/login-direct', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุอีเมล' });
  }

  const emailLower = email.toLowerCase();
  
  // Verify if email exists in db.json
  if (fs.existsSync(dbPath)) {
    try {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const staffList = db.staff || [];
      
      const isAdmin = emailLower === 'nptconsultant2017@gmail.com' || emailLower === 'davezaa1642@gmail.com';
      const isStaff = staffList.some(s => s.email.toLowerCase() === emailLower);
      
      if (isAdmin || isStaff) {
        return res.json({
          success: true,
          message: 'เข้าสู่ระบบสำเร็จ',
          isAdmin: isAdmin,
          email: emailLower
        });
      } else {
        return res.status(400).json({ success: false, message: 'ไม่พบอีเมลนี้ในระบบสิทธิ์แอดมินหรือพนักงาน' });
      }
    } catch (e) {
      console.error('[Login] Error:', e);
      return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการโหลดระบบ' });
    }
  } else {
    const isAdmin = emailLower === 'nptconsultant2017@gmail.com' || emailLower === 'davezaa1642@gmail.com' || emailLower === 'srichindadave@gmail.com';
    if (isAdmin) {
      return res.json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ',
        isAdmin: true,
        email: emailLower
      });
    } else {
      return res.status(400).json({ success: false, message: 'ไม่พบอีเมลนี้ในระบบสิทธิ์แอดมินหรือพนักงาน' });
    }
  }
});

// Send Email Notification Proxy
app.post('/api/send-email', async (req, res) => {
  const { to, subject, html } = req.body;
  let smtpConfig = req.body.smtpConfig;

  if (!to) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุอีเมลผู้รับ' });
  }
  if (!subject || !html) {
    return res.status(400).json({ success: false, message: 'ข้อมูลข้อความอีเมลไม่ครบถ้วน' });
  }

  // Fallback to server db.json config if not sent by client
  if (!smtpConfig && fs.existsSync(dbPath)) {
    try {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      smtpConfig = db.smtpConfig;
    } catch (e) {
      console.error('[Email Notification] Error reading smtpConfig from db.json:', e);
    }
  }

  // Fallback to default hardcoded config if still null
  if (!smtpConfig || !smtpConfig.user || !smtpConfig.pass) {
    smtpConfig = {
      user: "srichindadave@gmail.com",
      pass: "zpux ziwz yhbx umeq"
    };
  }

  console.log(`[Email Notification] ส่งไปยัง: ${to} | หัวข้อ: "${subject}"`);

  const transporter = getTransporter(smtpConfig);
  if (!transporter) {
    return res.json({
      success: true,
      message: 'จำลองการส่งอีเมล (เปิดคอนโซลเพื่อตรวจสอบ หรือตั้งค่า Gmail SMTP)'
    });
  }

  try {
    await transporter.sendMail({
      from: `"NPT Portal" <${smtpConfig.user}>`,
      to: to,
      subject: subject,
      html: html
    });
    return res.json({
      success: true,
      message: 'ส่งอีเมลแจ้งเตือนไปยังพนักงานสำเร็จ'
    });
  } catch (error) {
    console.error('[Email Notification] Error sending email via SMTP:', error);
    return res.status(500).json({
      success: false,
      message: `ไม่สามารถส่งอีเมลแจ้งเตือนได้: ${error.message}`
    });
  }
});

// Helper for LINE Push Message API using native https
const https = require('https');
function sendLinePushMessage(token, to, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      to: to,
      messages: [
        {
          type: 'text',
          text: text
        }
      ]
    });

    const options = {
      hostname: 'api.line.me',
      path: '/v2/bot/message/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode === 200) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

// Send LINE message via LINE Messaging API
app.post('/api/send-line', async (req, res) => {
  const { to, text } = req.body;
  let lineConfig = req.body.lineConfig;

  if (!to) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุ LINE User ID ผู้รับ' });
  }
  if (!text) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุข้อความที่ต้องการส่ง' });
  }

  // Fallback to server db.json config if not sent by client
  if (!lineConfig && fs.existsSync(dbPath)) {
    try {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      lineConfig = db.lineConfig;
    } catch (e) {
      console.error('[LINE Notification] Error reading lineConfig from db.json:', e);
    }
  }

  if (!lineConfig || !lineConfig.channelAccessToken) {
    console.log(`[LINE Notification Simulation] To: ${to} | Text: "${text}"`);
    return res.json({
      success: true,
      message: 'จำลองการส่งไลน์เนื่องจากไม่ได้ตั้งค่า LINE Channel Access Token'
    });
  }

  try {
    await sendLinePushMessage(lineConfig.channelAccessToken, to, text);
    console.log(`[LINE Notification] ส่งข้อความสำเร็จไปยัง: ${to}`);
    return res.json({ success: true, message: 'ส่งการแจ้งเตือนทาง LINE สำเร็จ' });
  } catch (error) {
    console.error('[LINE Notification] Connection Error:', error);
    return res.status(500).json({
      success: false,
      message: `ไม่สามารถส่งการแจ้งเตือน LINE ได้: ${error.message}`
    });
  }
});

// LINE Webhook Endpoint
app.post('/webhook', (req, res) => {
    console.log("LINE ส่งข้อมูลมาที่นี่:", JSON.stringify(req.body));
    res.status(200).send('OK'); // ต้องตอบกลับด้วย 200 เพื่อบอก LINE ว่าได้รับแล้ว
});

// Broadcast news to LINE group and individual staff
const handleSendNews = async (req, res) => {
  const { message } = req.body;
  let lineConfig = req.body.lineConfig;

  if (!message) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุข้อความข่าวสาร (message)' });
  }

  // Fallback to server db.json config if not sent by client
  if (!lineConfig && fs.existsSync(dbPath)) {
    try {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      lineConfig = db.lineConfig;
    } catch (e) {
      console.error('[LINE News] Error reading lineConfig from db.json:', e);
    }
  }

  if (!lineConfig || !lineConfig.channelAccessToken) {
    console.log(`[LINE News Simulation] Message: "${message}"`);
    return res.json({
      success: true,
      message: 'จำลองการประกาศข่าวเนื่องจากไม่ได้ตั้งค่า LINE Channel Access Token'
    });
  }

  const targets = [];
  // 1. Add group ID if configured
  if (lineConfig.lineGroupId) {
    targets.push(lineConfig.lineGroupId);
  }
  // 2. Add all staff members with lineUserId
  try {
    if (fs.existsSync(dbPath)) {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const staffList = db.staff || [];
      staffList.forEach(s => {
        if (s.lineUserId && !targets.includes(s.lineUserId)) {
          targets.push(s.lineUserId);
        }
      });
    }
  } catch (e) {
    console.error('[LINE News] Error gathering staff IDs:', e);
  }

  if (targets.length === 0) {
    return res.status(400).json({ success: false, message: 'ไม่พบ LINE Group ID หรือ LINE User ID ของพนักงานสำหรับการส่งข่าวสาร' });
  }

  console.log(`[LINE News] กำลังส่งข่าวสารไปยังผู้รับทั้งหมด ${targets.length} ช่องทาง...`);
  
  let successCount = 0;
  let failCount = 0;

  for (const targetId of targets) {
    try {
      await sendLinePushMessage(lineConfig.channelAccessToken, targetId, `📢 [ข่าวสารประชาสัมพันธ์]\n\n${message}`);
      successCount++;
    } catch (err) {
      console.error(`[LINE News] ส่งไม่สำเร็จไปยัง ${targetId}:`, err.message);
      failCount++;
    }
  }

  return res.json({
    success: true,
    message: `ส่งประกาศข่าวสารเสร็จสิ้น (สำเร็จ: ${successCount}, ล้มเหลว: ${failCount})`
  });
};

app.post('/send-news', handleSendNews);
app.post('/api/send-news', handleSendNews);

// Serve frontend index.html for all other routes to support SPA routing if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` เซิร์ฟเวอร์เริ่มต้นแล้วที่: http://localhost:${PORT}`);
  console.log(` อีเมลผู้ดูแลระบบแอดมิน: nptconsultant2017@gmail.com, davezaa1642@gmail.com`);
  console.log(`==================================================`);
});
