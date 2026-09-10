// Project X - نظام إدارة المكتبات
const el=id=>document.getElementById(id);
let books=[],users=[],loans=[],notifications=[];
let selectedBooks=new Set(),selectedUsers=new Set(),selectedUserForBorrow=null;
let returnDuration=7;
let sortBooksOrder={name:'asc',date:'asc'},sortUsersOrder={name:'asc',date:'asc'};
let pendingDeleteAction=null;

document.addEventListener('DOMContentLoaded',()=>{
    loadFromLocalStorage();
    initializeUI();
    updateAllStats();
});

function initializeUI(){
    el('returnDurationInput').value=returnDuration;
    updateCategoriesList();
    renderBooksList();renderUsersList();renderLoans();renderNotifications();
    updateNotificationBadge();
    setupEventListeners();
    checkOverdueBooks();
    setInterval(checkOverdueBooks,60000);
}
function setupEventListeners(){
    document.addEventListener('click',e=>{
        if(!e.target.closest('.dropdown-group')){
            const a=el('addDropdown'),b=el('listDropdown');
            if(a)a.style.display='none';if(b)b.style.display='none';
        }
        if(!e.target.closest('.autocomplete-wrapper')){
            const s=el('userSuggestions');if(s)s.style.display='none';
        }
    });
}
function continueToApp(){
    const w=el('welcomeScreen');
    if(!w)return;
    w.classList.add('fade-out');
    setTimeout(()=>w.style.display='none',500);
}
function loadFromLocalStorage(){
    try{
        books=JSON.parse(localStorage.getItem('books')||'[]');
        users=JSON.parse(localStorage.getItem('users')||'[]');
        loans=JSON.parse(localStorage.getItem('loans')||'[]');
        notifications=JSON.parse(localStorage.getItem('notifications')||'[]');
        returnDuration=parseInt(localStorage.getItem('returnDuration')||'7',10);
        if(!Number.isFinite(returnDuration)||returnDuration<1)returnDuration=7;
        books.forEach(b=>{b.copies=Number(b.copies)||0;b.available=Number(b.available)||0;b.date=Number(b.date)||Date.now();});
        users.forEach(u=>{u.phone=u.phone||'غير محدد';u.activeLoans=Number(u.activeLoans)||0;u.date=Number(u.date)||Date.now();});
        recalculateActiveLoans();
        saveToLocalStorage(false);
    }catch(e){console.error(e);resetData();}
}
function saveToLocalStorage(update=true){
    localStorage.setItem('books',JSON.stringify(books));
    localStorage.setItem('users',JSON.stringify(users));
    localStorage.setItem('loans',JSON.stringify(loans));
    localStorage.setItem('notifications',JSON.stringify(notifications));
    localStorage.setItem('returnDuration',String(returnDuration));
    if(update)updateAllStats();
}
function resetData(){books=[];users=[];loans=[];notifications=[];returnDuration=7;saveToLocalStorage();}
function recalculateActiveLoans(){
    users.forEach(u=>u.activeLoans=loans.filter(l=>!l.returned&&l.userId===u.id).length);
}
function openAddDropdown(){const d=el('addDropdown');d.style.display=d.style.display==='flex'?'none':'flex';el('listDropdown').style.display='none'}
function openListDropdown(){const d=el('listDropdown');d.style.display=d.style.display==='flex'?'none':'flex';el('addDropdown').style.display='none'}
function openAddBookModal(){el('addBookModal').style.display='flex';el('addDropdown').style.display='none'}
function closeAddBookModal(){el('addBookModal').style.display='none';el('newBookName').value='';el('newBookAuthor').value='';el('newBookCategory').value='';el('newBookCopies').value='1'}
function openBooksModal(){el('booksModal').style.display='flex';el('listDropdown').style.display='none';renderBooksList()}
function closeBooksModal(){el('booksModal').style.display='none';selectedBooks.clear();updateBorrowButton()}
function openUsersModal(){el('usersModal').style.display='flex';el('listDropdown').style.display='none';renderUsersList()}
function closeUsersModal(){el('usersModal').style.display='none';selectedUsers.clear()}
function openLoansModal(){el('loansModal').style.display='flex';el('listDropdown').style.display='none';renderLoans()}
function closeLoansModal(){el('loansModal').style.display='none'}
function openSelectUserForBorrow(){if(!selectedBooks.size)return alert('⚠️ يرجى تحديد كتب أولاً');el('selectUserModal').style.display='flex';el('searchSelectUser').value='';el('userSuggestions').style.display='none'}
function closeSelectUserModal(){el('selectUserModal').style.display='none';selectedUserForBorrow=null}
function openNotifications(){el('notificationsModal').style.display='flex';renderNotifications()}
function closeNotifications(){el('notificationsModal').style.display='none'}
function openSettings(){el('settingsModal').style.display='flex';updateStatsInSettings()}
function closeSettings(){el('settingsModal').style.display='none'}
function closeBorrowConfirmModal(){el('borrowConfirmModal').style.display='none'}
function closeReturnConfirmModal(){el('returnConfirmModal').style.display='none'}
function closeDeleteConfirm(){el('deleteConfirmModal').style.display='none';pendingDeleteAction=null}
function updateCategoriesList(){}
function clearSearchFilters(){el('searchBooks').value='';renderBooksList()}

