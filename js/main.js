import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { app } from "./firebase-config.js";
import { addSettlement, onSettlementsChanged, updateSettlementPaid, getAllUsers } from "./database.js";

const auth = getAuth(app);

// 1. 멤버 관리
let members = [];
const memberForm = document.getElementById('member-form');
const memberInput = document.getElementById('member-name');
const memberListDiv = document.getElementById('member-list');
function renderMemberList() {
  memberListDiv.innerHTML = members.map((m, i) => `<span style="display:inline-block;background:#e3f2fd;color:#0f75bc;padding:0.4em 1em;border-radius:12px;font-size:1.1em;margin-right:0.5em;margin-bottom:0.3em;">${m} <button style='background:none;border:none;color:#e74c3c;font-size:1.1em;cursor:pointer;' onclick='window.removeMember(${i})'>×</button></span>`).join('');
}
window.removeMember = idx => { members.splice(idx,1); renderMemberList(); renderParticipantsList(); };
if (memberForm) {
  memberForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = memberInput.value.trim();
    if (!name) return;
    if (members.includes(name)) return alert('이미 추가된 멤버입니다.');
    members.push(name);
    memberInput.value = '';
    renderMemberList();
    renderParticipantsList();
  });
}
// 2. 통화 선택
const currencyList = [
  { code: 'USD', label: 'USD', flag: '🇺🇸' },
  { code: 'KRW', label: 'KRW', flag: '🇰🇷' },
  { code: 'JPY', label: 'JPY', flag: '🇯🇵' },
  { code: 'THB', label: 'THB', flag: '🇹🇭' },
  { code: 'MYR', label: 'MYR', flag: '🇲🇾' },
  { code: 'TWD', label: 'TWD', flag: '🇹🇼' },
  { code: 'SGD', label: 'SGD', flag: '🇸🇬' },
  { code: 'VND', label: 'VND', flag: '🇻🇳' },
];
const currencyListDiv = document.getElementById('currency-list');
const currencyInput = document.getElementById('currency');
function renderCurrencyList() {
  currencyListDiv.innerHTML = currencyList.map(c => `<button type='button' class='currency-btn' data-currency='${c.code}' style='font-size:1.3em;padding:0.5em 1.2em;border-radius:12px;border:2px solid #b3e0fc;background:#fff;margin-bottom:0.2em;cursor:pointer;display:flex;align-items:center;gap:0.5em;'><span style='font-size:1.5em;'>${c.flag}</span> <b>${c.label}</b></button>`).join('');
  // 기본값
  currencyInput.value = currencyList[1].code;
}
currencyListDiv && renderCurrencyList();
currencyListDiv && currencyListDiv.addEventListener('click', e => {
  if (e.target.closest('.currency-btn')) {
    const code = e.target.closest('.currency-btn').dataset.currency;
    currencyInput.value = code;
    document.querySelectorAll('.currency-btn').forEach(btn => btn.style.borderColor = '#b3e0fc');
    e.target.closest('.currency-btn').style.borderColor = '#0f75bc';
  }
});
// 3. 참가자 선택
const participantsListDiv = document.getElementById('participants-list');
let allUsers = [];
function renderParticipantsList() {
  participantsListDiv.innerHTML = allUsers.map(u => {
    const isMe = (u.email === currentUserEmail);
    return `<label style='font-size:1.1em;margin-right:1em;'><input type='checkbox' class='participant-check' value='${u.email}' style='margin-right:0.4em;' ${isMe ? 'checked disabled' : ''}/> ${u.displayName || u.email}</label>`;
  }).join('');
}
// 4. 지불자(본인) 자동 세팅
function setPayer(user) {
  document.getElementById('payer').value = user.displayName || user.email || '';
}

// 1. 인증 상태 체크 (미로그인시 index.html로 이동)
let currentUserEmail = null;
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'index.html';
  } else {
    document.getElementById('user-info').textContent = `👤 ${user.displayName || user.email}`;
    currentUserEmail = user.email;
    setPayer(user);
    // DB에서 전체 회원 불러오기
    getAllUsers(users => {
      allUsers = users;
      renderParticipantsList();
    });
    // DB 연동: 내역 실시간 반영
    onSettlementsChanged(arr => {
      history = arr.reverse(); // 최신순
      renderHistory();
    });
  }
});

// 2. 로그아웃 기능
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

// 3. 정산 입력 및 내역 표시 (임시: 로컬 배열)
let history = [];
const form = document.getElementById('settle-form');
const historyList = document.getElementById('history-list');

