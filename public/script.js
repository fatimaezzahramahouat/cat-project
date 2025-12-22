// ============ CONFIGURATION ============
const API_BASE = '';
let currentUser = null;

// ============ AUTH FUNCTIONS ============

// فتح نافذة المصادقة
function openAuthModal(type = 'login') {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    
    const title = document.getElementById('authModalTitle');
    const form = document.getElementById('authForm');
    const switchText = document.getElementById('authSwitchText');
    const switchLink = document.getElementById('authSwitchLink');
    
    if (type === 'login') {
        title.textContent = 'تسجيل الدخول';
        form.innerHTML = `
            <div class="form-group">
                <label for="authEmail"><i class="fas fa-envelope"></i> البريد الإلكتروني</label>
                <input type="email" id="authEmail" class="cyber-input" placeholder="أدخل بريدك الإلكتروني" required />
            </div>
            <div class="form-group">
                <label for="authPassword"><i class="fas fa-lock"></i> كلمة المرور</label>
                <input type="password" id="authPassword" class="cyber-input" placeholder="أدخل كلمة المرور" required />
            </div>
            <button type="submit" class="cyber-btn primary full-width">
                <i class="fas fa-sign-in-alt"></i> تسجيل الدخول
            </button>
        `;
        switchText.textContent = 'ليس لديك حساب؟';
        switchLink.textContent = 'إنشاء حساب';
        switchLink.onclick = () => openAuthModal('register');
    } else {
        title.textContent = 'إنشاء حساب جديد';
        form.innerHTML = `
            <div class="form-group">
                <label for="authUsername"><i class="fas fa-user"></i> اسم المستخدم</label>
                <input type="text" id="authUsername" class="cyber-input" placeholder="اختر اسم مستخدم" required />
            </div>
            <div class="form-group">
                <label for="authEmail"><i class="fas fa-envelope"></i> البريد الإلكتروني</label>
                <input type="email" id="authEmail" class="cyber-input" placeholder="أدخل بريدك الإلكتروني" required />
            </div>
            <div class="form-group">
                <label for="authPassword"><i class="fas fa-lock"></i> كلمة المرور</label>
                <input type="password" id="authPassword" class="cyber-input" placeholder="أدخل كلمة مرور قوية" required minlength="6" />
            </div>
            <div class="form-group">
                <label for="authConfirm"><i class="fas fa-lock"></i> تأكيد كلمة المرور</label>
                <input type="password" id="authConfirm" class="cyber-input" placeholder="أعد إدخال كلمة المرور" required minlength="6" />
            </div>
            <button type="submit" class="cyber-btn primary full-width">
                <i class="fas fa-user-plus"></i> إنشاء حساب
            </button>
        `;
        switchText.textContent = 'لديك حساب بالفعل؟';
        switchLink.textContent = 'تسجيل الدخول';
        switchLink.onclick = () => openAuthModal('login');
    }
    
    modal.style.display = 'flex';
}

// إغلاق نافذة المصادقة
function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('authForm').reset();
    }
}