function submitAddBook(){
    const name=el('newBookName').value.trim(),author=el('newBookAuthor').value.trim(),category=el('newBookCategory').value,copies=parseInt(el('newBookCopies').value,10);
    if(!name||!author||!category||!Number.isInteger(copies)||copies<1)return alert('⚠️ يرجى ملء جميع الحقول المطلوبة بشكل صحيح');
    const newBook={id:'BOOK-'+Date.now(),name,author,category,copies,available:copies,addedDate:new Date().toISOString().split('T')[0],date:Date.now()};
    books.push(newBook);saveToLocalStorage();closeAddBookModal();
    el('addConfirmText').textContent=`تم إضافة الكتاب: "${name}"`;el('addConfirmModal').style.display='flex';
    addNotification(`تم إضافة كتاب جديد: "${name}"`,'book');renderBooksList();
}
function renderBooksList(){
    const list=el('booksList');if(!list)return;
    const q=(el('searchBooks')?.value||'').toLowerCase().trim();
    const filtered=books.filter(b=>[b.name,b.author,b.category].some(v=>String(v||'').toLowerCase().includes(q)));
    const count=el('booksResultsCount');if(count)count.textContent=`(${filtered.length})`;
    if(!filtered.length){list.innerHTML=`<div class="empty-state">📚 ${q?'لم يتم العثور على كتب':'لا توجد كتب'}<br><button class="full-btn" onclick="openAddBookModal()">➕ إضافة كتاب</button></div>`;updateBorrowButton();return}
    list.innerHTML=filtered.map(b=>{
        const s=selectedBooks.has(b.id);
        return `<div class="book-card" style="background:${s?'#e3f2fd':'white'};padding:12px;margin:8px 0;border-radius:8px;border:2px solid ${s?'#3498db':'#eee'};display:flex;align-items:center;gap:10px;cursor:pointer" onclick="toggleBookSelection('${b.id}')">
        <input type="checkbox" ${s?'checked':''} onclick="event.stopPropagation();toggleBookSelection('${b.id}')">
        <div style="flex:1"><div style="font-weight:bold;color:#2c3e50">${escapeHtml(b.name)}</div><div style="font-size:14px;color:#666">✍️ ${escapeHtml(b.author)}</div><div style="font-size:13px;color:#888;margin-top:5px">🏷️ ${escapeHtml(b.category)} | 📊 ${b.available}/${b.copies} متاح</div></div>
        <button class="full-btn danger" style="min-width:0;padding:6px 12px" onclick="event.stopPropagation();deleteBookPrompt('${b.id}')">🗑️</button></div>`;
    }).join('');
    updateBorrowButton();
}
function toggleBookSelection(id){selectedBooks.has(id)?selectedBooks.delete(id):selectedBooks.add(id);renderBooksList()}
function toggleSelectAllBooks(){
    const q=(el('searchBooks')?.value||'').toLowerCase().trim(),f=books.filter(b=>[b.name,b.author,b.category].some(v=>String(v||'').toLowerCase().includes(q)));
    if(!f.length)return;const all=f.every(b=>selectedBooks.has(b.id));f.forEach(b=>all?selectedBooks.delete(b.id):selectedBooks.add(b.id));renderBooksList()
}
function updateBorrowButton(){const b=el('borrowSelectedBtn');if(b)b.disabled=selectedBooks.size===0}
function toggleSortBooks(type){
    if(type==='name'){sortBooksOrder.name=sortBooksOrder.name==='asc'?'desc':'asc';books.sort((a,b)=>{const c=a.name.localeCompare(b.name,'ar');return sortBooksOrder.name==='asc'?c:-c})}
    else{sortBooksOrder.date=sortBooksOrder.date==='asc'?'desc':'asc';books.sort((a,b)=>sortBooksOrder.date==='asc'?a.date-b.date:b.date-a.date)}
    saveToLocalStorage();renderBooksList()
}
function deleteBookPrompt(id){
    const b=books.find(x=>x.id===id);if(!b)return;
    if(loans.some(l=>l.bookId===id&&!l.returned))return alert(`⚠️ لا يمكن حذف الكتاب "${b.name}" لأنه مستعار حالياً`);
    el('deleteConfirmText').innerHTML=`هل تريد حذف الكتاب: <strong>"${escapeHtml(b.name)}"</strong>؟<br><span style="color:#e74c3c">⚠️ هذا الإجراء لا يمكن التراجع عنه</span>`;
    pendingDeleteAction=()=>deleteBook(id);el('deleteConfirmModal').style.display='flex';
}
function deleteBook(id){books=books.filter(b=>b.id!==id);selectedBooks.delete(id);saveToLocalStorage();renderBooksList();addNotification('تم حذف كتاب','info')}
function deleteSelectedBooks(){
    const ids=[...selectedBooks];if(!ids.length)return alert('⚠️ يرجى تحديد كتب للحذف');
    const blocked=ids.map(id=>books.find(b=>b.id===id)).filter(Boolean).filter(b=>loans.some(l=>l.bookId===b.id&&!l.returned));
    if(blocked.length)return alert(`⚠️ لا يمكن حذف كتب مستعارة حالياً:\n${blocked.map(b=>b.name).join('\n')}`);
    el('deleteConfirmText').innerHTML=`هل تريد حذف <strong>${ids.length}</strong> كتاب؟<br><span style="color:#e74c3c">⚠️ هذا الإجراء لا يمكن التراجع عنه</span>`;
    pendingDeleteAction=()=>{books=books.filter(b=>!ids.includes(b.id));selectedBooks.clear();saveToLocalStorage();renderBooksList();addNotification(`تم حذف ${ids.length} كتب`,'info')};
    el('deleteConfirmModal').style.display='flex';
}