// 정산 결과 표시 영역 추가
let resultSection = document.createElement('div');
resultSection.className = 'section-title';
resultSection.id = 'settle-result-title';
resultSection.innerHTML = '정산 결과 <span class="emoji">💰</span>';
let resultList = document.createElement('div');
resultList.id = 'settle-result-list';
resultList.style.marginTop = '0.7rem';
const dashboard = document.querySelector('.dashboard-container');
dashboard.appendChild(resultSection);
dashboard.appendChild(resultList);

// 다국어 지원
const i18n = {
  ko: {
    logout: '로그아웃',
    settleInput: '정산 입력',
    payer: '지불자',
    amount: '금액',
    currency: '통화',
    participants: '참가자 (쉼표로 구분)',
    settleAdd: '정산 추가',
    settleHistory: '정산 내역',
    user: '님이',
    paid: '결제',
    participantsList: '참가자',
    alertFill: '모든 항목을 입력해주세요!'
  },
  en: {
    logout: 'Logout',
    settleInput: 'Add Payment',
    payer: 'Payer',
    amount: 'Amount',
    currency: 'Currency',
    participants: 'Participants (comma separated)',
    settleAdd: 'Add',
    settleHistory: 'History',
    user: 'paid',
    paid: '',
    participantsList: 'Participants',
    alertFill: 'Please fill all fields!'
  }
};
let lang = 'ko';

function setLang(newLang) {
  lang = newLang;
  document.getElementById('btn-logout').textContent = i18n[lang].logout;
  document.querySelector('.section-title').innerHTML = `${i18n[lang].settleInput} <span class="emoji">📝</span>`;
  document.querySelector('label[for="payer"]').textContent = i18n[lang].payer;
  document.querySelector('label[for="amount"]').textContent = i18n[lang].amount;
  document.querySelector('label[for="currency"]').textContent = i18n[lang].currency;
  document.querySelector('label[for="participants"]').textContent = i18n[lang].participants;
  document.querySelector('.settle-btn').textContent = i18n[lang].settleAdd;
  document.querySelectorAll('.section-title')[1].innerHTML = `${i18n[lang].settleHistory} <span class="emoji">📋</span>`;
  renderHistory();
  document.getElementById('lang-toggle').textContent = lang === 'ko' ? '🇰🇷' : '🇺🇸';
}

const langBtn = document.getElementById('lang-toggle');
if (langBtn) {
  langBtn.addEventListener('click', () => {
    setLang(lang === 'ko' ? 'en' : 'ko');
  });
}

function calculateSettlementResult() {
  // 참가자별 balance 계산 (미납만)
  const balance = {};
  history.forEach(item => {
    const amount = parseFloat(item.amount);
    if (!amount || !item.participants || !item.paidStatus) return;
    const n = item.participants.length;
    const share = amount / n;
    item.participants.forEach(part => {
      if (!item.paidStatus[part]) {
        // 미납자만 계산
        balance[part] = (balance[part] || 0) - share;
      }
    });
    // 지불자는 전체 금액만큼 받음
    balance[item.payer] = (balance[item.payer] || 0) + amount;
  });
  // 정산 매칭(누가 누구에게 얼마)
  // 단순히 balance > 0(받을 사람), < 0(줄 사람)로 분리
  const toReceive = Object.entries(balance).filter(([_, v]) => v > 0).sort((a,b)=>b[1]-a[1]);
  const toPay = Object.entries(balance).filter(([_, v]) => v < 0).sort((a,b)=>a[1]-b[1]);
  const result = [];
  let i=0, j=0;
  while(i < toReceive.length && j < toPay.length) {
    const [recv, recvAmt] = toReceive[i];
    const [pay, payAmt] = toPay[j];
    const amt = Math.min(recvAmt, -payAmt);
    if (amt > 0.01) {
      result.push({ from: pay, to: recv, amount: amt });
      toReceive[i][1] -= amt;
      toPay[j][1] += amt;
    }
    if (toReceive[i][1] < 0.01) i++;
    if (toPay[j][1] > -0.01) j++;
  }
  return result;
}

function renderSettlementResult() {
  const result = calculateSettlementResult();
  resultList.innerHTML = '';
  if (result.length === 0) {
    resultList.innerHTML = '<span style="color:#888;">모든 미납 정산이 완료되었습니다!</span>';
    return;
  }
  result.forEach(r => {
    const div = document.createElement('div');
    div.style.marginBottom = '0.4rem';
    div.innerHTML = `<span class="emoji">🤝</span> <b>${r.from}</b> → <b>${r.to}</b> : <b>${r.amount.toLocaleString(undefined, {maximumFractionDigits:2})}</b> 받기`;
    resultList.appendChild(div);
  });
}

