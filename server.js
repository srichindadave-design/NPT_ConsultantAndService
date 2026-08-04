const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files from the current directory
app.use(express.static(__dirname));

const dbPath = path.join(__dirname, 'db.json');

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

// --- PIN AUTHENTICATION ENDPOINTS ---
// แทนที่ระบบ OTP เดิม: พนักงาน/แอดมินแต่ละคนตั้งรหัส PIN ของตัวเองครั้งแรกที่เข้าใช้งาน
// แล้วใช้ PIN นั้นเข้าสู่ระบบในครั้งถัดไป (ยืนยันฝั่งเซิร์ฟเวอร์ทุกครั้ง)
const crypto = require('crypto');

function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 64).toString('hex');
}

function readDb() {
  if (fs.existsSync(dbPath)) {
    try {
      return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
      console.error('[DB] อ่านไฟล์ db.json ล้มเหลว:', e);
      return {};
    }
  }
  return {};
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
}

const ADMIN_EMAILS = ['nptconsultant2017@gmail.com', 'davezaa1642@gmail.com', 'srichindadave@gmail.com'];

function findAccount(db, emailLower) {
  const isAdmin = ADMIN_EMAILS.includes(emailLower);
  const staffList = db.staff || [];
  const staffMember = staffList.find(s => s.email && s.email.toLowerCase() === emailLower);
  return { isAdmin, staffMember, allowed: isAdmin || !!staffMember };
}

// 1. ตรวจสอบว่าอีเมลนี้มีสิทธิ์เข้าระบบไหม และเคยตั้ง PIN ไว้แล้วหรือยัง
app.post('/api/check-pin-status', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกอีเมลให้ถูกต้อง' });
  }
  const emailLower = email.toLowerCase();
  const db = readDb();
  const { isAdmin, staffMember, allowed } = findAccount(db, emailLower);

  if (!allowed) {
    return res.status(400).json({ success: false, message: 'ไม่พบอีเมลนี้ในระบบสิทธิ์แอดมินหรือพนักงาน' });
  }

  db.adminPins = db.adminPins || {};
  const hasPinSet = isAdmin
    ? !!(db.adminPins[emailLower] && db.adminPins[emailLower].hash)
    : !!(staffMember && staffMember.pinHash);

  return res.json({ success: true, hasPinSet, isAdmin, email: emailLower });
});