function promptAddUser(){
    const name=prompt('👤 أدخل اسم المستخدم:');if(!name||!name.trim())return;
    const phone=prompt('📱 أدخل رقم الهاتف:');if(!phone||!phone.trim())return alert('⚠️ يجب إدخال رقم هاتف');
    const user={id:'USER-'+Date.now(),name:name.trim(),phone:phone.trim(),joinedDate:new Date().toISOString().split('T')[0],date:Date.now(),activeLoans:0};
    users.push(user);saveToLocalStorage();renderUsersList();
    el('addConfirmText').textContent=`تم إضافة المستخدم: ${user.name}`;el('addConfirmModal').style.display='flex';addNotification(`تم إضافة مستخدم جديد: ${user.name}`,'user');
}
function editUserInfo(id){
    const u=users.find(x=>x.id===id);if(!u)return;
    const n=prompt('✏️ أدخل الاسم الجديد:',u.name);if(n&&n.trim())u.name=n.trim();
    const p=prompt('📱 أدخل رقم الهاتف الجديد:',u.phone);if(!p||!p.trim())return alert('⚠️ يجب إدخال رقم هاتف');u.phone=p.trim();
    loans.forEach(l=>{if(l.userId===id){l.userName=u.name;l.userPhone=u.phone}});
    saveToLocalStorage();renderUsersList();renderLoans();addNotification(`تم تعديل بيانات ${u.name}`,'info');
}
function renderUsersList(){
    const list=el('usersList');if(!list)return;const q=(el('searchUsers')?.value||'').toLowerCase().trim();
    const f=users.filter(u=>u.name.toLowerCase().includes(q)||(u.phone||'').toLowerCase().includes(q));const c=el('usersResultsCount');if(c)c.textContent=`(${f.length})`;
    if(!f.length){list.innerHTML=`<div class="empty-state">👤 ${q?'لم يتم العثور على مستخدمين':'لا يوجد مستخدمون'}<br><button class="full-btn" onclick="promptAddUser()">➕ إضافة مستخدم</button></div>`;return}
    list.innerHTML=f.map(u=>{const s=selectedUsers.has(u.id);return `<div style="background:${s?'#e3f2fd':'white'};padding:12px;margin:8px 0;border-radius:8px;border:2px solid ${s?'#3498db':'#eee'};display:flex;align-items:center;gap:10px;cursor:pointer" onclick="toggleUserSelection('${u.id}')">
    <input type="checkbox" ${s?'checked':''} onclick="event.stopPropagation();toggleUserSelection('${u.id}')"><div style="flex:1"><div style="font-weight:bold;color:#2c3e50">${escapeHtml(u.name)}</div><div class="user-phone">📱 ${escapeHtml(u.phone||'غير محدد')}</div><div style="font-size:13px;color:#888;margin-top:5px">📅 ${u.joinedDate||''} | 📚 ${u.activeLoans||0} استعارة</div></div>
    <button class="full-btn" style="min-width:0;padding:6px 10px" onclick="event.stopPropagation();editUserInfo('${u.id}')">✏️</button><button class="full-btn danger" style="min-width:0;padding:6px 10px" onclick="event.stopPropagation();deleteUserPrompt('${u.id}')">🗑️</button></div>`}).join('');
}
function toggleUserSelection(id){selectedUsers.has(id)?selectedUsers.delete(id):selectedUsers.add(id);renderUsersList()}
function toggleSelectAllUsers(){
    const q=(el('searchUsers')?.value||'').toLowerCase().trim(),f=users.filter(u=>u.name.toLowerCase().includes(q)||(u.phone||'').toLowerCase().includes(q));if(!f.length)return;
    const all=f.every(u=>selectedUsers.has(u.id));f.forEach(u=>all?selectedUsers.delete(u.id):selectedUsers.add(u.id));renderUsersList()
}
function toggleSortUsers(type){
    if(type==='name'){sortUsersOrder.name=sortUsersOrder.name==='asc'?'desc':'asc';users.sort((a,b)=>{const c=a.name.localeCompare(b.name,'ar');return sortUsersOrder.name==='asc'?c:-c})}
    else{sortUsersOrder.date=sortUsersOrder.date==='asc'?'desc':'asc';users.sort((a,b)=>sortUsersOrder.date==='asc'?a.date-b.date:b.date-a.date)}
    saveToLocalStorage();renderUsersList()
}
function deleteUserPrompt(id){
    const u=users.find(x=>x.id===id);if(!u)return;
    const active=loans.some(l=>l.userId===id&&!l.returned);if(active)return alert(`⚠️ لا يمكن حذف المستخدم "${u.name}" لأنه لديه استعارات نشطة`);
    el('deleteConfirmText').innerHTML=`هل تريد حذف المستخدم: <strong>"${escapeHtml(u.name)}"</strong>؟<br><span style="color:#e74c3c">⚠️ هذا الإجراء لا يمكن التراجع عنه</span>`;
    pendingDeleteAction=()=>deleteUser(id);el('deleteConfirmModal').style.display='flex';
}
function deleteUser(id){users=users.filter(u=>u.id!==id);selectedUsers.delete(id);saveToLocalStorage();renderUsersList();addNotification('تم حذف مستخدم','info')}
function deleteSelectedUsers(){
    const ids=[...selectedUsers];if(!ids.length)return alert('⚠️ يرجى تحديد مستخدمين للحذف');
    const blocked=ids.map(id=>users.find(u=>u.id===id)).filter(Boolean).filter(u=>loans.some(l=>l.userId===u.id&&!l.returned));
    if(blocked.length)return alert(`⚠️ لا يمكن حذف المستخدمين التالية أسماؤهم لأن لديهم استعارات نشطة:\n${blocked.map(u=>u.name).join('\n')}`);
    el('deleteConfirmText').innerHTML=`هل تريد حذف <strong>${ids.length}</strong> مستخدم؟<br><span style="color:#e74c3c">⚠️ هذا الإجراء لا يمكن التراجع عنه</span>`;
    pendingDeleteAction=()=>{users=users.filter(u=>!ids.includes(u.id));selectedUsers.clear();saveToLocalStorage();renderUsersList();addNotification(`تم حذف ${ids.length} مستخدم`,'info')};
    el('deleteConfirmModal').style.display='flex';
}
function confirmDelete(){if(typeof pendingDeleteAction==='function'){const a=pendingDeleteAction();pendingDeleteAction=null;el('deleteConfirmModal').style.display='none';return a}closeDeleteConfirm()}

