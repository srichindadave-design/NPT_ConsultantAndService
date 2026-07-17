// ================= CONFIGURATION & LOCAL STORAGE KEY NAMES =================
const STORAGE_KEYS = {
    STAFF: 'npt_portal_staff',
    TASKS: 'npt_portal_tasks',
    QUOTATIONS: 'npt_portal_quotations',
    PRS: 'npt_portal_prs',
    POS: 'npt_portal_pos',
    EQUIPMENT: 'npt_portal_equipment',
    SMTP_CONFIG: 'npt_portal_smtp_config',
    AUTH: 'npt_portal_auth_user'
};

// ================= DEFAULT MOCK DATA =================
const DEFAULT_STAFF = [
    { id: 'st-admin', name: 'ดร.ณภัทร ปุญศิริ', nickname: 'แชมป์', position: 'ผู้จัดการ', email: 'nptconsultant2017@gmail.com', phone: '089-113-8844', lineId: 'Champ0891138844', status: 'ว่าง' }
];

const DEFAULT_TASKS = [];

const DEFAULT_QUOTATIONS = [];
const DEFAULT_PRS = [];
const DEFAULT_POS = [];
const DEFAULT_EQUIPMENTS = [];

const API_BASE = '/api';

// ================= APP STATE =================
let state = {
    staff: [],
    tasks: [],
    quotations: [],
    prs: [],
    pos: [],
    equipments: [],
    smtpConfig: null, // { user, pass }
    currentUser: null // { email, isAdmin }
};

const positionOrder = {
    'ผู้จัดการ': 1,
    'ผู้ช่วยผู้จัดการ': 2,
    'ช่างเทคนิค': 3,
    'นักศึกษาฝึกงาน': 4
};

function getSortedStaff() {
    return [...state.staff]
        .filter(s => s.email.toLowerCase() !== 'davezaa1642@gmail.com')
        .sort((a, b) => {
            const orderA = positionOrder[a.position] || 99;
            const orderB = positionOrder[b.position] || 99;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return a.name.localeCompare(b.name, 'th');
        });
}

// For client-side offline fallback simulation
let isOfflineMode = false;
let frontendMockOtp = '';
let frontendMockEmail = '';
let tempUploadedFileData = '';
let tempUploadedFileName = '';
let taskDatePicker = null;
let quoteDatePicker = null;
let prDatePicker = null;
let poDatePicker = null;
let poDeliveryDatePicker = null;

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    initData();
    initTheme();
    setupEventListeners();
    
    // Initialize Flatpickr
    taskDatePicker = flatpickr("#task-date", {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        locale: "th"
    });
    quoteDatePicker = flatpickr("#quote-date", {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        locale: "th"
    });
    prDatePicker = flatpickr("#pr-date", {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        locale: "th"
    });
    poDatePicker = flatpickr("#po-date", {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        locale: "th"
    });
    poDeliveryDatePicker = flatpickr("#po-delivery-date", {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        locale: "th"
    });

    checkAuth();
    updateDateBadge();
    detectMode().then(() => {
        syncDatabase();
    });
    lucide.createIcons();
});

// Load data from LocalStorage or inject defaults
// Load data from LocalStorage or inject defaults
function initData() {
    state.staff = JSON.parse(localStorage.getItem(STORAGE_KEYS.STAFF)) || DEFAULT_STAFF;
    state.tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || DEFAULT_TASKS;
    state.quotations = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUOTATIONS)) || DEFAULT_QUOTATIONS;
    state.prs = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRS)) || DEFAULT_PRS;
    state.pos = JSON.parse(localStorage.getItem(STORAGE_KEYS.POS)) || DEFAULT_POS;
    state.equipments = JSON.parse(localStorage.getItem(STORAGE_KEYS.EQUIPMENT)) || DEFAULT_EQUIPMENTS;
    state.smtpConfig = JSON.parse(localStorage.getItem(STORAGE_KEYS.SMTP_CONFIG)) || null;
    state.currentUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTH)) || null;

    // Data Migration: Upgrade from old Phone number schema to Email schema
    let needsMigration = false;
    state.staff.forEach(s => {
        if (!s.email && s.phone) {
            needsMigration = true;
        }
    });

    if (needsMigration) {
        console.log('[Migration] ตรวจพบข้อมูลเก่าแบบเบอร์โทรศัพท์ -> กำลังย้ายฐานข้อมูลเป็น Gmail');
        state.staff = DEFAULT_STAFF;
        state.tasks = DEFAULT_TASKS;
        state.currentUser = null;
        localStorage.removeItem(STORAGE_KEYS.AUTH);
    }

    // Admin Injection & Old Admin Cleanup
    const adminExists = state.staff.some(s => s.email.toLowerCase() === 'nptconsultant2017@gmail.com');
    if (!adminExists) {
        state.staff.unshift({
            id: 'st-admin',
            name: 'ดร.ณภัทร ปุญศิริ',
            nickname: 'แชมป์',
            position: 'ผู้ดูแลระบบ / ที่ปรึกษา',
            email: 'nptconsultant2017@gmail.com',
            phone: '089-113-8844',
            lineId: 'Champ0891138844',
            status: 'ว่าง'
        });
        state.staff = state.staff.filter(s => s.email.toLowerCase() !== 'npt.admin@gmail.com');
        saveDataToLocalStorage(false);
    }

    // Inject davezaa1642@gmail.com as admin staff (kept in state but hidden from display by getSortedStaff)
    const daveExists = state.staff.some(s => s.email.toLowerCase() === 'davezaa1642@gmail.com');
    if (!daveExists) {
        state.staff.push({
            id: 'st-dave-admin',
            name: 'ผู้ดูแลระบบ (เดฟ)',
            nickname: 'เดฟ',
            position: 'ผู้ดูแลระบบ',
            email: 'davezaa1642@gmail.com',
            phone: '081-740-1354',
            lineId: 'davezaa1642',
            status: 'ว่าง'
        });
    }

    const initialLen = state.staff.length;
    
    // Inject srichindadave@gmail.com as technician
    const techExists = state.staff.some(s => s.email.toLowerCase() === 'srichindadave@gmail.com');
    if (!techExists) {
        state.staff.push({
            id: 'st-dave-tech',
            name: 'สุริชินดา เดฟ',
            nickname: 'เดฟ',
            position: 'ช่างเทคนิค',
            email: 'srichindadave@gmail.com',
            phone: '081-996-5444',
            lineId: 'DaveTech',
            status: 'ว่าง'
        });
    }

    // Force srichindadave@gmail.com to be ช่างเทคนิค position
    state.staff.forEach(s => {
        if (s.email.toLowerCase() === 'srichindadave@gmail.com') {
            s.position = 'ช่างเทคนิค';
        }
    });

    if (!daveExists || !techExists) {
        saveDataToLocalStorage(false);
    }

    // Phone & LINE ID Auto-Migration
    let needsPhoneLineMigration = false;
    state.staff.forEach(s => {
        if (s.phone === undefined || s.lineId === undefined) {
            needsPhoneLineMigration = true;
        }
    });

    if (needsPhoneLineMigration) {
        state.staff.forEach(s => {
            if (s.phone === undefined) {
                if (s.email === 'nptconsultant2017@gmail.com') s.phone = '089-1138844';
                else s.phone = '-';
            }
            if (s.lineId === undefined) {
                if (s.email === 'nptconsultant2017@gmail.com') s.lineId = 'Champ0891138844';
                else s.lineId = '-';
            }
        });
        saveDataToLocalStorage(false);
    }

    // Nickname Migration
    let needsNicknameMigration = false;
    state.staff.forEach(s => {
        if (s.nickname === undefined) {
            needsNicknameMigration = true;
        }
    });

    if (needsNicknameMigration) {
        state.staff.forEach(s => {
            if (s.nickname === undefined) {
                if (s.email === 'nptconsultant2017@gmail.com') s.nickname = 'แชมป์';
                else s.nickname = '-';
            }
        });
        saveDataToLocalStorage(false);
    }

    // Position Migration to only valid options: ผู้จัดการ, ผู้ช่วยผู้จัดการ, ช่างเทคนิค, นักศึกษาฝึกงาน
    const validPositions = ['ผู้จัดการ', 'ผู้ช่วยผู้จัดการ', 'ช่างเทคนิค', 'นักศึกษาฝึกงาน'];
    let needsPositionMigration = false;
    state.staff.forEach(s => {
        if (!validPositions.includes(s.position)) {
            needsPositionMigration = true;
        }
    });

    if (needsPositionMigration) {
        state.staff.forEach(s => {
            if (!validPositions.includes(s.position)) {
                if (s.position.includes('ผู้จัดการ') || s.position.includes('ผู้ดูแลระบบ') || s.email === 'nptconsultant2017@gmail.com') {
                    s.position = 'ผู้จัดการ';
                } else if (s.position.includes('ผู้ช่วย')) {
                    s.position = 'ผู้ช่วยผู้จัดการ';
                } else {
                    s.position = 'ช่างเทคนิค';
                }
            }
        });
        saveDataToLocalStorage(false);
    }
}

// Synchronize database with backend db.json file
async function syncDatabase() {
    if (isOfflineMode) return;
    
    try {
        const response = await fetch(`${API_BASE}/db`);
        const serverDb = await response.json();
        
        if (serverDb) {
            console.log('[Database] โหลดข้อมูลสำเร็จจากไฟล์หลังบ้าน (db.json)');
            state.staff = serverDb.staff || DEFAULT_STAFF;
            state.tasks = serverDb.tasks || DEFAULT_TASKS;
            state.quotations = serverDb.quotations || DEFAULT_QUOTATIONS;
            state.prs = serverDb.prs || DEFAULT_PRS;
            state.pos = serverDb.pos || DEFAULT_POS;
            state.equipments = serverDb.equipments || DEFAULT_EQUIPMENTS;
            state.smtpConfig = serverDb.smtpConfig || null;
            
            // Save loaded data to localStorage cache
            localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(state.staff));
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
            localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(state.quotations));
            localStorage.setItem(STORAGE_KEYS.PRS, JSON.stringify(state.prs));
            localStorage.setItem(STORAGE_KEYS.POS, JSON.stringify(state.pos));
            localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(state.equipments));
            if (state.smtpConfig) {
                localStorage.setItem(STORAGE_KEYS.SMTP_CONFIG, JSON.stringify(state.smtpConfig));
            }
            
            // Re-render currently active tab
            const activeItem = document.querySelector('.nav-item.active');
            if (activeItem && state.currentUser) {
                switchTab(activeItem.dataset.tab);
            }
            
            // Check notifications after data is successfully synced
            checkNewTaskNotifications();
        } else {
            // Backend has no file database yet -> Upload current browser localStorage data
            console.log('[Database] ไม่พบฐานข้อมูลบนเซิร์ฟเวอร์ -> กำลังบันทึกข้อมูลเบราว์เซอร์ปัจจุบันลงไฟล์...');
            await pushDatabaseToServer();
        }
    } catch (e) {
        console.warn('[Database] เชื่อมต่อซิงค์ฐานข้อมูลไม่สำเร็จ:', e);
    }
}

// Push local browser memory data to server db.json file
async function pushDatabaseToServer() {
    if (isOfflineMode) return;
    
    const payload = {
        staff: state.staff,
        tasks: state.tasks,
        quotations: state.quotations,
        prs: state.prs,
        pos: state.pos,
        equipments: state.equipments,
        smtpConfig: state.smtpConfig
    };
    
    try {
        const response = await fetch(`${API_BASE}/db`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
            console.log('[Database] อัปโหลดฐานข้อมูลลงไฟล์ db.json สำเร็จ');
        }
    } catch (e) {
        console.error('[Database] บันทึกลงเซิร์ฟเวอร์ล้มเหลว:', e);
    }
}

function saveDataToLocalStorage(syncWithServer = true) {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(state.staff));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
    localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(state.quotations));
    localStorage.setItem(STORAGE_KEYS.PRS, JSON.stringify(state.prs));
    localStorage.setItem(STORAGE_KEYS.POS, JSON.stringify(state.pos));
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(state.equipments));
    if (state.smtpConfig) {
        localStorage.setItem(STORAGE_KEYS.SMTP_CONFIG, JSON.stringify(state.smtpConfig));
    } else {
        localStorage.removeItem(STORAGE_KEYS.SMTP_CONFIG);
    }
    
    // Auto sync with server JSON file database
    if (syncWithServer) {
        pushDatabaseToServer();
    }
}