// 2. ตั้งรหัส PIN ครั้งแรกด้วยตนเอง (self-service)
app.post('/api/setup-pin', (req, res) => {
  const { email, pin } = req.body;
  if (!email || !pin || !/^\d{4,6}$/.test(String(pin))) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง กรุณากรอกรหัส PIN เป็นตัวเลข 4 หลัก' });
  }
  const emailLower = email.toLowerCase();
  const db = readDb();
  const { isAdmin, staffMember, allowed } = findAccount(db, emailLower);

  if (!allowed) {
    return res.status(400).json({ success: false, message: 'ไม่พบอีเมลนี้ในระบบสิทธิ์แอดมินหรือพนักงาน' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPin(pin, salt);

  if (isAdmin) {
    db.adminPins = db.adminPins || {};
    if (db.adminPins[emailLower] && db.adminPins[emailLower].hash) {
      return res.status(400).json({ success: false, message: 'มีการตั้งรหัส PIN ไว้แล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ต' });
    }
    db.adminPins[emailLower] = { salt, hash };
  } else {
    if (staffMember.pinHash) {
      return res.status(400).json({ success: false, message: 'มีการตั้งรหัส PIN ไว้แล้ว กรุณาติดต่อผู้จัดการเพื่อรีเซ็ต' });
    }
    staffMember.pinSalt = salt;
    staffMember.pinHash = hash;
  }

  writeDb(db);
  console.log(`[PIN Setup] ${emailLower} ตั้งรหัส PIN สำเร็จ`);
  return res.json({ success: true, message: 'ตั้งรหัส PIN สำเร็จ', isAdmin, email: emailLower });
});

// 3. เข้าสู่ระบบด้วยอีเมล + PIN
// ป้องกันการเดารหัส PIN แบบสุ่ม (brute-force) เนื่องจาก PIN มีแค่ 4 หลัก (10,000 แบบ)
// ล็อกชั่วคราวหลังพยายามผิด 5 ครั้งติดต่อกัน (เก็บในหน่วยความจำ รีเซ็ตเองเมื่อรีสตาร์ทเซิร์ฟเวอร์)
const pinAttempts = new Map();
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 นาที

app.post('/api/login-pin', (req, res) => {
  const { email, pin } = req.body;
  if (!email || !pin) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุอีเมลและรหัส PIN' });
  }
  const emailLower = email.toLowerCase();

  const attemptRec = pinAttempts.get(emailLower);
  if (attemptRec && attemptRec.count >= MAX_PIN_ATTEMPTS && Date.now() - attemptRec.lastAttempt < PIN_LOCKOUT_MS) {
    const waitMin = Math.ceil((PIN_LOCKOUT_MS - (Date.now() - attemptRec.lastAttempt)) / 60000);
    return res.status(429).json({ success: false, message: `กรอกรหัส PIN ผิดหลายครั้งเกินไป กรุณาลองใหม่อีกครั้งใน ${waitMin} นาที` });
  }

  const db = readDb();
  const { isAdmin, staffMember, allowed } = findAccount(db, emailLower);

  if (!allowed) {
    return res.status(400).json({ success: false, message: 'ไม่พบอีเมลนี้ในระบบ' });
  }

  let saltRec, hashRec;
  if (isAdmin) {
    db.adminPins = db.adminPins || {};
    const rec = db.adminPins[emailLower];
    if (!rec) return res.status(400).json({ success: false, message: 'ยังไม่ได้ตั้งค่า PIN กรุณาตั้งค่าก่อน', needsSetup: true });
    saltRec = rec.salt; hashRec = rec.hash;
  } else {
    if (!staffMember || !staffMember.pinHash) {
      return res.status(400).json({ success: false, message: 'ยังไม่ได้ตั้งค่า PIN กรุณาตั้งค่าก่อน', needsSetup: true });
    }
    saltRec = staffMember.pinSalt; hashRec = staffMember.pinHash;
  }

  const attemptHash = hashPin(pin, saltRec);
  const a = Buffer.from(attemptHash, 'hex');
  const b = Buffer.from(hashRec, 'hex');
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    const current = pinAttempts.get(emailLower) || { count: 0 };
    pinAttempts.set(emailLower, { count: current.count + 1, lastAttempt: Date.now() });
    return res.status(400).json({ success: false, message: 'รหัส PIN ไม่ถูกต้อง' });
  }

  pinAttempts.delete(emailLower);
  return res.json({ success: true, message: 'เข้าสู่ระบบสำเร็จ', isAdmin, email: emailLower });
});

// 4. รีเซ็ต PIN ของพนักงาน (ให้ผู้จัดการ/แอดมินใช้ เมื่อพนักงานลืมรหัส PIN)
app.post('/api/reset-pin', (req, res) => {
  const { targetEmail, actingEmail } = req.body;
  if (!targetEmail) return res.status(400).json({ success: false, message: 'กรุณาระบุอีเมลที่ต้องการรีเซ็ต' });
  if (!actingEmail) return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลผู้ดำเนินการ กรุณาเข้าสู่ระบบใหม่' });

  const db = readDb();
  const actingLower = actingEmail.toLowerCase();
  const { isAdmin: actingIsAdmin, staffMember: actingStaff } = findAccount(db, actingLower);
  const actingIsManager = actingIsAdmin || (actingStaff && actingStaff.position === 'ผู้จัดการ');

  if (!actingIsManager) {
    return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์รีเซ็ตรหัส PIN ของผู้อื่น' });
  }

  const emailLower = targetEmail.toLowerCase();
  const staffList = db.staff || [];
  const staffMember = staffList.find(s => s.email && s.email.toLowerCase() === emailLower);

  let found = false;
  if (staffMember && staffMember.pinHash) {
    delete staffMember.pinHash;
    delete staffMember.pinSalt;
    found = true;
  }
  db.adminPins = db.adminPins || {};
  if (db.adminPins[emailLower]) {
    delete db.adminPins[emailLower];
    found = true;
  }

  if (!found) {
    return res.status(400).json({ success: false, message: 'ไม่พบรหัส PIN ที่ตั้งไว้สำหรับอีเมลนี้' });
  }

  writeDb(db);
  return res.json({ success: true, message: 'รีเซ็ตรหัส PIN เรียบร้อยแล้ว ผู้ใช้สามารถตั้งรหัสใหม่ได้ในการเข้าสู่ระบบครั้งถัดไป' });
});