function showUserSuggestions(){
    const q=(el('searchSelectUser').value||'').toLowerCase().trim(),box=el('userSuggestions');if(!q){box.style.display='none';return}
    const f=users.filter(u=>u.name.toLowerCase().includes(q)||(u.phone||'').toLowerCase().includes(q));
    box.innerHTML=f.length?f.map(u=>`<div class="suggestion-item" onclick="selectUserForBorrow('${u.id}')"><strong>${escapeHtml(u.name)}</strong><div style="font-size:13px;color:#666">📱 ${escapeHtml(u.phone||'غير محدد')}</div></div>`).join(''):`<div class="suggestion-item">❌ لم يتم العثور على مستخدمين</div><div class="suggestion-item" onclick="promptAddUser();closeSelectUserModal()">➕ إضافة مستخدم جديد</div>`;
    box.style.display='block'
}
function selectUserForBorrow(id){selectedUserForBorrow=id;const u=users.find(x=>x.id===id);if(!u)return;el('searchSelectUser').value=u.name;el('userSuggestions').style.display='none';setTimeout(processBorrow,150)}
function processBorrow(){
    if(!selectedUserForBorrow)return alert('⚠️ يرجى اختيار مستخدم أولاً');if(!selectedBooks.size)return alert('⚠️ يرجى تحديد كتب أولاً');
    const u=users.find(x=>x.id===selectedUserForBorrow);if(!u)return alert('❌ المستخدم غير موجود');
    const candidates=[...selectedBooks].map(id=>books.find(b=>b.id===id)).filter(b=>b&&b.available>0);
    if(!candidates.length)return alert('⚠️ جميع الكتب المحددة غير متاحة');
    if(!confirm(`هل تريد استعارة ${candidates.length} كتاب بواسطة المستخدم ${u.name}؟`))return;
    const names=[];
    candidates.forEach(b=>{const d=new Date();const due=new Date(d);due.setDate(due.getDate()+returnDuration);loans.push({id:'LOAN-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),userId:u.id,userName:u.name,userPhone:u.phone,bookId:b.id,bookName:b.name,loanDate:d.toISOString().split('T')[0],dueDate:due.toISOString().split('T')[0],returned:false,returnDate:null});b.available--;u.activeLoans++;names.push(b.name)});
    saveToLocalStorage();el('borrowConfirmText').innerHTML=`تمت استعارة ${names.length} كتاب بواسطة <strong>${escapeHtml(u.name)}</strong> (📱 ${escapeHtml(u.phone)})<br><br>${names.map(escapeHtml).map(n=>'📚 '+n).join('<br>')}`;el('borrowConfirmModal').style.display='flex';
    selectedBooks.clear();selectedUserForBorrow=null;closeSelectUserModal();closeBooksModal();renderBooksList();renderUsersList();renderLoans();addNotification(`تم استعارة ${names.length} كتاب بواسطة ${u.name}`,'loan');
}
function renderLoans(){
    const table=el('loanTable');if(!table)return;const active=loans.filter(l=>!l.returned);
    if(!active.length){table.innerHTML='<tr><td colspan="7" style="text-align:center;padding:30px;color:#666">📝 لا توجد استعارات نشطة</td></tr>';return}
    table.innerHTML=active.map((l,i)=>{const due=new Date(l.dueDate+'T23:59:59'),days=Math.ceil((due-new Date())/86400000);let text=days>0?`${days} يوم`:'منتهي',bg=days<=0?'#e74c3c':days<=3?'#f39c12':'#2ecc71';
    return `<tr><td>${i+1}</td><td>${escapeHtml(l.userName)}</td><td class="phone-cell">${escapeHtml(l.userPhone||'غير محدد')}</td><td>${escapeHtml(l.bookName)}</td><td>${l.loanDate}</td><td><span style="background:${bg};color:white;padding:4px 10px;border-radius:15px;font-size:13px">${l.dueDate} (${text})</span></td><td><button class="full-btn" style="min-width:0;padding:6px 12px" onclick="returnBook('${l.id}')">🔄 إرجاع</button></td></tr>`}).join('')
}
function returnBook(id){
    const l=loans.find(x=>x.id===id);if(!l||l.returned)return;if(!confirm(`هل تريد بالتأكيد إرجاع الكتاب "${l.bookName}"؟`))return;
    const b=books.find(x=>x.id===l.bookId),u=users.find(x=>x.id===l.userId);l.returned=true;l.returnDate=new Date().toISOString().split('T')[0];if(b)b.available=Math.min(b.copies,b.available+1);if(u)u.activeLoans=Math.max(0,u.activeLoans-1);
    saveToLocalStorage();el('returnConfirmText').innerHTML=`تم إرجاع الكتاب <strong>${escapeHtml(l.bookName)}</strong><br>بواسطة <strong>${escapeHtml(l.userName)}</strong><br>تاريخ الإرجاع: ${l.returnDate}`;el('returnConfirmModal').style.display='flex';renderBooksList();renderUsersList();renderLoans();addNotification(`تم إرجاع الكتاب ${l.bookName}`,'info')
}

function addNotification(message,type='info'){
    const icons={info:'ℹ️',success:'✅',warning:'⚠️',error:'❌',book:'📚',user:'👤',loan:'📝'};
    notifications.unshift({id:Date.now()+Math.random(),message:`${icons[type]||'🔔'} ${message}`,date:new Date().toLocaleString('ar-SA'),read:false,type});
    notifications=notifications.slice(0,50);saveToLocalStorage();updateNotificationBadge()
}
function renderNotifications(){
    const list=el('notificationsList');if(!list)return;
    if(!notifications.length){list.innerHTML='<li style="text-align:center;padding:20px;color:#666">🔔 لا توجد إشعارات</li>';return}
    list.innerHTML=notifications.map(n=>`<li style="background:${n.read?'#f8f9fa':'#e3f2fd'};padding:12px;margin:8px 0;border-radius:6px;border-right:3px solid ${getNotificationColor(n.type)}"><div style="font-weight:${n.read?'normal':'bold'}">${escapeHtml(n.message)}</div><div style="font-size:12px;color:#666;margin-top:5px">📅 ${escapeHtml(n.date)}</div></li>`).join('')
}
function getNotificationColor(t){return {info:'#3498db',success:'#2ecc71',warning:'#f39c12',error:'#e74c3c',book:'#9b59b6',user:'#1abc9c',loan:'#e67e22'}[t]||'#3498db'}
function updateNotificationBadge(){const b=el('notificationBadge');if(!b)return;const n=notifications.filter(x=>!x.read).length;b.textContent=n>99?'99+':n;b.style.display=n?'flex':'none'}
function markAllNotificationsAsRead(){notifications.forEach(n=>n.read=true);saveToLocalStorage();renderNotifications();updateNotificationBadge()}
function clearNotifications(){if(!notifications.length)return alert('⚠️ لا توجد إشعارات للمسح');if(!confirm('هل تريد مسح جميع الإشعارات؟'))return;notifications=[];saveToLocalStorage();updateNotificationBadge();renderNotifications()}
function checkOverdueBooks(){
    const today=new Date().toISOString().split('T')[0],existing=new Set(notifications.filter(n=>n.type==='warning'&&!n.read).map(n=>n.loanId));
    loans.filter(l=>!l.returned&&l.dueDate<today).forEach(l=>{if(!existing.has(l.id)){const n={id:Date.now()+Math.random(),message:`⚠️ انتهت مدة استعارة "${l.bookName}" للمستخدم ${l.userName}`,date:new Date().toLocaleString('ar-SA'),read:false,type:'warning',loanId:l.id};notifications.unshift(n)}});notifications=notifications.slice(0,50);saveToLocalStorage();updateNotificationBadge();renderLoans()
}

function saveReturnDuration(){const d=parseInt(el('returnDurationInput').value,10);if(!Number.isInteger(d)||d<1||d>30)return alert('⚠️ يرجى إدخال مدة صحيحة بين 1 و30 يوم');returnDuration=d;saveToLocalStorage();alert(`✅ تم حفظ مدة الإرجاع: ${d} أيام`);addNotification(`تم تغيير مدة الإرجاع إلى ${d} أيام`,'success')}
function updateStatsInSettings(){el('statsBooks').textContent=books.length;el('statsUsers').textContent=users.length;el('statsLoans').textContent=loans.filter(l=>!l.returned).length;el('statsNotifications').textContent=notifications.length}
function updateAllStats(){updateStatsInSettings();updateNotificationBadge()}

function exportData(){
    const data={books,users,loans,notifications,settings:{returnDuration},exportDate:new Date().toISOString(),version:'2.1'};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ProjectX-backup-${new Date().toISOString().split('T')[0]}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);addNotification('تم تصدير نسخة احتياطية','success')
}
function importData(){
    const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.books)||!Array.isArray(d.users)||!Array.isArray(d.loans))throw new Error('invalid');books=d.books;users=d.users;loans=d.loans;notifications=Array.isArray(d.notifications)?d.notifications:[];returnDuration=Number(d.settings?.returnDuration)||7;recalculateActiveLoans();saveToLocalStorage();renderBooksList();renderUsersList();renderLoans();renderNotifications();alert('✅ تم استيراد البيانات بنجاح')}catch(err){alert('❌ الملف غير صالح أو تالف')}};r.readAsText(file)};input.click()
}
function clearAllData(){if(!confirm('⚠️ سيتم حذف جميع الكتب والمستخدمين والاستعارات والإشعارات. هل أنت متأكد؟'))return;resetData();selectedBooks.clear();selectedUsers.clear();renderBooksList();renderUsersList();renderLoans();renderNotifications();alert('✅ تم حذف جميع البيانات')}
function openSimpleImport(){el('simpleImportModal').style.display='flex'}
function closeSimpleImport(){el('simpleImportModal').style.display='none';el('simpleFileInput').value=''}
function importUsersSimple(){prepareSimpleImport('users')}
function importBooksSimple(){prepareSimpleImport('books')}
function prepareSimpleImport(type){
    const input=el('simpleFileInput');input.value='';input.onchange=()=>{const f=input.files[0];if(f)readSimpleFile(f,type)};input.click()
}
function readSimpleFile(file,type){
    const reader=new FileReader();reader.onload=()=>{const text=String(reader.result||'');const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
        if(file.name.toLowerCase().endsWith('.txt')||file.name.toLowerCase().endsWith('.csv')){
            let added=0;
            if(type==='users')lines.forEach(line=>{const p=line.split(',').map(x=>x.trim());if(p[0]){users.push({id:'USER-'+Date.now()+Math.random(),name:p[0],phone:p[1]||'غير محدد',joinedDate:new Date().toISOString().split('T')[0],date:Date.now(),activeLoans:0});added++}});
            else lines.forEach(line=>{const p=line.split(',').map(x=>x.trim());if(p[0]){const copies=parseInt(p[3]||'1',10)||1;books.push({id:'BOOK-'+Date.now()+Math.random(),name:p[0],author:p[1]||'غير محدد',category:p[2]||'عام',copies,available:copies,addedDate:new Date().toISOString().split('T')[0],date:Date.now()});added++}});
            saveToLocalStorage();renderBooksList();renderUsersList();alert(`✅ تم استيراد ${added} سجل`);closeSimpleImport()
        }else alert('⚠️ قراءة Excel مباشرة من المتصفح تحتاج مكتبة XLSX. استخدم CSV حالياً أو صدّر Excel إلى CSV.')
    };reader.readAsText(file)
}
function exitApp(){if(confirm('هل تريد الخروج من التطبيق؟')){try{window.close()}catch(e){location.href='about:blank'}}}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