// Detect if running directly from file protocol or if Express backend is offline
async function detectMode() {
    if (window.location.protocol === 'file:') {
        isOfflineMode = true;
        console.log('[Mode] รันผ่านไฟล์โดยตรง (File Protocol) -> เปิดใช้งานโหมดจำลองฝั่งเบราว์เซอร์อัตโนมัติ');
    } else {
        isOfflineMode = false;
        console.log('[Mode] รันผ่านเซิร์ฟเวอร์ออนไลน์ -> ใช้โหมดออนไลน์จริง');
    }
}

// ================= THEME MANAGEMENT =================
function initTheme() {
    const savedTheme = localStorage.getItem('npt_portal_theme') || 'dark';
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');

    if (savedTheme === 'light') {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        themeIcon.setAttribute('data-lucide', 'moon');
        themeText.textContent = 'โหมดมืด';
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        themeIcon.setAttribute('data-lucide', 'sun');
        themeText.textContent = 'โหมดสว่าง';
    }
    lucide.createIcons();
}

function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    let newTheme = 'dark';

    if (body.classList.contains('dark-mode')) {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        themeIcon.setAttribute('data-lucide', 'moon');
        themeText.textContent = 'โหมดมืด';
        newTheme = 'light';
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        themeIcon.setAttribute('data-lucide', 'sun');
        themeText.textContent = 'โหมดสว่าง';
        newTheme = 'dark';
    }

    localStorage.setItem('npt_portal_theme', newTheme);
    lucide.createIcons();
}

// ================= AUTHENTICATION WORKFLOW =================
function checkAuth() {
    const loginOverlay = document.getElementById('login-overlay');
    const appContainer = document.getElementById('app-container');

    if (state.currentUser) {
        // Logged in
        loginOverlay.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        // Configure UI according to user role
        setupUserRoleUI();
        
        // Render current views
        switchTab('dashboard');
        checkNewTaskNotifications();
    } else {
        // Not logged in
        loginOverlay.classList.remove('hidden');
        appContainer.classList.add('hidden');
        resetLoginForm();
    }
}

function checkIsManagement() {
    if (!state.currentUser) return false;
    if (state.currentUser.isAdmin) return true;
    const member = state.staff.find(s => s.email.toLowerCase() === state.currentUser.email.toLowerCase());
    if (member) {
        return member.position === 'ผู้จัดการ' || member.position === 'ผู้ช่วยผู้จัดการ';
    }
    return false;
}

function setupUserRoleUI() {
    const roleBadge = document.getElementById('user-role-badge');
    const displayName = document.getElementById('user-display-email');
    
    // Find member by email to display actual Name instead of email
    const member = state.staff.find(s => s.email.toLowerCase() === state.currentUser.email.toLowerCase());
    let displayUserText = '';
    
    if (member) {
        displayUserText = member.name;
    } else {
        // Fallback / Admin names
        if (state.currentUser.email === 'davezaa1642@gmail.com') {
            displayUserText = 'ผู้ดูแลระบบ (เดฟ)';
        } else if (state.currentUser.email === 'nptconsultant2017@gmail.com') {
            displayUserText = 'ดร.ณภัทร ปุญศิริ';
        } else {
            displayUserText = state.currentUser.email;
        }
    }
    
    displayName.textContent = displayUserText;

    const isMgmt = checkIsManagement();

    if (isMgmt) {
        const roleName = member ? member.position : 'ผู้ดูแลระบบ';
        roleBadge.textContent = roleName;
        roleBadge.className = 'badge badge-admin';
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    } else {
        const roleName = member ? member.position : 'พนักงาน';
        roleBadge.textContent = roleName;
        roleBadge.className = 'badge badge-staff';
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    }
}

function resetLoginForm() {
    document.getElementById('login-email').value = '';
    document.getElementById('login-otp').value = '';
    document.getElementById('phone-view').classList.remove('hidden');
    document.getElementById('otp-view').classList.add('hidden');
}

async function requestOTP() {
    const emailInput = document.getElementById('login-email').value.trim().toLowerCase();
    
    if (!emailInput || !emailInput.includes('@')) {
        showToast('กรุณากรอก Gmail/Email ให้ถูกต้อง', 'error', 'login-message');
        return;
    }

    // If online mode, call backend directly and let it validate
    if (!isOfflineMode) {
        try {
            const response = await fetch(`${API_BASE}/login-direct`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: emailInput
                })
            });
            const result = await response.json();

            if (result.success) {
                state.currentUser = {
                    email: result.email,
                    isAdmin: result.isAdmin
                };
                localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(state.currentUser));
                
                checkAuth();
                showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับครับ', 'success');
            } else {
                showToast(result.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error', 'login-message');
            }
            return;
        } catch (e) {
            console.error('[Login] Backend error, falling back to local verification...', e);
        }
    }

    // Local / Offline Simulation
    const isAdmin = emailInput === 'nptconsultant2017@gmail.com' || emailInput === 'davezaa1642@gmail.com';
    const isStaff = state.staff.some(s => s.email && s.email.toLowerCase() === emailInput);

    if (!isAdmin && !isStaff) {
        showToast('ไม่พบอีเมลนี้ในระบบสิทธิ์แอดมินหรือพนักงาน', 'error', 'login-message');
        return;
    }

    state.currentUser = {
        email: emailInput,
        isAdmin: isAdmin
    };
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(state.currentUser));
    checkAuth();
    showToast('เข้าสู่ระบบสำเร็จ (โหมดจำลองออฟไลน์)', 'success');
}

function triggerEmailAlert(email, htmlContent) {
    if (email.toLowerCase() === 'davezaa1642@gmail.com') {
        return; // Do not show OTP notification popup for this email
    }
    document.getElementById('display-target-email').textContent = email;
    document.getElementById('sms-body-content').innerHTML = htmlContent;
    
    // Show Gmail notification style pop-up
    const emailPopup = document.getElementById('simulated-sms');
    emailPopup.classList.remove('hidden');
    setTimeout(() => emailPopup.classList.add('show'), 100);

    // Hide popup after 12 seconds
    setTimeout(hideSMSNotification, 12000);
}

async function verifyOTP() {
    const emailInput = document.getElementById('login-email').value.trim().toLowerCase();
    const otpInput = document.getElementById('login-otp').value.trim();

    if (!/^\d{6}$/.test(otpInput)) {
        showToast('กรุณากรอกรหัส OTP ให้ครบ 6 หลัก', 'error', 'login-message');
        return;
    }

    if (isOfflineMode) {
        if (emailInput === frontendMockEmail && otpInput === frontendMockOtp) {
            hideSMSNotification();
            
            state.currentUser = {
                email: emailInput,
                isAdmin: emailInput === 'nptconsultant2017@gmail.com' || emailInput === 'davezaa1642@gmail.com'
            };
            localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(state.currentUser));
            
            checkAuth();
            showToast('เข้าสู่ระบบสำเร็จ (โหมดจำลองออฟไลน์)', 'success');
        } else {
            showToast('รหัส OTP ไม่ถูกต้อง', 'error', 'login-message');
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailInput, otp: otpInput })
        });
        const result = await response.json();

        if (result.success) {
            hideSMSNotification();
            
            // Save authentication state
            state.currentUser = {
                email: result.email,
                isAdmin: result.isAdmin
            };
            localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(state.currentUser));
            
            checkAuth();
            showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับครับ', 'success');
        } else {
            showToast(result.message || 'รหัส OTP ไม่ถูกต้อง', 'error', 'login-message');
        }
    } catch (e) {
        showToast('เกิดข้อผิดพลาดในการยืนยัน OTP', 'error', 'login-message');
    }
}

function logout() {
    state.currentUser = null;
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    checkAuth();
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
}

function hideSMSNotification() {
    const smsPopup = document.getElementById('simulated-sms');
    smsPopup.classList.remove('show');
    setTimeout(() => smsPopup.classList.add('hidden'), 500);
}

// ================= TAB NAVIGATION =================
function switchTab(tabId) {
    // Update Active Menu
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.tab === tabId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Hide/Show Panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        if (panel.id === `tab-${tabId}`) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });

    // Page headers
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    
    switch (tabId) {
        case 'dashboard':
            title.textContent = 'ภาพรวมระบบ (Dashboard)';
            subtitle.textContent = 'ข้อมูลสถิติและการทำงานภาพรวมปัจจุบัน';
            renderDashboard();
            break;
        case 'tasks':
            title.textContent = 'ตารางงานและความรับผิดชอบ';
            subtitle.textContent = 'ตารางงานพนักงานและความรับผิดชอบทั้งหมด';
            renderTasks();
            break;
        case 'assign-tasks':
            title.textContent = 'การมอบหมายงานและจัดการ';
            subtitle.textContent = 'มอบหมายงานใหม่ แก้ไข และติดตามการทำงาน';
            renderAssignTasks();
            break;
        case 'quotations':
            title.textContent = 'ระบบเอกสารใบเสนอราคา';
            subtitle.textContent = 'จัดทำ ค้นหา และพิมพ์ใบเสนอราคาเสนอผู้ซื้อ';
            renderQuotations();
            break;
        case 'pr':
            title.textContent = 'ระบบใบขอซื้อ (PR)';
            subtitle.textContent = 'พนักงานจัดทำใบขอซื้อ เพื่อขออนุมัติจัดซื้อสินค้าและอุปกรณ์';
            renderPRs();
            break;
        case 'po':
            title.textContent = 'ระบบใบสั่งซื้อ (PO)';
            subtitle.textContent = 'สร้าง บริหารจัดการ และพิมพ์ใบสั่งซื้อส่งไปยังร้านค้า/ผู้ขาย';
            renderPOs();
            break;
        case 'staff':
            title.textContent = 'ทำเนียบบุคลากร';
            subtitle.textContent = 'บันทึกรายชื่อ อีเมล และสถานะพนักงาน';
            renderStaff();
            break;
        case 'equipment':
            title.textContent = 'รายการอุปกรณ์';
            subtitle.textContent = 'บริหารจัดการ และบันทึกสถานะเครื่องมือ/อุปกรณ์ของบริษัท';
            renderEquipments();
            break;
        case 'settings':
            title.textContent = 'การตั้งค่าระบบ';
            subtitle.textContent = 'เชื่อมโยงระบบส่งข้อความแจ้งเตือน Gmail SMTP';
            loadSettings();
            break;
    }
    lucide.createIcons();
}