// --- PUSH NOTIFICATION (Web Push) ---
// สร้างคู่กุญแจ VAPID ครั้งแรก แล้วเก็บไว้ใน db.json เพื่อให้ใช้ค่าเดิมทุกครั้งที่เซิร์ฟเวอร์รีสตาร์ท
function ensureVapidKeys() {
  const db = readDb();
  if (!db.vapidKeys || !db.vapidKeys.publicKey || !db.vapidKeys.privateKey) {
    const keys = webpush.generateVAPIDKeys();
    db.vapidKeys = keys;
    writeDb(db);
    console.log('[Push] สร้างคู่กุญแจ VAPID ใหม่สำหรับการแจ้งเตือนแล้ว');
  }
  return db.vapidKeys;
}
const vapidKeys = ensureVapidKeys();
webpush.setVapidDetails('mailto:nptconsultant2017@gmail.com', vapidKeys.publicKey, vapidKeys.privateKey);

// ให้ฝั่งไคลเอนต์ดึง public key ไปใช้สมัครรับการแจ้งเตือน
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ success: true, publicKey: vapidKeys.publicKey });
});

// ไคลเอนต์ลงทะเบียนอุปกรณ์นี้เพื่อรับการแจ้งเตือน
app.post('/api/push/subscribe', (req, res) => {
  const { subscription, email } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ success: false, message: 'ข้อมูลการสมัครรับแจ้งเตือนไม่ถูกต้อง' });
  }
  const db = readDb();
  db.pushSubscriptions = db.pushSubscriptions || [];
  // เอาตัวเก่าที่ endpoint ซ้ำออกก่อน (เผื่อสมัครซ้ำ/คีย์ใหม่) แล้วค่อยเพิ่มตัวใหม่
  db.pushSubscriptions = db.pushSubscriptions.filter(s => s.subscription.endpoint !== subscription.endpoint);
  db.pushSubscriptions.push({ email: email || null, subscription, subscribedAt: Date.now() });
  writeDb(db);
  console.log(`[Push] อุปกรณ์ใหม่ลงทะเบียนรับแจ้งเตือน (${email || 'ไม่ระบุอีเมล'}) รวมทั้งหมด ${db.pushSubscriptions.length} อุปกรณ์`);
  res.json({ success: true, message: 'เปิดใช้การแจ้งเตือนสำเร็จ' });
});

// ยกเลิกรับการแจ้งเตือนบนอุปกรณ์นี้
app.post('/api/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
  const db = readDb();
  db.pushSubscriptions = (db.pushSubscriptions || []).filter(s => s.subscription.endpoint !== endpoint);
  writeDb(db);
  res.json({ success: true, message: 'ปิดการแจ้งเตือนสำหรับอุปกรณ์นี้แล้ว' });
});

// กระจายการแจ้งเตือนไปยังทุกอุปกรณ์ที่ลงทะเบียนไว้ (ใช้ตอนมีงานใหม่/อนุมัติ PR ฯลฯ)
app.post('/api/push/broadcast', async (req, res) => {
  const { title, body, url } = req.body;
  if (!title) return res.status(400).json({ success: false, message: 'กรุณาระบุหัวข้อการแจ้งเตือน' });

  const db = readDb();
  const subs = db.pushSubscriptions || [];
  if (subs.length === 0) {
    return res.json({ success: true, message: 'ยังไม่มีอุปกรณ์ที่เปิดรับการแจ้งเตือน', sent: 0 });
  }

  const payload = JSON.stringify({ title, body: body || '', url: url || '/' });
  let sent = 0, removed = 0;
  const stillValid = [];

  for (const entry of subs) {
    try {
      await webpush.sendNotification(entry.subscription, payload);
      sent++;
      stillValid.push(entry);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        removed++; // อุปกรณ์ยกเลิก/หมดอายุการสมัครแล้ว -> เอาออกจากรายการ
      } else {
        console.error('[Push] ส่งแจ้งเตือนไม่สำเร็จไปยังอุปกรณ์หนึ่ง:', err.message);
        stillValid.push(entry);
      }
    }
  }

  db.pushSubscriptions = stillValid;
  writeDb(db);
  console.log(`[Push] ส่งแจ้งเตือน "${title}" สำเร็จ ${sent} อุปกรณ์ (ลบ ${removed} อุปกรณ์ที่หมดอายุ)`);
  res.json({ success: true, message: `ส่งแจ้งเตือนสำเร็จ ${sent} อุปกรณ์`, sent, removed });
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