// إرسال نموذج المصادقة
async function submitAuth(event) {
    event.preventDefault();
    
    const type = document.getElementById('authModalTitle').textContent === 'تسجيل الدخول' ? 'login' : 'register';
    
    if (type === 'login') {
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        
        if (!email || !password) {
            showNotification('⚠️ المرجو إدخال جميع الحقول', 'warning');
            return;
        }
        
        await login(email, password);
    } else {
        const username = document.getElementById('authUsername').value.trim();
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        const confirmPassword = document.getElementById('authConfirm').value;
        
        if (!username || !email || !password || !confirmPassword) {
            showNotification('⚠️ المرجو إدخال جميع الحقول', 'warning');
            return;
        }
        
        if (password !== confirmPassword) {
            showNotification('⚠️ كلمتا المرور غير متطابقتين', 'warning');
            return;
        }
        
        if (password.length < 6) {
            showNotification('⚠️ كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'warning');
            return;
        }
        
        await register(username, email, password);
    }
}

// تسجيل الدخول
async function login(email, password) {
    showNotification('جاري تسجيل الدخول...', 'info');
    
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ تم تسجيل الدخول بنجاح!', 'success');
            closeAuthModal();
            await checkAuth();
        } else {
            showNotification(`❌ ${data.error || 'فشل تسجيل الدخول'}`, 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('❌ خطأ في الشبكة. المرجو المحاولة مرة أخرى.', 'error');
    }
}

// تسجيل حساب جديد
async function register(username, email, password) {
    showNotification('جاري إنشاء الحساب...', 'info');
    
    try {
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ تم إنشاء الحساب بنجاح! المرجو تسجيل الدخول.', 'success');
            openAuthModal('login');
        } else {
            showNotification(`❌ ${data.error || 'فشل إنشاء الحساب'}`, 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('❌ خطأ في الشبكة. المرجو المحاولة مرة أخرى.', 'error');
    }
}

// تسجيل الخروج
async function logout() {
    try {
        const response = await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            currentUser = null;
            updateUIForLoggedOutUser();
            showNotification('✅ تم تسجيل الخروج بنجاح', 'success');
            navigateToHome();
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// التحقق من حالة المصادقة
async function checkAuth() {
    try {
        const response = await fetch('/api/me', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const userData = await response.json();
            currentUser = userData;
            updateUIForLoggedInUser(userData);
            return true;
        } else {
            currentUser = null;
            updateUIForLoggedOutUser();
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        currentUser = null;
        updateUIForLoggedOutUser();
        return false;
    }
}

// تحديث الواجهة عند تسجيل الدخول
function updateUIForLoggedInUser(user) {
    // تحديث شريط التنقل
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const addCatBtn = document.getElementById('addCatBtn');
    
    if (authButtons) authButtons.style.display = 'none';
    if (userMenu) {
        userMenu.style.display = 'block';
        document.getElementById('usernameDisplay').textContent = user.username;
    }
    if (addCatBtn) addCatBtn.style.display = 'inline-block';
}

// تحديث الواجهة عند تسجيل الخروج
function updateUIForLoggedOutUser() {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const addCatBtn = document.getElementById('addCatBtn');
    
    if (authButtons) authButtons.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
    if (addCatBtn) addCatBtn.style.display = 'none';
}

// التنقل للوحة التحكم
async function navigateToDashboard() {
    try {
        const response = await fetch('/dashboard', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            showDashboard(data);
        } else {
            showNotification('⚠️ المرجو تسجيل الدخول للوصول للوحة التحكم', 'warning');
            openAuthModal();
        }
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

function showDashboard(data) {
    // تحديث الصفحة لعرض لوحة التحكم
    const mainContainer = document.querySelector('.cyber-main-container');
    if (!mainContainer) return;
    
    mainContainer.innerHTML = `
        <section id="dashboard" class="cyber-section active">
            <div class="terminal-header">
                <h1><i class="fas fa-user-circle"></i> لوحة التحكم</h1>
                <p>مرحباً بك، <span class="username-highlight">${data.user.username}</span>!</p>
                <div class="terminal-status">
                    <span class="status-dot online"></span>
                    حالة: متصل
                </div>
            </div>
            
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <div class="card-header">
                        <i class="fas fa-user"></i>
                        <h3>معلومات الحساب</h3>
                    </div>
                    <div class="card-content">
                        <div class="info-item">
                            <span class="info-label">اسم المستخدم:</span>
                            <span class="info-value">${data.user.username}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">البريد الإلكتروني:</span>
                            <span class="info-value">${data.user.email}</span>
                        </div>
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <div class="card-header">
                        <i class="fas fa-cat"></i>
                        <h3>قططي</h3>
                    </div>
                    <div class="card-content">
                        <div id="myCatsList" class="cats-list">
                            ${data.cats.length > 0 ? 
                                data.cats.map(cat => `
                                    <div class="cat-item">
                                        <h4>${cat.name}</h4>
                                        <p>${cat.description || 'لا يوجد وصف'}</p>
                                    </div>
                                `).join('') :
                                '<p class="no-data">لا توجد قطط بعد</p>'
                            }
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="dashboard-actions">
                <button onclick="loadCats()" class="cyber-btn secondary">
                    <i class="fas fa-sync"></i> تحديث القطط
                </button>
                <button onclick="logout()" class="cyber-btn danger">
                    <i class="fas fa-sign-out-alt"></i> تسجيل الخروج
                </button>
            </div>
        </section>
    `;
}

// التنقل للصفحة الرئيسية
function navigateToHome() {
    window.location.href = '/';
}

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', async function () {
    console.log("📄 جاري تحميل الصفحة...");
    
    // إعداد المستمعين للأحداث
    document.getElementById('authForm')?.addEventListener('submit', submitAuth);
    document.getElementById('loginBtn')?.addEventListener('click', () => openAuthModal('login'));
    document.getElementById('signupBtn')?.addEventListener('click', () => openAuthModal('register'));
    document.getElementById('dashboardBtn')?.addEventListener('click', navigateToDashboard);
    
    // إغلاق النافذة عند الضغط خارجها
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('authModal');
        if (event.target === modal) {
            closeAuthModal();
        }
    });
    
    // إغلاق النافذة بالزر Escape
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeAuthModal();
        }
    });
    
    // التحقق من حالة المصادقة عند التحميل
    await checkAuth();
    
    // تحميل القطط
    loadCats();
});

// جعل الدوال متاحة عالمياً
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.submitAuth = submitAuth;
window.checkAuth = checkAuth;
window.logout = logout;
window.navigateToDashboard = navigateToDashboard;