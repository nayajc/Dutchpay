import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { app } from "./firebase-config.js";
import { addSettlement, onSettlementsChanged, updateSettlementPaid } from "./database.js";

const auth = getAuth(app);

// 1. 인증 상태 체크 (미로그인시 index.html로 이동)
let currentUserEmail = null;
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'index.html';
  } else {
    document.getElementById('user-info').textContent = `👤 ${user.displayName || user.email}`;
    currentUserEmail = user.email;
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
}

if (form) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const payer = document.getElementById('payer').value.trim();
    const amount = document.getElementById('amount').value.trim();
    const currency = document.getElementById('currency').value;
    const participants = document.getElementById('participants').value.split(',').map(s => s.trim()).filter(Boolean);
    if (!payer || !amount || !participants.length) {
      alert(i18n[lang].alertFill);
      return;
    }
    try {
      await addSettlement({ payer, amount, currency, participants, createdAt: Date.now() });
      form.reset();
    } catch (e) {
      alert('DB 저장 실패: ' + e.message);
    }
  });
}

// 최초 한글로 세팅
setLang('ko');