// ================= TOAST SYSTEM =================
function showToast(message, type = 'info', elementId = 'global-toast') {
    const toast = document.getElementById(elementId);
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

function updateDateBadge() {
    const options = { year: 'numeric', month: 'long', day: 'numeric', locale: 'th-TH' };
    const dateStr = new Date().toLocaleDateString('th-TH', options);
    document.getElementById('current-date').textContent = dateStr;
}

// ================= RENDER: DASHBOARD =================
function renderDashboard() {
    // 1. Calculate Stats
    const totalTasks = state.tasks.length;
    const pendingTasks = state.tasks.filter(t => t.status === 'pending').length;
    const ongoingTasks = state.tasks.filter(t => t.status === 'ongoing').length;
    const completedTasks = state.tasks.filter(t => t.status === 'completed').length;
    const totalStaff = getSortedStaff().length;
    const totalQuotations = state.quotations.length;

    // Apply stats to UI
    document.getElementById('stat-total-tasks').textContent = totalTasks;
    document.getElementById('stat-pending-tasks').textContent = ongoingTasks;
    document.getElementById('stat-completed-tasks').textContent = completedTasks;
    document.getElementById('stat-total-quotations').textContent = totalQuotations;
    if (document.getElementById('stat-total-staff')) {
        document.getElementById('stat-total-staff').textContent = totalStaff;
    }

    // 2. Render Recent Tasks (Max 5)
    const recentTasksContainer = document.getElementById('recent-tasks-list');
    recentTasksContainer.innerHTML = '';
    
    const recent = state.tasks.slice(-5).reverse();
    
    if (recent.length === 0) {
        recentTasksContainer.innerHTML = `<tr><td colspan="3" class="text-muted" style="text-align:center;">ไม่มีรายการงานในขณะนี้</td></tr>`;
    } else {
        recent.forEach(t => {
            let statusText = 'ยังไม่เริ่ม';
            let statusClass = 'pending';
            if (t.status === 'ongoing') { statusText = 'กำลังทำ'; statusClass = 'ongoing'; }
            else if (t.status === 'completed') { statusText = 'เสร็จสิ้น'; statusClass = 'completed'; }

            let qtyText = '';
            if (t.qty && t.qty >= 1) {
                qtyText = `<br><small class="text-muted">ความคืบหน้า: ${t.completedQty || 0} / ${t.qty} หน่วย</small>`;
            }

            const displayNames = t.assigneeNames ? t.assigneeNames.join(', ') : t.assigneeName;

            const dateText = `<br><small class="text-muted"><i data-lucide="calendar" style="width:12px;height:12px;vertical-align:middle;display:inline-block;margin-right:4px;"></i>มอบหมายเมื่อ: ${t.assignedDate || '-'}</small>`;

            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.title = 'คลิกเพื่อดูรายละเอียดงาน';
            tr.addEventListener('click', () => {
                window.viewTaskDetail(t.id);
            });
            tr.innerHTML = `
                <td><strong>${escapeHtml(t.title)}</strong>${dateText}${qtyText}</td>
                <td>${escapeHtml(displayNames)}</td>
                <td>
                    <span class="status-indicator">
                        <span class="status-dot ${statusClass}"></span>
                        <span>${statusText}</span>
                    </span>
                </td>
            `;
            recentTasksContainer.appendChild(tr);
        });
    }

    // 3. Render Staff Availability
    const staffAvailabilityContainer = document.getElementById('staff-availability-list');
    staffAvailabilityContainer.innerHTML = '';

    getSortedStaff().forEach(s => {
        // Calculate status from assigned ongoing tasks
        const hasOngoingTask = state.tasks.some(t => {
            if (t.status !== 'ongoing') return false;
            const emails = t.assigneeEmails || (t.assigneeEmail ? [t.assigneeEmail.toLowerCase()] : []);
            return emails.map(e => e.toLowerCase()).includes(s.email.toLowerCase());
        });
        const statusText = hasOngoingTask ? 'ติดงาน' : 'ว่าง';

        const isManager = s.position && s.position.includes('ผู้จัดการ');
        const badgeHTML = isManager ? '' : `<span class="badge ${hasOngoingTask ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}">${statusText}</span>`;

        const item = document.createElement('div');
        item.className = 'feed-item';
        item.innerHTML = `
            <div class="feed-user-info">
                <div class="feed-details">
                    <h4>${escapeHtml(s.name)}</h4>
                    <p>${escapeHtml(s.position)}</p>
                </div>
            </div>
            ${badgeHTML}
        `;
        staffAvailabilityContainer.appendChild(item);
    });
}

// ================= RENDER: TASKS =================
function renderTasks() {
    const tbody = document.getElementById('tasks-table-body');
    const filterStatus = document.getElementById('filter-task-status').value;
    tbody.innerHTML = '';

    let filteredTasks = [...state.tasks];
    
    // If not Management, filter to show only tasks assigned to the logged-in staff member
    if (!checkIsManagement()) {
        filteredTasks = filteredTasks.filter(t => {
            const emails = t.assigneeEmails || (t.assigneeEmail ? [t.assigneeEmail.toLowerCase()] : []);
            return emails.map(e => e.toLowerCase()).includes(state.currentUser.email.toLowerCase());
        });
    }

    // Filter by status filter dropdown
    if (filterStatus !== 'all') {
        filteredTasks = filteredTasks.filter(t => t.status === filterStatus);
    }

    if (filteredTasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;">ไม่พบข้อมูลรายการงาน</td></tr>`;
        return;
    }

    filteredTasks.forEach(t => {
        let statusText = 'ยังไม่ดำเนินการ';
        let statusClass = 'pending';
        if (t.status === 'ongoing') { statusText = 'กำลังดำเนินการ'; statusClass = 'ongoing'; }
        else if (t.status === 'completed') { statusText = 'เสร็จสิ้นแล้ว'; statusClass = 'completed'; }

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.title = 'คลิกเพื่อดูรายละเอียดงาน';
        tr.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input')) {
                return;
            }
            window.viewTaskDetail(t.id);
        });
        
        // Define Action buttons based on Role
        let actionButtons = '';
        if (state.currentUser.isAdmin) {
            actionButtons = `<span class="text-muted">โปรดจัดการที่เมนูมอบหมายงาน</span>`;
        } else {
            if (t.status === 'pending') {
                actionButtons = `<button class="btn btn-success btn-small" onclick="updateTaskStatus('${t.id}', 'ongoing')"><i data-lucide="play"></i> เริ่มงาน</button>`;
            } else if (t.status === 'ongoing') {
                if (t.qty && t.qty >= 1) {
                    actionButtons = `
                        <div class="display-flex align-center gap-1">
                            <input type="number" id="progress-qty-${t.id}" class="form-control" style="width: 70px; height: 30px; padding: 2px 6px;" min="0" max="${t.qty}" value="${t.completedQty || 0}">
                            <button class="btn btn-secondary btn-small" onclick="updateTaskProgress('${t.id}')">บันทึก</button>
                            <button class="btn btn-primary btn-small" onclick="completeTaskWithQty('${t.id}')">เสร็จงาน</button>
                        </div>
                    `;
                } else {
                    actionButtons = `<button class="btn btn-primary btn-small" onclick="updateTaskStatus('${t.id}', 'completed')"><i data-lucide="check-square"></i> เสร็จงาน</button>`;
                }
            } else {
                actionButtons = `<span class="text-success"><i data-lucide="check-circle"></i> ปิดงานแล้ว</span>`;
            }
        }

        let qtyText = '';
        if (t.qty && t.qty >= 1) {
            qtyText = `<br><small class="text-muted">ความคืบหน้า: ${t.completedQty || 0} / ${t.qty} หน่วย</small>`;
        }
        
        const dateText = `<br><small class="text-muted"><i data-lucide="calendar" style="width:12px;height:12px;vertical-align:middle;display:inline-block;margin-right:4px;"></i>มอบหมายเมื่อ: ${t.assignedDate || '-'}</small>`;

        const displayNames = t.assigneeNames ? t.assigneeNames.join(', ') : t.assigneeName;

        tr.innerHTML = `
            <td><strong>${escapeHtml(t.title)}</strong>${dateText}${qtyText}</td>
            <td>${escapeHtml(t.desc || '-')}</td>
            <td style="white-space: nowrap;">${escapeHtml(displayNames)}</td>
            <td>
                <span class="status-indicator">
                    <span class="status-dot ${statusClass}"></span>
                    <span>${statusText}</span>
                </span>
            </td>
            <td><div class="gap-2 display-flex">${actionButtons}</div></td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function renderAssignTasks() {
    const tbody = document.getElementById('assign-tasks-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let filteredTasks = [...state.tasks];

    if (filteredTasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-muted" style="text-align:center;">ไม่พบข้อมูลรายการงาน</td></tr>`;
        return;
    }

    filteredTasks.forEach(t => {
        const tr = document.createElement('tr');
        
        let actionButtons = `
            <button class="btn btn-secondary btn-small btn-icon-only" onclick="editTask('${t.id}')" title="แก้ไขงาน"><i data-lucide="edit-3"></i></button>
            <button class="btn btn-danger btn-small btn-icon-only" onclick="deleteTask('${t.id}')" title="ลบงาน"><i data-lucide="trash-2"></i></button>
        `;

        let qtyText = '';
        if (t.qty && t.qty >= 1) {
            qtyText = `<br><small class="text-muted">ความคืบหน้า: ${t.completedQty || 0} / ${t.qty} หน่วย</small>`;
        }

        const displayNames = t.assigneeNames ? t.assigneeNames.join(', ') : t.assigneeName;

        const dateText = `<br><small class="text-muted"><i data-lucide="calendar" style="width:12px;height:12px;vertical-align:middle;display:inline-block;margin-right:4px;"></i>มอบหมายเมื่อ: ${t.assignedDate || '-'}</small>`;

        tr.innerHTML = `
            <td><strong>${escapeHtml(t.title)}</strong>${dateText}${qtyText}</td>
            <td>${escapeHtml(t.desc || '-')}</td>
            <td style="white-space: nowrap;">${escapeHtml(displayNames)}</td>
            <td><div class="gap-2 display-flex">${actionButtons}</div></td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function updateAssigneeCheckboxes(selectedEmails = []) {
    const container = document.getElementById('task-assignees-list');
    if (!container) return;
    container.innerHTML = '';
    
    // Normalize emails to lowercase for comparison
    const normalizedSelected = selectedEmails.map(e => e.toLowerCase());

    getSortedStaff().forEach(s => {
        const div = document.createElement('div');
        div.className = 'assignee-item-div mt-1';
        
        const isChecked = normalizedSelected.includes(s.email.toLowerCase());
        
        div.innerHTML = `
            <input type="checkbox" class="task-assignee-checkbox assignee-item-checkbox" value="${s.email}" id="chk-assignee-${s.id}" ${isChecked ? 'checked' : ''} style="display: none;">
            <label for="chk-assignee-${s.id}" class="assignee-item-label">
                <span class="chk-status" style="color: #10b981; font-weight: bold; margin-right: 8px; font-size: 1.1rem; width: 20px; display: inline-block;">${isChecked ? '✔️' : '　'}</span>
                <span>${s.name} (${s.position})</span>
            </label>
        `;
        
        const checkbox = div.querySelector('input');
        const chkStatus = div.querySelector('.chk-status');
        checkbox.addEventListener('change', () => {
            const checkedCount = container.querySelectorAll('.task-assignee-checkbox:checked').length;
            if (checkedCount > 5) {
                checkbox.checked = false;
                showToast('เลือกผู้รับผิดชอบได้สูงสุด 5 คน', 'error');
                return;
            }
            if (checkbox.checked) {
                chkStatus.textContent = '✔️';
            } else {
                chkStatus.textContent = '　';
            }
        });
        
        container.appendChild(div);
    });
}

// ================= RENDER: STAFF =================
function renderStaff() {
    const tbody = document.getElementById('staff-table-body');
    tbody.innerHTML = '';

    if (state.staff.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;">ไม่มีรายชื่อพนักงาน</td></tr>`;
        return;
    }

    getSortedStaff().forEach(s => {
        const hasOngoingTask = state.tasks.some(t => {
            if (t.status !== 'ongoing') return false;
            const emails = t.assigneeEmails || (t.assigneeEmail ? [t.assigneeEmail.toLowerCase()] : []);
            return emails.map(e => e.toLowerCase()).includes(s.email.toLowerCase());
        });
        const statusText = hasOngoingTask ? 'กำลังปฏิบัติงาน' : 'ว่าง';
        const statusBadgeClass = hasOngoingTask ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success';

        const isManager = s.position && s.position.includes('ผู้จัดการ');
        const statusCell = isManager ? '-' : `<span class="badge ${statusBadgeClass}">${statusText}</span>`;

        const isMgmt = checkIsManagement();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="white-space: nowrap;"><strong>${escapeHtml(s.name)}</strong></td>
            <td>${escapeHtml(s.nickname || '-')}</td>
            <td>${escapeHtml(s.position)}</td>
            <td>${escapeHtml(s.email)}</td>
            <td>${escapeHtml(s.phone || '-')}</td>
            <td>${escapeHtml(s.lineId || '-')}</td>
            <td>${statusCell}</td>
            ${isMgmt ? `
            <td>
                <div class="gap-2" style="display:flex;">
                    <button class="btn btn-secondary btn-small btn-icon-only" onclick="editStaff('${s.id}')" title="แก้ไขข้อมูล"><i data-lucide="edit-3"></i></button>
                    <button class="btn btn-danger btn-small btn-icon-only" onclick="deleteStaff('${s.id}')" title="ลบพนักงาน"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
            ` : ''}
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

// ================= RENDER: QUOTATIONS =================
function renderQuotations() {
    const tbody = document.getElementById('quotations-table-body');
    tbody.innerHTML = '';

    if (state.quotations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;">ไม่มีประวัติใบเสนอราคา</td></tr>`;
        return;
    }

    state.quotations.forEach(q => {
        const formattedTotal = Number(q.total).toLocaleString('th-TH');
        
        let fileBtn = '';
        if (q.fileData) {
            fileBtn = `<a href="${q.fileData}" download="${escapeHtml(q.fileName)}" class="btn btn-secondary btn-small" title="ดาวน์โหลดไฟล์แนบ"><i data-lucide="download"></i> ไฟล์แนบ</a>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(q.code)}</strong></td>
            <td>${escapeHtml(q.customer)}</td>
            <td>${formatThaiDate(q.date)}</td>
            <td>${formattedTotal}</td>
            <td>
                <div class="gap-2" style="display:flex;">
                    ${fileBtn}
                    <button class="btn btn-success btn-small" onclick="viewPrintQuotation('${q.id}')" title="ดู/พิมพ์เอกสาร"><i data-lucide="printer"></i> พิมพ์</button>
                    ${checkIsManagement() ? `
                    <button class="btn btn-secondary btn-small btn-icon-only" onclick="editQuotation('${q.id}')" title="แก้ไข"><i data-lucide="edit-3"></i></button>
                    <button class="btn btn-danger btn-small btn-icon-only" onclick="deleteQuotation('${q.id}')" title="ลบ"><i data-lucide="trash-2"></i></button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

// Helper to trigger proxy email notify (Disabled for tasks)
async function sendEmailNotificationTrigger(toEmail, subject, htmlBody) {
    return;
}

// ================= CRUD: TASKS =================
window.editTask = function(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-desc').value = task.desc || '';
    document.getElementById('task-qty').value = task.qty || 0;
    if (taskDatePicker) taskDatePicker.setDate(task.assignedDate || new Date().toISOString().split('T')[0]);
    
    const emails = task.assigneeEmails || (task.assigneeEmail ? [task.assigneeEmail.toLowerCase()] : []);
    updateAssigneeCheckboxes(emails);
    
    const notifyCheck = document.getElementById('task-notify-email');
    if (notifyCheck) notifyCheck.checked = false; // default false on edit to avoid spam

    document.getElementById('task-modal-title').textContent = 'แก้ไขข้อมูลงาน';
    openModal('task-modal');
};

window.deleteTask = function(id) {
    if (confirm('คุณต้องการลบรายการงานนี้ใช่หรือไม่?')) {
        state.tasks = state.tasks.filter(t => t.id !== id);
        saveDataToLocalStorage();
        renderTasks();
        if (document.getElementById('assign-tasks-table-body')) {
            renderAssignTasks();
        }
        showToast('ลบรายการงานเรียบร้อยแล้ว', 'success');
    }
};

window.updateTaskStatus = function(id, newStatus) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    const oldStatus = task.status;
    task.status = newStatus;
    saveDataToLocalStorage();
    renderTasks();
    if (document.getElementById('assign-tasks-table-body')) {
        renderAssignTasks();
    }
    showToast(`อัปเดตสถานะงานเรียบร้อยแล้ว`, 'success');

};

window.updateTaskProgress = function(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    const inputVal = parseInt(document.getElementById(`progress-qty-${id}`).value) || 0;
    if (inputVal < 0) {
        showToast('จำนวนที่ทำแล้วต้องไม่ติดลบ', 'error');
        return;
    }
    if (inputVal > task.qty) {
        showToast(`จำนวนที่ทำแล้วต้องไม่เกินจำนวนทั้งหมด (${task.qty})`, 'error');
        return;
    }

    const oldStatus = task.status;
    task.completedQty = inputVal;

    if (task.completedQty >= task.qty) {
        task.status = 'completed';
        showToast('อัปเดตความคืบหน้าสำเร็จ และเสร็จสิ้นงานเรียบร้อย', 'success');
    } else {
        showToast(`บันทึกความคืบหน้าแล้ว (${task.completedQty}/${task.qty})`, 'success');
    }

    saveDataToLocalStorage();
    renderTasks();
    if (document.getElementById('assign-tasks-table-body')) {
        renderAssignTasks();
    }
};

window.completeTaskWithQty = function(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    
    task.completedQty = task.qty;
    window.updateTaskStatus(id, 'completed');
};

window.viewTaskDetail = function(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('detail-task-title').textContent = task.title;
    document.getElementById('detail-task-desc').textContent = task.desc || 'ไม่มีรายละเอียดเพิ่มเติม';
    const displayNames = task.assigneeNames ? task.assigneeNames.join(', ') : task.assigneeName;
    document.getElementById('detail-task-assignee').textContent = displayNames;
    document.getElementById('detail-task-date').textContent = task.assignedDate || '-';

    const qtySection = document.getElementById('detail-task-qty-section');
    if (task.qty && task.qty >= 1) {
        qtySection.style.display = 'block';
        document.getElementById('detail-task-qty').textContent = `${task.completedQty || 0} / ${task.qty} หน่วย`;
    } else {
        qtySection.style.display = 'none';
    }

    let statusText = 'ยังไม่ดำเนินการ';
    let statusClass = 'pending';
    if (task.status === 'ongoing') { statusText = 'กำลังดำเนินการ'; statusClass = 'ongoing'; }
    else if (task.status === 'completed') { statusText = 'เสร็จสิ้นแล้ว'; statusClass = 'completed'; }

    document.getElementById('detail-task-status').innerHTML = `
        <span class="status-indicator">
            <span class="status-dot ${statusClass}"></span>
            <span>${statusText}</span>
        </span>
    `;

    openModal('task-detail-modal');
};

// ================= CRUD: STAFF =================
window.editStaff = function(id) {
    const member = state.staff.find(s => s.id === id);
    if (!member) return;

    document.getElementById('staff-id').value = member.id;
    document.getElementById('staff-name').value = member.name;
    document.getElementById('staff-nickname').value = member.nickname || '';
    document.getElementById('staff-position').value = member.position;
    document.getElementById('staff-email').value = member.email;
    document.getElementById('staff-phone').value = member.phone || '';
    document.getElementById('staff-line').value = member.lineId || '';

    document.getElementById('staff-modal-title').textContent = 'แก้ไขข้อมูลพนักงาน';
    openModal('staff-modal');
};

window.deleteStaff = function(id) {
    const member = state.staff.find(s => s.id === id);
    if (!member) return;

    if (confirm(`คุณต้องการลบพนักงาน "${member.name}" ออกจากระบบใช่หรือไม่? (ประวัติงานจะยังคงอยู่)`)) {
        state.staff = state.staff.filter(s => s.id !== id);
        saveDataToLocalStorage();
        renderStaff();
        showToast('ลบข้อมูลพนักงานเรียบร้อยแล้ว', 'success');
    }
};

// ================= CRUD: QUOTATIONS =================
window.editQuotation = function(id) {
    const quote = state.quotations.find(q => q.id === id);
    if (!quote) return;

    document.getElementById('quotation-id').value = quote.id;
    document.getElementById('quote-customer').value = quote.customer;
    if (quoteDatePicker) quoteDatePicker.setDate(quote.date);
    document.getElementById('quote-address').value = quote.address || '';
    document.getElementById('quote-total').value = quote.total;
    document.getElementById('quote-notes').value = quote.notes || '';

    // Load items
    const container = document.getElementById('quote-items-container');
    container.innerHTML = '';
    
    quote.items.forEach(item => {
        addQuotationItemRow(item.desc, item.qty, item.unit);
    });

    tempUploadedFileData = quote.fileData || '';
    tempUploadedFileName = quote.fileName || '';
    document.getElementById('quote-file').value = '';
    document.getElementById('quote-file-status').textContent = quote.fileName ? `ไฟล์แนบปัจจุบัน: ${quote.fileName}` : 'เลือกไฟล์ที่ต้องการแนบเข้ากับใบเสนอราคานี้ (ขนาดไม่เกิน 5MB)';

    openModal('quotation-modal');
};

window.deleteQuotation = function(id) {
    if (confirm('คุณต้องการลบใบเสนอราคานี้ใช่หรือไม่?')) {
        state.quotations = state.quotations.filter(q => q.id !== id);
        saveDataToLocalStorage();
        renderQuotations();
        showToast('ลบใบเสนอราคาเรียบร้อยแล้ว', 'success');
    }
};

function addQuotationItemRow(desc = '', qty = '', unit = '') {
    const container = document.getElementById('quote-items-container');
    const row = document.createElement('div');
    row.className = 'quote-item-row mt-2';
    row.innerHTML = `
        <input type="text" class="form-control item-desc" placeholder="คำอธิบายงาน / สินค้า / บริการ" value="${escapeHtml(desc)}" required>
        <input type="number" class="form-control item-qty" placeholder="จำนวน" min="0.01" step="any" value="${qty}" required>
        <input type="text" class="form-control item-unit" placeholder="หน่วย (เช่น วัน, งาน, ชิ้น)" value="${escapeHtml(unit)}">
        <button type="button" class="btn btn-danger btn-small btn-icon-only btn-remove-row"><i data-lucide="minus"></i></button>
    `;
    
    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        row.remove();
    });

    container.appendChild(row);
    lucide.createIcons();
}

// ================= PRINT & PREVIEW QUOTATION =================
window.viewPrintQuotation = function(id) {
    const quote = state.quotations.find(q => q.id === id);
    if (!quote) return;

    if (quote.fileData) {
        // Direct download of the original file
        const link = document.createElement('a');
        link.href = quote.fileData;
        link.download = quote.fileName || `${quote.code}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('กำลังดาวน์โหลดไฟล์ใบเสนอราคาต้นฉบับ', 'success');
        return;
    }

    const printArea = document.getElementById('print-area');
    document.getElementById('print-modal-title').textContent = 'พิมพ์เอกสารใบเสนอราคา';
    const totalThaiWords = numToThaiWords(quote.total);

    let tableRows = '';
    quote.items.forEach((item, index) => {
        tableRows += `
            <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td>${escapeHtml(item.desc)}</td>
                <td style="text-align: right;">${Number(item.qty).toLocaleString()}</td>
                <td style="text-align: center;">${escapeHtml(item.unit || 'รายการ')}</td>
            </tr>
        `;
    });

    printArea.innerHTML = `
        <div class="doc-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
            <div class="company-info" style="text-align: left;">
                <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700;">บริษัท เอ็นพีที คอนซัลแทนท์ แอนด์ เซอร์วิส จำกัด</h2>
                <p style="margin: 4px 0 0 0; font-size: 0.85rem; font-weight: 600; color: #475569;">NPT Consultant and Service Co., Ltd.</p>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b;">เลขประจำตัวผู้เสียภาษี: 0215560002974</p>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b;">ที่อยู่ : 131/60 หมู่ที่ 2 ต.ทับมา อ.เมืองระยอง จ.ระยอง 21000</p>
                <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b;">โทรศัพท์: 081-996-5444 , 089-113-8844 | อีเมล: nptconsultant2017@gmail.com</p>
            </div>
            <div class="doc-meta" style="text-align: right;">
                <h1 style="margin: 0; font-size: 1.6rem; color: #1e40af; font-weight: 700;">ใบเสนอราคา</h1>
                <p style="margin: 6px 0 0 0; font-size: 0.85rem;"><strong>เลขที่:</strong> ${escapeHtml(quote.code)}</p>
                <p style="margin: 2px 0 0 0; font-size: 0.85rem;"><strong>วันที่:</strong> ${formatThaiDate(quote.date)}</p>
            </div>
        </div>

        <div class="doc-parties">
            <div class="party-box">
                <h3>ลูกค้า / บริษัทผู้ซื้อ</h3>
                <p><strong>ชื่อลูกค้า:</strong> ${escapeHtml(quote.customer)}</p>
                <p><strong>ที่อยู่:</strong> ${escapeHtml(quote.address || 'ไม่ระบุ')}</p>
            </div>
        </div>

        <table class="doc-table">
            <thead>
                <tr>
                    <th style="width: 8%; text-align: center;">ลำดับ</th>
                    <th style="width: 62%;">รายละเอียดสินค้า / บริการ</th>
                    <th style="width: 15%; text-align: right;">จำนวน</th>
                    <th style="width: 15%; text-align: center;">หน่วย</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>

        <div class="doc-footer">
            <div class="doc-notes">
                <h4>เงื่อนไขและหมายเหตุ</h4>
                <p>${escapeHtml(quote.notes || 'ไม่มีหมายเหตุเพิ่มเติม')}</p>
            </div>
            
            <div class="doc-summary">
                <div class="summary-row total-row">
                    <span>ยอดสุทธิทั้งสิ้น</span>
                    <span>${Number(quote.total).toLocaleString('th-TH')} บาท</span>
                </div>
                <div style="font-size: 0.8rem; font-weight: 500; margin-top: 8px; text-align: right; color: #475569;">
                    (${totalThaiWords})
                </div>
            </div>
        </div>

        <div class="doc-signatures">
            <div class="sig-box">
                <p>ในนาม ผู้เสนอราคา</p>
                <div class="sig-line"></div>
                <p>บริษัท เอ็นพีที คอนซัลแทนท์ แอนด์ เซอร์วิส จำกัด</p>
                <p>วันที่เสนอ: ___/___/___</p>
            </div>
            <div class="sig-box">
                <p>ในนาม ผู้ตกลงสั่งซื้อ</p>
                <div class="sig-line"></div>
                <p>ผู้มีอำนาจลงนาม / สั่งซื้อ</p>
                <p>วันที่ตกลง: ___/___/___</p>
            </div>
        </div>
    `;

    openModal('print-modal');
};

// ================= CRUD: PURCHASE REQUISITION (PR) =================
function renderPRs() {
    const tbody = document.getElementById('prs-table-body');
    tbody.innerHTML = '';

    if (state.prs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align:center;">ไม่มีข้อมูลใบขอซื้อ (PR)</td></tr>`;
        return;
    }

    const isMgmt = checkIsManagement();
    const currentUserEmail = state.currentUser ? state.currentUser.email.toLowerCase() : '';

    state.prs.forEach(pr => {
        const estTotalVal = Number(pr.total).toLocaleString('th-TH', {minimumFractionDigits: 2});
        
        let statusBadgeClass = 'badge-pending-approval';
        let statusText = 'ยังไม่พิจารณา';
        if (pr.status === 'approved') {
            statusBadgeClass = 'badge-approved';
            statusText = 'อนุมัติแล้ว';
        } else if (pr.status === 'rejected') {
            statusBadgeClass = 'badge-rejected';
            statusText = 'ไม่อนุมัติ';
        }

        // Check if user is creator of this PR
        const isOwner = pr.requesterEmail.toLowerCase() === currentUserEmail;
        const canEditDelete = (pr.status === 'pending_approval' && isOwner) || isMgmt;

        // Management Approval buttons
        let approvalActions = '';
        if (isMgmt && pr.status === 'pending_approval') {
            approvalActions = `
                <button class="btn btn-success btn-small" onclick="approvePR('${pr.id}')" title="อนุมัติ"><i data-lucide="check"></i> อนุมัติ</button>
                <button class="btn btn-danger btn-small" onclick="rejectPR('${pr.id}')" title="ไม่อนุมัติ"><i data-lucide="x"></i> ปฏิเสธ</button>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(pr.code)}</strong></td>
            <td>${escapeHtml(pr.requesterName)} (${escapeHtml(pr.requesterEmail)})</td>
            <td>${formatThaiDate(pr.date)}</td>
            <td>${estTotalVal} บาท</td>
            <td><span class="status-badge ${statusBadgeClass}">${statusText}</span></td>
            <td>
                <div class="gap-2" style="display:flex; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-small" onclick="viewPrintPR('${pr.id}')" title="พิมพ์/พรีวิว"><i data-lucide="printer"></i> ดู/พิมพ์</button>
                    ${canEditDelete ? `
                        <button class="btn btn-secondary btn-small btn-icon-only" onclick="editPR('${pr.id}')" title="แก้ไข"><i data-lucide="edit-3"></i></button>
                        <button class="btn btn-danger btn-small btn-icon-only" onclick="deletePR('${pr.id}')" title="ลบ"><i data-lucide="trash-2"></i></button>
                    ` : ''}
                    ${approvalActions}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

window.addPRItemRow = function(desc = '', qty = '', unit = '', unitPrice = '') {
    const container = document.getElementById('pr-items-container');
    const row = document.createElement('div');
    row.className = 'quote-item-row mt-2';
    
    const qtyVal = parseFloat(qty) || 0;
    const priceVal = parseFloat(unitPrice) || 0;
    const lineTotal = qtyVal * priceVal;

    row.innerHTML = `
        <input type="text" class="form-control item-desc" placeholder="คำอธิบายสินค้า / บริการ / อุปกรณ์" value="${escapeHtml(desc)}" style="flex: 2.5;" required>
        <input type="number" class="form-control item-qty" placeholder="จำนวน" min="0.01" step="any" value="${qty}" style="flex: 0.8;" required>
        <input type="text" class="form-control item-unit" placeholder="หน่วย" value="${escapeHtml(unit)}" style="flex: 0.8;" required>
        <input type="number" class="form-control item-price" placeholder="ราคาต่อหน่วย" min="0" step="any" value="${unitPrice}" style="flex: 1;" required>
        <input type="number" class="form-control item-line-total" placeholder="ราคารวม" readonly value="${lineTotal ? lineTotal.toFixed(2) : '0.00'}" style="flex: 1.2; background-color: var(--card-bg-hover);">
        <button type="button" class="btn btn-danger btn-small btn-icon-only btn-remove-row" style="flex: 0 0 auto;"><i data-lucide="minus"></i></button>
    `;
    
    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        row.remove();
        calculatePRTotal();
    });

    const qtyInp = row.querySelector('.item-qty');
    const priceInp = row.querySelector('.item-price');
    const totalInp = row.querySelector('.item-line-total');

    function updateLineTotal() {
        const q = parseFloat(qtyInp.value) || 0;
        const p = parseFloat(priceInp.value) || 0;
        totalInp.value = (q * p).toFixed(2);
        calculatePRTotal();
    }

    qtyInp.addEventListener('input', updateLineTotal);
    priceInp.addEventListener('input', updateLineTotal);

    container.appendChild(row);
    lucide.createIcons();
};

function calculatePRTotal() {
    let subtotal = 0;
    document.querySelectorAll('#pr-items-container .quote-item-row').forEach(row => {
        const lineTotal = parseFloat(row.querySelector('.item-line-total').value) || 0;
        subtotal += lineTotal;
    });

    const vatRate = parseFloat(document.getElementById('pr-vat-rate').value) || 0;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    document.getElementById('pr-subtotal-disp').textContent = subtotal.toLocaleString('th-TH', {minimumFractionDigits: 2});
    document.getElementById('pr-vat-disp').textContent = vatAmount.toLocaleString('th-TH', {minimumFractionDigits: 2});
    document.getElementById('pr-total-disp').textContent = total.toLocaleString('th-TH', {minimumFractionDigits: 2});
    document.getElementById('pr-total').value = total.toFixed(2);
}

window.editPR = function(id) {
    const pr = state.prs.find(p => p.id === id);
    if (!pr) return;

    document.getElementById('pr-id').value = pr.id;
    document.getElementById('pr-code').value = pr.code;
    if (prDatePicker) prDatePicker.setDate(pr.date);
    document.getElementById('pr-notes').value = pr.notes || '';
    document.getElementById('pr-vat-rate').value = pr.vatRate !== undefined ? pr.vatRate : 0;
    document.getElementById('pr-total').value = pr.total || 0;
    
    const container = document.getElementById('pr-items-container');
    container.innerHTML = '';
    const items = pr.items || [];
    items.forEach(item => {
        const price = item.unitPrice !== undefined ? item.unitPrice : (item.estPrice !== undefined ? item.estPrice : 0);
        addPRItemRow(item.desc, item.qty, item.unit, price);
    });
    calculatePRTotal();

    document.getElementById('pr-modal-title').textContent = 'แก้ไขใบขอซื้อ (PR)';
    openModal('pr-modal');
};

window.deletePR = function(id) {
    if (confirm('คุณต้องการลบใบขอซื้อนี้ใช่หรือไม่?')) {
        state.prs = state.prs.filter(p => p.id !== id);
        saveDataToLocalStorage();
        renderPRs();
        showToast('ลบใบขอซื้อเรียบร้อยแล้ว', 'success');
    }
};

window.approvePR = function(id) {
    const pr = state.prs.find(p => p.id === id);
    if (!pr) return;

    if (confirm(`คุณต้องการอนุมัติใบขอซื้อ ${pr.code} ใช่หรือไม่?`)) {
        pr.status = 'approved';
        pr.approvedBy = state.currentUser ? state.currentUser.email : 'ผู้จัดการ';
        saveDataToLocalStorage();
        renderPRs();
        showToast(`อนุมัติใบขอซื้อ ${pr.code} เรียบร้อยแล้ว`, 'success');
    }
};

window.rejectPR = function(id) {
    const pr = state.prs.find(p => p.id === id);
    if (!pr) return;

    if (confirm(`คุณต้องการปฏิเสธใบขอซื้อ ${pr.code} ใช่หรือไม่?`)) {
        pr.status = 'rejected';
        saveDataToLocalStorage();
        renderPRs();
        showToast(`ปฏิเสธใบขอซื้อ ${pr.code} เรียบร้อยแล้ว`, 'info');
    }
};

async function handlePRSubmit(e) {
    e.preventDefault();
    
    const prId = document.getElementById('pr-id').value;
    const prDate = document.getElementById('pr-date').value;
    const prNotes = document.getElementById('pr-notes').value.trim();
    
    const items = [];
    document.querySelectorAll('#pr-items-container .quote-item-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const unitPrice = parseFloat(row.querySelector('.item-price').value) || 0;
        items.push({
            desc: row.querySelector('.item-desc').value.trim(),
            qty: qty,
            unit: row.querySelector('.item-unit').value.trim(),
            unitPrice: unitPrice,
            total: qty * unitPrice
        });
    });

    if (items.length === 0) {
        showToast('กรุณากรอกรายการอย่างน้อย 1 รายการ', 'error');
        return;
    }

    let subtotal = 0;
    items.forEach(i => subtotal += i.total);
    const vatRate = parseFloat(document.getElementById('pr-vat-rate').value) || 0;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    if (prId) {
        // Edit Mode
        const pr = state.prs.find(p => p.id === prId);
        if (pr) {
            pr.date = prDate;
            pr.notes = prNotes;
            pr.items = items;
            pr.subtotal = subtotal;
            pr.vatRate = vatRate;
            pr.vatAmount = vatAmount;
            pr.total = total;
        }
        showToast('แก้ไขใบขอซื้อสำเร็จ', 'success');
    } else {
        // Create Mode
        const count = state.prs.length + 1;
        const year = new Date(prDate).getFullYear();
        const code = `PR-${year}-${String(count).padStart(3, '0')}`;
        
        let requesterName = 'พนักงาน';
        const member = state.staff.find(s => s.email.toLowerCase() === state.currentUser.email.toLowerCase());
        if (member) requesterName = member.name;
        else if (state.currentUser.email === 'davezaa1642@gmail.com') requesterName = 'ผู้ดูแลระบบ (เดฟ)';
        else if (state.currentUser.email === 'nptconsultant2017@gmail.com') requesterName = 'ดร.ณภัทร ปุญศิริ';

        state.prs.push({
            id: 'pr-' + Date.now(),
            code: code,
            date: prDate,
            requesterEmail: state.currentUser ? state.currentUser.email : '',
            requesterName: requesterName,
            items: items,
            subtotal: subtotal,
            vatRate: vatRate,
            vatAmount: vatAmount,
            total: total,
            notes: prNotes,
            status: 'pending_approval'
        });
        showToast('ส่งใบขอซื้อเสร็จสิ้น (รอผู้จัดการพิจารณา)', 'success');
    }

    saveDataToLocalStorage();
    closeAllModals();
    renderPRs();
}

window.viewPrintPR = function(id) {
    const pr = state.prs.find(p => p.id === id);
    if (!pr) return;

    const printArea = document.getElementById('print-area');
    document.getElementById('print-modal-title').textContent = 'พิมพ์ใบขอซื้อ (PR)';

    let tableRows = '';
    const items = pr.items || [];
    items.forEach((item, index) => {
        const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.estPrice !== undefined ? item.estPrice : 0);
        const lineTotal = item.qty * unitPrice;
        tableRows += `
            <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td>${escapeHtml(item.desc)}</td>
                <td style="text-align: right;">${Number(item.qty).toLocaleString()}</td>
                <td style="text-align: center;">${escapeHtml(item.unit)}</td>
                <td style="text-align: right;">${Number(unitPrice).toLocaleString('th-TH', {minimumFractionDigits: 2})}</td>
                <td style="text-align: right;">${lineTotal.toLocaleString('th-TH', {minimumFractionDigits: 2})}</td>
            </tr>
        `;
    });

    const statusMap = {
        'pending_approval': 'ยังไม่พิจารณา',
        'approved': 'อนุมัติแล้ว',
        'rejected': 'ไม่อนุมัติ'
    };

        const subtotal = pr.subtotal !== undefined ? pr.subtotal : pr.total;
        const vatRate = pr.vatRate !== undefined ? pr.vatRate : 0;
        const vatAmount = pr.vatAmount !== undefined ? pr.vatAmount : 0;

        printArea.innerHTML = `
        <div class="doc-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
            <div class="company-info" style="text-align: left;">
                <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700;">บริษัท เอ็นพีที คอนซัลแทนท์ แอนด์ เซอร์วิส จำกัด</h2>
                <p style="margin: 4px 0 0 0; font-size: 0.85rem; font-weight: 600; color: #475569;">NPT Consultant and Service Co., Ltd.</p>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b;">เลขประจำตัวผู้เสียภาษี: 0215560002974</p>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b;">ที่อยู่ : 131/60 หมู่ที่ 2 ต.ทับมา อ.เมืองระยอง จ.ระยอง 21000</p>
            </div>
            <div class="doc-meta" style="text-align: right;">
                <h1 style="margin: 0; font-size: 1.6rem; color: #d97706; font-weight: 700;">ใบขอซื้อ (PR)</h1>
                <p style="margin: 6px 0 0 0; font-size: 0.85rem;"><strong>เลขที่:</strong> ${escapeHtml(pr.code)}</p>
                <p style="margin: 2px 0 0 0; font-size: 0.85rem;"><strong>วันที่ขอซื้อ:</strong> ${formatThaiDate(pr.date)}</p>
            </div>
        </div>

        <div class="doc-parties">
            <div class="party-box">
                <h3>ข้อมูลผู้ขอจัดซื้อ</h3>
                <p><strong>ชื่อผู้ขอจัดซื้อ:</strong> ${escapeHtml(pr.requesterName)}</p>
                <p><strong>อีเมล:</strong> ${escapeHtml(pr.requesterEmail)}</p>
                <p><strong>สถานะการอนุมัติ:</strong> ${statusMap[pr.status] || pr.status}</p>
            </div>
        </div>

        <table class="doc-table">
            <thead>
                <tr>
                    <th style="width: 8%; text-align: center;">ลำดับ</th>
                    <th style="width: 42%;">รายการสินค้า / อุปกรณ์ที่ประสงค์สั่งซื้อ</th>
                    <th style="width: 12%; text-align: right;">จำนวน</th>
                    <th style="width: 13%; text-align: center;">หน่วย</th>
                    <th style="width: 12%; text-align: right;">ราคาต่อหน่วย</th>
                    <th style="width: 13%; text-align: right;">รวมเป็นเงิน</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>

        <div class="doc-footer">
            <div class="doc-notes">
                <h4>วัตถุประสงค์ / หมายเหตุเพิ่มเติม</h4>
                <p>${escapeHtml(pr.notes || 'ไม่มีหมายเหตุเพิ่มเติม')}</p>
            </div>
            
            <div class="doc-summary">
                <div class="summary-row">
                    <span>รวมเป็นเงิน (Subtotal)</span>
                    <span>${Number(subtotal).toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท</span>
                </div>
                <div class="summary-row">
                    <span>ภาษีมูลค่าเพิ่ม (VAT ${vatRate}%)</span>
                    <span>${Number(vatAmount).toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท</span>
                </div>
                <div class="summary-row total-row">
                    <span>ประมาณยอดสุทธิทั้งสิ้น</span>
                    <span>${Number(pr.total).toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท</span>
                </div>
            </div>
        </div>

        <div class="doc-signatures" style="margin-top: 50px;">
            <div class="sig-box">
                <p>ผู้ขอซื้อ</p>
                <div class="sig-line"></div>
                <p>(${escapeHtml(pr.requesterName)})</p>
                <p>วันที่: ___/___/___</p>
            </div>
            <div class="sig-box">
                <p>ผู้อนุมัติ (ผู้จัดการ)</p>
                <div class="sig-line"></div>
                <p>(${escapeHtml(pr.approvedBy || '...........................................')})</p>
                <p>วันที่: ___/___/___</p>
            </div>
        </div>
    `;

    openModal('print-modal');
};

// ================= CRUD: PURCHASE ORDER (PO) =================
function renderPOs() {
    const tbody = document.getElementById('pos-table-body');
    tbody.innerHTML = '';

    if (state.pos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align:center;">ไม่มีข้อมูลใบสั่งซื้อ (PO)</td></tr>`;
        return;
    }

    const isMgmt = checkIsManagement();
    const currentUserEmail = state.currentUser ? state.currentUser.email.toLowerCase() : '';

    state.pos.forEach(po => {
        const totalVal = Number(po.total).toLocaleString('th-TH', {minimumFractionDigits: 2});
        
        let statusBadgeClass = 'badge-pending-delivery';
        let statusText = 'รอส่งมอบ';
        if (po.status === 'completed') {
            statusBadgeClass = 'badge-approved';
            statusText = 'ได้รับสินค้าแล้ว';
        } else if (po.status === 'cancelled') {
            statusBadgeClass = 'badge-rejected';
            statusText = 'ยกเลิก';
        }

        const isOwner = po.creatorEmail && po.creatorEmail.toLowerCase() === currentUserEmail;
        const canEditDelete = isOwner || isMgmt;

        let managementActions = '';
        if (canEditDelete) {
            managementActions = `
                <select onchange="updatePOStatus('${po.id}', this.value)" class="form-control" style="width: auto; padding: 2px 6px; font-size: 0.8rem; display: inline-block;">
                    <option value="pending_delivery" ${po.status === 'pending_delivery' ? 'selected' : ''}>รอส่งมอบ</option>
                    <option value="completed" ${po.status === 'completed' ? 'selected' : ''}>ได้รับสินค้าแล้ว</option>
                    <option value="cancelled" ${po.status === 'cancelled' ? 'selected' : ''}>ยกเลิก</option>
                </select>
                <button class="btn btn-secondary btn-small btn-icon-only" onclick="editPO('${po.id}')" title="แก้ไข"><i data-lucide="edit-3"></i></button>
                <button class="btn btn-danger btn-small btn-icon-only" onclick="deletePO('${po.id}')" title="ลบ"><i data-lucide="trash-2"></i></button>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(po.code)}</strong></td>
            <td>${escapeHtml(po.vendor)}</td>
            <td>${formatThaiDate(po.date)}</td>
            <td>${escapeHtml(po.refPrCode || '-')}</td>
            <td>${totalVal} บาท</td>
            <td><span class="status-badge ${statusBadgeClass}">${statusText}</span></td>
            <td>
                <div class="gap-2" style="display:flex; align-items: center;">
                    <button class="btn btn-secondary btn-small" onclick="viewPrintPO('${po.id}')" title="พิมพ์/พรีวิว"><i data-lucide="printer"></i> ดู/พิมพ์</button>
                    ${managementActions}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

window.updatePOStatus = function(id, newStatus) {
    const po = state.pos.find(p => p.id === id);
    if (!po) return;

    po.status = newStatus;
    saveDataToLocalStorage();
    renderPOs();
    showToast(`อัปเดตสถานะใบสั่งซื้อ ${po.code} เรียบร้อยแล้ว`, 'success');
};

window.addPOItemRow = function(desc = '', qty = '', unit = '', unitPrice = '') {
    const container = document.getElementById('po-items-container');
    const row = document.createElement('div');
    row.className = 'quote-item-row mt-2';
    row.innerHTML = `
        <input type="text" class="form-control item-desc" placeholder="คำอธิบายสินค้า / บริการ / อุปกรณ์" value="${escapeHtml(desc)}" style="flex: 2.5;" required>
        <input type="number" class="form-control item-qty" placeholder="จำนวน" min="0.01" step="any" value="${qty}" style="flex: 0.8;" required>
        <input type="text" class="form-control item-unit" placeholder="หน่วย" value="${escapeHtml(unit)}" style="flex: 0.8;" required>
        <input type="number" class="form-control item-price" placeholder="ราคาต่อหน่วย" min="0" step="any" value="${unitPrice}" style="flex: 1;" required>
        <button type="button" class="btn btn-danger btn-small btn-icon-only btn-remove-row" style="flex: 0 0 auto;"><i data-lucide="minus"></i></button>
    `;
    
    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        row.remove();
        calculatePOTotal();
    });

    const qtyInp = row.querySelector('.item-qty');
    const priceInp = row.querySelector('.item-price');
    qtyInp.addEventListener('input', calculatePOTotal);
    priceInp.addEventListener('input', calculatePOTotal);

    container.appendChild(row);
    lucide.createIcons();
};

function calculatePOTotal() {
    let subtotal = 0;
    document.querySelectorAll('#po-items-container .quote-item-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const unitPrice = parseFloat(row.querySelector('.item-price').value) || 0;
        subtotal += qty * unitPrice;
    });

    const vatRate = parseFloat(document.getElementById('po-vat-rate').value) || 0;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    document.getElementById('po-subtotal-disp').textContent = subtotal.toLocaleString('th-TH', {minimumFractionDigits: 2});
    document.getElementById('po-vat-disp').textContent = vatAmount.toLocaleString('th-TH', {minimumFractionDigits: 2});
    document.getElementById('po-total-disp').textContent = total.toLocaleString('th-TH', {minimumFractionDigits: 2});
}

function updateRefPrDropdown() {
    const select = document.getElementById('po-ref-pr');
    select.innerHTML = '<option value="">-- ไม่ต้องการอ้างอิง --</option>';

    // Load only Approved PRs
    const approvedPrs = state.prs.filter(p => p.status === 'approved');
    approvedPrs.forEach(pr => {
        const opt = document.createElement('option');
        opt.value = pr.code;
        opt.textContent = `${pr.code} - ${pr.requesterName} (ยอด ${Number(pr.total).toLocaleString()} บาท)`;
        select.appendChild(opt);
    });
}

window.editPO = function(id) {
    const po = state.pos.find(p => p.id === id);
    if (!po) return;

    updateRefPrDropdown();

    document.getElementById('po-id').value = po.id;
    document.getElementById('po-code').value = po.code;
    if (poDatePicker) poDatePicker.setDate(po.date);
    document.getElementById('po-vendor').value = po.vendor;
    document.getElementById('po-ref-pr').value = po.refPrCode || '';
    document.getElementById('po-address').value = po.vendorAddress || '';
    document.getElementById('po-payment-term').value = po.paymentTerm || 'เงินสด';
    if (poDeliveryDatePicker) poDeliveryDatePicker.setDate(po.deliveryDate || '');
    document.getElementById('po-vat-rate').value = po.vatRate || 0;
    document.getElementById('po-notes').value = po.notes || '';
    
    const container = document.getElementById('po-items-container');
    container.innerHTML = '';
    po.items.forEach(item => {
        addPOItemRow(item.desc, item.qty, item.unit, item.unitPrice);
    });
    calculatePOTotal();

    document.getElementById('po-modal-title').textContent = 'แก้ไขใบสั่งซื้อ (PO)';
    openModal('po-modal');
};

window.deletePO = function(id) {
    if (confirm('คุณต้องการลบใบสั่งซื้อนี้ใช่หรือไม่?')) {
        state.pos = state.pos.filter(p => p.id !== id);
        saveDataToLocalStorage();
        renderPOs();
        showToast('ลบใบสั่งซื้อเรียบร้อยแล้ว', 'success');
    }
};

async function handlePOSubmit(e) {
    e.preventDefault();
    
    const poId = document.getElementById('po-id').value;
    const poDate = document.getElementById('po-date').value;
    const poVendor = document.getElementById('po-vendor').value.trim();
    const poRefPr = document.getElementById('po-ref-pr').value;
    const poAddress = document.getElementById('po-address').value.trim();
    const poPaymentTerm = document.getElementById('po-payment-term').value.trim();
    const poDeliveryDate = document.getElementById('po-delivery-date').value;
    const poVatRate = parseFloat(document.getElementById('po-vat-rate').value) || 0;
    const poNotes = document.getElementById('po-notes').value.trim();
    
    const items = [];
    document.querySelectorAll('#po-items-container .quote-item-row').forEach(row => {
        items.push({
            desc: row.querySelector('.item-desc').value.trim(),
            qty: parseFloat(row.querySelector('.item-qty').value) || 0,
            unit: row.querySelector('.item-unit').value.trim(),
            unitPrice: parseFloat(row.querySelector('.item-price').value) || 0
        });
    });

    if (items.length === 0) {
        showToast('กรุณากรอกรายการอย่างน้อย 1 รายการ', 'error');
        return;
    }

    let subtotal = 0;
    items.forEach(i => subtotal += i.qty * i.unitPrice);
    const vatAmount = subtotal * (poVatRate / 100);
    const total = subtotal + vatAmount;

    if (poId) {
        // Edit Mode
        const po = state.pos.find(p => p.id === poId);
        if (po) {
            po.date = poDate;
            po.vendor = poVendor;
            po.refPrCode = poRefPr;
            po.vendorAddress = poAddress;
            po.paymentTerm = poPaymentTerm;
            po.deliveryDate = poDeliveryDate;
            po.vatRate = poVatRate;
            po.subtotal = subtotal;
            po.vatAmount = vatAmount;
            po.total = total;
            po.items = items;
            po.notes = poNotes;
        }
        showToast('แก้ไขใบสั่งซื้อสำเร็จ', 'success');
    } else {
        // Create Mode
        const count = state.pos.length + 1;
        const year = new Date(poDate).getFullYear();
        const code = `PO-${year}-${String(count).padStart(3, '0')}`;
        
        state.pos.push({
            id: 'po-' + Date.now(),
            code: code,
            date: poDate,
            vendor: poVendor,
            refPrCode: poRefPr,
            vendorAddress: poAddress,
            paymentTerm: poPaymentTerm,
            deliveryDate: poDeliveryDate,
            vatRate: poVatRate,
            subtotal: subtotal,
            vatAmount: vatAmount,
            total: total,
            items: items,
            notes: poNotes,
            creatorEmail: state.currentUser ? state.currentUser.email : '',
            status: 'pending_delivery'
        });
        showToast('สร้างใบสั่งซื้อสำเร็จ', 'success');
    }

    saveDataToLocalStorage();
    closeAllModals();
    renderPOs();
}

window.viewPrintPO = function(id) {
    const po = state.pos.find(p => p.id === id);
    if (!po) return;

    const printArea = document.getElementById('print-area');
    document.getElementById('print-modal-title').textContent = 'พิมพ์ใบสั่งซื้อ (PO)';

    let tableRows = '';
    const items = po.items || [];
    items.forEach((item, index) => {
        const lineTotal = item.qty * item.unitPrice;
        tableRows += `
            <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td>${escapeHtml(item.desc)}</td>
                <td style="text-align: right;">${Number(item.qty).toLocaleString()}</td>
                <td style="text-align: center;">${escapeHtml(item.unit)}</td>
                <td style="text-align: right;">${Number(item.unitPrice).toLocaleString('th-TH', {minimumFractionDigits: 2})}</td>
                <td style="text-align: right;">${lineTotal.toLocaleString('th-TH', {minimumFractionDigits: 2})}</td>
            </tr>
        `;
    });

    const totalThaiWords = numToThaiWords(po.total);

    printArea.innerHTML = `
        <div class="doc-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
            <div class="company-info" style="text-align: left;">
                <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700;">บริษัท เอ็นพีที คอนซัลแทนท์ แอนด์ เซอร์วิส จำกัด</h2>
                <p style="margin: 4px 0 0 0; font-size: 0.85rem; font-weight: 600; color: #475569;">NPT Consultant and Service Co., Ltd.</p>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b;">เลขประจำตัวผู้เสียภาษี: 0215560002974</p>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b;">ที่อยู่ : 131/60 หมู่ที่ 2 ต.ทับมา อ.เมืองระยอง จ.ระยอง 21000</p>
                <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b;">โทรศัพท์: 081-996-5444 , 089-113-8844 | อีเมล: nptconsultant2017@gmail.com</p>
            </div>
            <div class="doc-meta" style="text-align: right;">
                <h1 style="margin: 0; font-size: 1.6rem; color: #0284c7; font-weight: 700;">ใบสั่งซื้อ (PO)</h1>
                <p style="margin: 6px 0 0 0; font-size: 0.85rem;"><strong>เลขที่:</strong> ${escapeHtml(po.code)}</p>
                <p style="margin: 2px 0 0 0; font-size: 0.85rem;"><strong>วันที่สั่งซื้อ:</strong> ${formatThaiDate(po.date)}</p>
            </div>
        </div>

        <div class="doc-parties">
            <div class="party-box" style="width: 50%; float: left; min-height: 100px;">
                <h3>ข้อมูลผู้สั่งซื้อ</h3>
                <p><strong>ผู้สั่งซื้อ:</strong> บริษัท เอ็นพีที คอนซัลแทนท์ แอนด์ เซอร์วิส จำกัด</p>
                <p><strong>เงื่อนไขชำระเงิน:</strong> ${escapeHtml(po.paymentTerm || 'เงินสด')}</p>
                <p><strong>กำหนดส่งมอบ:</strong> ${po.deliveryDate ? formatThaiDate(po.deliveryDate) : 'ไม่ระบุ'}</p>
            </div>
            <div class="party-box" style="width: 48%; float: right; min-height: 100px;">
                <h3>ผู้ขาย / ร้านค้า</h3>
                <p><strong>ร้านค้า:</strong> ${escapeHtml(po.vendor)}</p>
                <p><strong>ที่อยู่:</strong> ${escapeHtml(po.vendorAddress || 'ไม่ระบุ')}</p>
                <p><strong>ใบขอซื้ออ้างอิง:</strong> ${escapeHtml(po.refPrCode || '-')}</p>
            </div>
            <div style="clear: both;"></div>
        </div>

        <table class="doc-table" style="margin-top: 15px;">
            <thead>
                <tr>
                    <th style="width: 8%; text-align: center;">ลำดับ</th>
                    <th style="width: 42%;">รายละเอียดสินค้า / บริการ / อุปกรณ์</th>
                    <th style="width: 12%; text-align: right;">จำนวน</th>
                    <th style="width: 13%; text-align: center;">หน่วย</th>
                    <th style="width: 12%; text-align: right;">ราคาต่อหน่วย</th>
                    <th style="width: 13%; text-align: right;">รวมเป็นเงิน</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>

        <div class="doc-footer">
            <div class="doc-notes">
                <h4>หมายเหตุเพิ่มเติม</h4>
                <p>${escapeHtml(po.notes || 'ไม่มีหมายเหตุเพิ่มเติม')}</p>
            </div>
            
            <div class="doc-summary">
                <div class="summary-row">
                    <span>รวมราคาสินค้า (Subtotal)</span>
                    <span>${Number(po.subtotal).toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท</span>
                </div>
                <div class="summary-row">
                    <span>ภาษีมูลค่าเพิ่ม VAT (${po.vatRate}%)</span>
                    <span>${Number(po.vatAmount).toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท</span>
                </div>
                <div class="summary-row total-row">
                    <span>ยอดสุทธิทั้งสิ้น</span>
                    <span>${Number(po.total).toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท</span>
                </div>
                <div style="font-size: 0.8rem; font-weight: 500; margin-top: 8px; text-align: right; color: #475569;">
                    (${totalThaiWords})
                </div>
            </div>
        </div>

        <div class="doc-signatures" style="margin-top: 50px;">
            <div class="sig-box">
                <p>ผู้สั่งซื้อ (ดร.ณภัทร ปุญศิริ)</p>
                <div class="sig-line"></div>
                <p>General Manager</p>
                <p>วันที่: ___/___/___</p>
            </div>
            <div class="sig-box">
                <p>ผู้อนุมัติ</p>
                <div class="sig-line"></div>
                <p>ตำแหน่ง</p>
                <div class="sig-line"></div>
                <p>วันที่: ___/___/___</p>
            </div>
        </div>
    `;

    openModal('print-modal');
};

// ================= EVENT LISTENERS =================
function setupEventListeners() {
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    document.getElementById('btn-request-otp').addEventListener('click', requestOTP);
    document.getElementById('btn-verify-otp').addEventListener('click', verifyOTP);
    document.getElementById('btn-back-to-phone').addEventListener('click', () => {
        document.getElementById('phone-view').classList.remove('hidden');
        document.getElementById('otp-view').classList.add('hidden');
    });
    document.getElementById('btn-logout').addEventListener('click', logout);

    document.getElementById('login-email').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') requestOTP();
    });
    document.getElementById('login-otp').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verifyOTP();
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(item.dataset.tab);
        });
    });

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeAllModals();
        }
    });

    document.getElementById('btn-open-task-modal').addEventListener('click', () => {
        document.getElementById('task-form').reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-qty').value = 0;
        if (taskDatePicker) taskDatePicker.setDate(new Date().toISOString().split('T')[0]);
        updateAssigneeCheckboxes([]);
        document.getElementById('task-modal-title').textContent = 'มอบหมายงานใหม่';
        openModal('task-modal');
    });

    document.getElementById('btn-open-staff-modal').addEventListener('click', () => {
        document.getElementById('staff-form').reset();
        document.getElementById('staff-id').value = '';
        document.getElementById('staff-modal-title').textContent = 'เพิ่มพนักงานใหม่';
        openModal('staff-modal');
    });

    document.getElementById('btn-open-quotation-modal').addEventListener('click', () => {
        document.getElementById('quotation-form').reset();
        document.getElementById('quotation-id').value = '';
        document.getElementById('quote-items-container').innerHTML = '';
        addQuotationItemRow();
        if (quoteDatePicker) quoteDatePicker.setDate(new Date().toISOString().split('T')[0]);
        
        tempUploadedFileData = '';
        tempUploadedFileName = '';
        document.getElementById('quote-file').value = '';
        document.getElementById('quote-file-status').textContent = 'เลือกไฟล์ที่ต้องการแนบเข้ากับใบเสนอราคานี้ (ขนาดไม่เกิน 5MB)';
        
        openModal('quotation-modal');
    });

    document.getElementById('btn-add-quote-row').addEventListener('click', () => {
        addQuotationItemRow();
    });

    document.getElementById('filter-task-status').addEventListener('change', () => {
        renderTasks();
    });

    document.getElementById('quote-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            tempUploadedFileData = '';
            tempUploadedFileName = '';
            document.getElementById('quote-file-status').textContent = 'เลือกไฟล์ที่ต้องการแนบเข้ากับใบเสนอราคานี้ (ขนาดไม่เกิน 5MB)';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('ขนาดไฟล์แนบต้องไม่เกิน 5MB', 'error');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(evt) {
            tempUploadedFileData = evt.target.result;
            tempUploadedFileName = file.name;
            document.getElementById('quote-file-status').textContent = `แนบไฟล์สำเร็จ: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
        };
        reader.readAsDataURL(file);
    });





    // PR and PO Event Listeners
    document.getElementById('btn-open-pr-modal').addEventListener('click', () => {
        document.getElementById('pr-form').reset();
        document.getElementById('pr-id').value = '';
        document.getElementById('pr-items-container').innerHTML = '';
        addPRItemRow();
        if (prDatePicker) prDatePicker.setDate(new Date().toISOString().split('T')[0]);
        document.getElementById('pr-total').value = '0.00';
        document.getElementById('pr-modal-title').textContent = 'สร้างใบขอซื้อใหม่ (PR)';
        openModal('pr-modal');
    });

    document.getElementById('btn-add-pr-row').addEventListener('click', () => {
        addPRItemRow();
    });

    document.getElementById('pr-vat-rate').addEventListener('change', calculatePRTotal);

    document.getElementById('btn-open-po-modal').addEventListener('click', () => {
        document.getElementById('po-form').reset();
        document.getElementById('po-id').value = '';
        document.getElementById('po-items-container').innerHTML = '';
        updateRefPrDropdown();
        addPOItemRow();
        if (poDatePicker) poDatePicker.setDate(new Date().toISOString().split('T')[0]);
        if (poDeliveryDatePicker) poDeliveryDatePicker.setDate('');
        calculatePOTotal();
        document.getElementById('po-modal-title').textContent = 'สร้างใบสั่งซื้อใหม่ (PO)';
        openModal('po-modal');
    });

    document.getElementById('btn-add-po-row').addEventListener('click', () => {
        addPOItemRow();
    });

    document.getElementById('po-vat-rate').addEventListener('change', calculatePOTotal);

    document.getElementById('po-ref-pr').addEventListener('change', (e) => {
        const prCode = e.target.value;
        if (!prCode) return;
        
        const pr = state.prs.find(p => p.code === prCode);
        if (!pr) return;

        // Auto copy items from PR to PO!
        const container = document.getElementById('po-items-container');
        container.innerHTML = '';
        
        pr.items.forEach(item => {
            const price = item.unitPrice !== undefined ? item.unitPrice : (item.estPrice !== undefined ? item.estPrice : 0);
            addPOItemRow(item.desc, item.qty, item.unit, price);
        });
        
        calculatePOTotal();
        showToast(`คัดลอกรายการสินค้าจาก ${pr.code} เรียบร้อยแล้ว`, 'success');
    });

    document.getElementById('btn-open-equipment-modal').addEventListener('click', () => {
        document.getElementById('equipment-form').reset();
        document.getElementById('equipment-id').value = '';
        document.getElementById('equipment-modal-title').textContent = 'เพิ่มอุปกรณ์ใหม่';
        openModal('equipment-modal');
    });

    document.getElementById('task-form').addEventListener('submit', handleTaskSubmit);
    document.getElementById('staff-form').addEventListener('submit', handleStaffSubmit);
    document.getElementById('quotation-form').addEventListener('submit', handleQuotationSubmit);
    document.getElementById('pr-form').addEventListener('submit', handlePRSubmit);
    document.getElementById('po-form').addEventListener('submit', handlePOSubmit);
    document.getElementById('equipment-form').addEventListener('submit', handleEquipmentSubmit);
}

// ================= FORM SUBMISSION HANDLERS =================
async function handleTaskSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value.trim();
    const desc = document.getElementById('task-desc').value.trim();
    
    // Get checked assignees from checkboxes
    const checkedCheckboxes = document.querySelectorAll('.task-assignee-checkbox:checked');
    const assigneeEmails = Array.from(checkedCheckboxes).map(chk => chk.value.toLowerCase());
    
    if (assigneeEmails.length === 0) {
        showToast('กรุณาเลือกผู้รับผิดชอบงานอย่างน้อย 1 คน', 'error');
        return;
    }
    
    const assigneeNames = assigneeEmails.map(email => {
        const staffMember = state.staff.find(s => s.email.toLowerCase() === email);
        return staffMember ? staffMember.name : email;
    });

    // Single-assignee fallbacks for backward compatibility
    const assigneeEmail = assigneeEmails[0];
    const assigneeName = assigneeNames[0];

    const qty = parseInt(document.getElementById('task-qty').value) || 0;
    const assignedDate = document.getElementById('task-date').value || new Date().toISOString().split('T')[0];

    if (id) {
        // Edit Mode
        const task = state.tasks.find(t => t.id === id);
        if (task) {
            task.title = title;
            task.desc = desc;
            task.assigneeEmail = assigneeEmail;
            task.assigneeName = assigneeName;
            task.assigneeEmails = assigneeEmails;
            task.assigneeNames = assigneeNames;
            task.qty = qty;
            task.assignedDate = assignedDate;
            if (task.completedQty === undefined) task.completedQty = 0;
            // Mark as unread for the assignees
            task.unreadBy = [...assigneeEmails];
        }
    } else {
        // Add Mode
        const newTask = {
            id: 'tk-' + Date.now(),
            title,
            desc,
            assigneeEmail,
            assigneeName,
            assigneeEmails,
            assigneeNames,
            status: 'pending',
            qty: qty,
            completedQty: 0,
            assignedDate: assignedDate,
            unreadBy: [...assigneeEmails]
        };
        state.tasks.push(newTask);
    }

    saveDataToLocalStorage();
    closeAllModals();
    renderTasks();
    if (document.getElementById('assign-tasks-table-body')) {
        renderAssignTasks();
    }
    showToast('บันทึกข้อมูลงานเรียบร้อยแล้ว', 'success');
}

function handleStaffSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('staff-id').value;
    const name = document.getElementById('staff-name').value.trim();
    const nickname = document.getElementById('staff-nickname').value.trim();
    const position = document.getElementById('staff-position').value.trim();
    const phone = document.getElementById('staff-phone').value.trim();
    const lineId = document.getElementById('staff-line').value.trim();
    const email = document.getElementById('staff-email').value.trim().toLowerCase();

    if (!email || !email.includes('@')) {
        showToast('กรุณากรอก Gmail ให้ถูกต้อง', 'error');
        return;
    }

    if (id) {
        // Edit Mode
        const member = state.staff.find(s => s.id === id);
        if (member) {
            const oldEmail = member.email;
            member.name = name;
            member.nickname = nickname;
            member.position = position;
            member.email = email;
            member.phone = phone;
            member.lineId = lineId;

            // Reflect email change in tasks
            state.tasks.forEach(t => {
                if (t.assigneeEmail === oldEmail) {
                    t.assigneeEmail = email;
                    t.assigneeName = name;
                }
            });
        }
    } else {
        // Check duplication
        if (state.staff.some(s => s.email.toLowerCase() === email)) {
            showToast('อีเมลนี้ถูกใช้ระบบในฐานข้อมูลแล้ว', 'error');
            return;
        }

        const newStaff = {
            id: 'st-' + Date.now(),
            name,
            nickname,
            position,
            email,
            phone,
            lineId,
            status: 'ว่าง'
        };
        state.staff.push(newStaff);
    }

    saveDataToLocalStorage();
    closeAllModals();
    renderStaff();
    setupUserRoleUI();
    showToast('บันทึกข้อมูลพนักงานเรียบร้อยแล้ว', 'success');
}

function handleQuotationSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('quotation-id').value;
    const customer = document.getElementById('quote-customer').value.trim();
    const date = document.getElementById('quote-date').value;
    const address = document.getElementById('quote-address').value.trim();
    const total = parseFloat(document.getElementById('quote-total').value);
    const notes = document.getElementById('quote-notes').value.trim();

    const itemRows = document.querySelectorAll('.quote-item-row');
    const items = [];
    itemRows.forEach(row => {
        const desc = row.querySelector('.item-desc').value.trim();
        const qty = parseFloat(row.querySelector('.item-qty').value);
        const unit = row.querySelector('.item-unit').value.trim();
        
        if (desc && qty) {
            items.push({ desc, qty, unit });
        }
    });

    if (items.length === 0) {
        showToast('กรุณากรอกรายการอย่างน้อย 1 รายการ', 'error');
        return;
    }

    if (id) {
        const quote = state.quotations.find(q => q.id === id);
        if (quote) {
            quote.customer = customer;
            quote.date = date;
            quote.address = address;
            quote.total = total;
            quote.notes = notes;
            quote.items = items;
            quote.fileData = tempUploadedFileData;
            quote.fileName = tempUploadedFileName;
        }
    } else {
        const currentYear = new Date(date).getFullYear();
        const runningNo = String(state.quotations.length + 1).padStart(3, '0');
        const code = `QT-${currentYear}-${runningNo}`;

        const newQuote = {
            id: 'qt-' + Date.now(),
            code,
            customer,
            date,
            address,
            items,
            total,
            notes,
            fileData: tempUploadedFileData,
            fileName: tempUploadedFileName
        };
        state.quotations.push(newQuote);
    }

    saveDataToLocalStorage();
    closeAllModals();
    renderQuotations();
    showToast('บันทึกเอกสารใบเสนอราคาเรียบร้อยแล้ว', 'success');
}

// ================= MODAL OPERATIONS =================
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    lucide.createIcons();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.add('hidden');
    });
}

// ================= HELPER FUNCTIONS =================
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getInitials(name) {
    if (!name) return 'N';
    const split = name.split(' ');
    if (split.length >= 2) {
        return split[0].charAt(0) + split[1].charAt(0);
    }
    return name.charAt(0);
}

function formatThaiDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric', locale: 'th-TH' };
    return date.toLocaleDateString('th-TH', options);
}

// Thai Currency Word Converter (Converts numbers to Thai Text for invoice)
function numToThaiWords(amount) {
    const numbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    
    let [baht, satang] = amount.toString().split('.');
    let bahtText = '';
    
    if (baht === '0' || !baht) {
        bahtText = 'ศูนย์';
    } else {
        const len = baht.length;
        for (let i = 0; i < len; i++) {
            const digit = parseInt(baht.charAt(i));
            const pos = len - i - 1;
            
            if (digit !== 0) {
                if (pos === 1 && digit === 2) {
                    bahtText += 'ยี่';
                } else if (pos === 1 && digit === 1) {
                    bahtText += '';
                } else if (pos === 0 && digit === 1 && len > 1) {
                    bahtText += 'เอ็ด';
                } else {
                    bahtText += numbers[digit];
                }
                bahtText += positions[pos];
            }
        }
    }
    
    bahtText += 'บาทถ้วน';
    return bahtText;
}

// ================= NEW TASK POP-UP NOTIFICATIONS =================
let pendingNotifications = [];

function checkNewTaskNotifications() {
    if (!state.currentUser || state.currentUser.isAdmin) return;
    
    // Find tasks that are assigned to this user and not yet read
    pendingNotifications = state.tasks.filter(t => 
        t.unreadBy && t.unreadBy.map(e => e.toLowerCase()).includes(state.currentUser.email.toLowerCase())
    );
    
    if (pendingNotifications.length > 0) {
        showNextPendingNotification();
    }
}

function showNextPendingNotification() {
    if (pendingNotifications.length === 0) return;
    
    const task = pendingNotifications[0];
    const container = document.getElementById('notif-task-content');
    if (!container) return;
    
    container.innerHTML = `
        <h4 style="margin: 0 0 8px 0; font-weight: 700; color: #fff;">${escapeHtml(task.title)}</h4>
        <p style="margin: 0; font-size: 0.9rem; color: #cbd5e1; white-space: pre-wrap;">${escapeHtml(task.desc || 'ไม่มีรายละเอียดเพิ่มเติม')}</p>
        <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #10b981; font-weight: 600;">
            <strong>วันที่ได้รับมอบหมาย:</strong> ${task.assignedDate || '-'}
        </p>
    `;
    
    openModal('new-task-notification-modal');
    
    // Bind click to acknowledge
    const ackBtn = document.getElementById('btn-ack-notif');
    if (ackBtn) {
        // Clear old listeners
        const newAckBtn = ackBtn.cloneNode(true);
        ackBtn.parentNode.replaceChild(newAckBtn, ackBtn);
        
        newAckBtn.addEventListener('click', () => {
            // Mark as read in state
            const originalTask = state.tasks.find(t => t.id === task.id);
            if (originalTask && originalTask.unreadBy) {
                originalTask.unreadBy = originalTask.unreadBy.filter(email => email.toLowerCase() !== state.currentUser.email.toLowerCase());
                saveDataToLocalStorage();
            }
            
            closeModal('new-task-notification-modal');
            pendingNotifications.shift();
            
            // Show next if any
            if (pendingNotifications.length > 0) {
                setTimeout(showNextPendingNotification, 300);
            }
        });
    }
}

// ================= GLOBAL NAVIGATION HELPERS =================
window.navigateToTasks = function(filter = 'all') {
    switchTab('tasks');
    const filterSelect = document.getElementById('filter-task-status');
    if (filterSelect) {
        filterSelect.value = filter;
        renderTasks();
    }
};

window.navigateToQuotations = function() {
    switchTab('quotations');
};

window.navigateToStaff = function() {
    switchTab('staff');
};

// ================= CRUD: EQUIPMENT INVENTORY =================
function renderEquipments() {
    const tbody = document.getElementById('equipment-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!state.equipments || state.equipments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align:center;">ไม่มีข้อมูลอุปกรณ์ของบริษัท</td></tr>`;
        return;
    }

    const isMgmt = checkIsManagement();

    state.equipments.forEach(eq => {
        const tr = document.createElement('tr');
        
        let statusClass = eq.status === 'ปกติ' ? 'text-success' : 'text-danger';
        let locationClass = eq.location === 'หน้างาน' ? 'badge-pending-approval' : 'badge-completed';

        let managementActions = '';
        if (isMgmt) {
            managementActions = `
                <button class="btn btn-secondary btn-small btn-icon-only" onclick="editEquipment('${eq.id}')" title="แก้ไข"><i data-lucide="edit-3"></i></button>
                <button class="btn btn-danger btn-small btn-icon-only" onclick="deleteEquipment('${eq.id}')" title="ลบ"><i data-lucide="trash-2"></i></button>
            `;
        } else {
            managementActions = `<span class="text-muted">-</span>`;
        }

        tr.innerHTML = `
            <td><strong>${escapeHtml(eq.name)}</strong></td>
            <td>${Number(eq.qty).toLocaleString()} ชิ้น</td>
            <td><span class="${statusClass}" style="font-weight:600;">${escapeHtml(eq.status)}</span></td>
            <td><span class="status-badge ${locationClass}">${escapeHtml(eq.location)}</span></td>
            <td>${escapeHtml(eq.notes || '-')}</td>
            <td class="admin-only">${managementActions}</td>
        `;
        tbody.appendChild(tr);
    });

    if (!isMgmt) {
        document.querySelectorAll('#tab-equipment .admin-only').forEach(el => el.classList.add('hidden'));
    } else {
        document.querySelectorAll('#tab-equipment .admin-only').forEach(el => el.classList.remove('hidden'));
    }

    lucide.createIcons();
}

window.editEquipment = function(id) {
    const eq = state.equipments.find(e => e.id === id);
    if (!eq) return;

    document.getElementById('equipment-id').value = eq.id;
    document.getElementById('equipment-name').value = eq.name;
    document.getElementById('equipment-qty').value = eq.qty;
    document.getElementById('equipment-status').value = eq.status;
    document.getElementById('equipment-location').value = eq.location;
    document.getElementById('equipment-notes').value = eq.notes || '';

    document.getElementById('equipment-modal-title').textContent = 'แก้ไขข้อมูลอุปกรณ์';
    openModal('equipment-modal');
};

window.deleteEquipment = function(id) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบอุปกรณ์นี้?')) return;
    
    state.equipments = state.equipments.filter(e => e.id !== id);
    saveDataToLocalStorage();
    renderEquipments();
    showToast('ลบอุปกรณ์เรียบร้อยแล้ว', 'success');
};

async function handleEquipmentSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('equipment-id').value;
    const name = document.getElementById('equipment-name').value.trim();
    const qty = parseInt(document.getElementById('equipment-qty').value) || 1;
    const status = document.getElementById('equipment-status').value;
    const location = document.getElementById('equipment-location').value;
    const notes = document.getElementById('equipment-notes').value.trim();

    if (id) {
        // Edit Mode
        const eq = state.equipments.find(e => e.id === id);
        if (eq) {
            eq.name = name;
            eq.qty = qty;
            eq.status = status;
            eq.location = location;
            eq.notes = notes;
        }
        showToast('แก้ไขข้อมูลอุปกรณ์สำเร็จ', 'success');
    } else {
        // Create Mode
        state.equipments.push({
            id: 'eq-' + Date.now(),
            name: name,
            qty: qty,
            status: status,
            location: location,
            notes: notes
        });
        showToast('เพิ่มอุปกรณ์ใหม่สำเร็จ', 'success');
    }

    saveDataToLocalStorage();
    closeAllModals();
    renderEquipments();
}