function renderMyHistory() {
  const myHistoryList = document.getElementById('my-history-list');
  if (!myHistoryList) return;
  const mySettles = history.filter(item => item.payer === (auth.currentUser.displayName || auth.currentUser.email));
  if (mySettles.length === 0) {
    myHistoryList.innerHTML = '<span style="color:#888;">본인이 낸 내역이 없습니다.</span>';
    return;
  }
  myHistoryList.innerHTML = mySettles.map(item => {
    const date = item.date || '-';
    const place = item.place || '-';
    const amount = item.amount || '-';
    const currency = item.currency || '';
    const participants = (item.participants || []).join(', ');
    const paidStatus = item.paidStatus || {};
    const paidList = Object.entries(paidStatus).map(([name, paid]) => `<span style='margin-right:0.7em;'>${name}: <b style='color:${paid ? "green" : "#e74c3c"}'>${paid ? "완료" : "미납"}</b></span>`).join('');
    return `<div class='history-item' style='font-size:1.05em;'>
      <b>${date}</b> | <b>${place}</b><br/>
      <span style='color:#0f75bc;'>${amount} ${currency}</span><br/>
      <span>참가자: ${participants}</span><br/>
      <span>지불 현황: ${paidList}</span>
    </div>`;
  }).join('');
}

function renderHistory() {
  historyList.innerHTML = '';
  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    let html = `<span class="emoji">💳</span> <b>${item.payer}</b>${i18n[lang].user} <b>${item.amount} ${item.currency}</b> ${i18n[lang].paid}<br><span style="font-size:0.97em;">${i18n[lang].participantsList}: `;
    html += item.participants.map(part => {
      const paid = item.paidStatus && item.paidStatus[part];
      // 본인(로그인 사용자)이 참가자일 때만 버튼 활성화
      if (currentUserEmail && part === currentUserEmail) {
        if (paid) {
          return `<span style='color:green;'>${part} ✅</span>`;
        } else {
          return `<button data-settleid="${item.id}" data-part="${part}" class="pay-btn" style="background:#1cb5e0;color:#fff;border:none;border-radius:6px;padding:2px 8px;cursor:pointer;">완료</button> <span style='color:#e74c3c;'>${part} 미납</span>`;
        }
      } else {
        // 타인은 상태만 표시
        return paid ? `<span style='color:green;'>${part} ✅</span>` : `<span style='color:#e74c3c;'>${part} 미납</span>`;
      }
    }).join(', ');
    html += `</span>`;
    div.innerHTML = html;
    historyList.appendChild(div);
  });
  // 버튼 이벤트 바인딩
  document.querySelectorAll('.pay-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const settleId = btn.getAttribute('data-settleid');
      const part = btn.getAttribute('data-part');
      try {
        await updateSettlementPaid(settleId, part, true);
      } catch (err) {
        alert('상태 업데이트 실패: ' + err.message);
      }
    });
  });
  renderSettlementResult();
  renderMyHistory();
}

if (form) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const payer = document.getElementById('payer').value.trim();
    const amount = document.getElementById('amount').value.trim();
    const currency = document.getElementById('currency').value;
    const place = document.getElementById('place').value.trim();
    const date = document.getElementById('date').value;
    let participants = Array.from(document.querySelectorAll('.participant-check:checked')).map(chk => chk.value);
    // 본인 이메일이 반드시 포함되도록 보장
    if (!participants.includes(currentUserEmail)) participants.push(currentUserEmail);
    if (!payer) return alert('지불자 정보가 없습니다.');
    if (!amount) return alert('금액을 입력하세요.');
    if (!currency) return alert('통화를 선택하세요.');
    if (!place) return alert('장소를 입력하세요.');
    if (!date) return alert('날짜를 입력하세요.');
    if (!participants.length) return alert('참가자를 1명 이상 선택하세요.');
    if (!participants.every(p => allUsers.some(u => u.email === p))) return alert('참가자는 멤버 중에서만 선택 가능합니다.');
    try {
      await addSettlement({ payer, amount, currency, place, date, participants, createdAt: Date.now() });
      form.reset();
      document.querySelectorAll('.currency-btn').forEach((btn, i) => btn.style.borderColor = i===1 ? '#0f75bc' : '#b3e0fc');
    } catch (e) {
      alert('DB 저장 실패: ' + e.message);
    }
  });
}

// 최초 한글로 세팅
setLang('ko');
