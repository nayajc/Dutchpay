import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { app } from "./firebase-config.js";
import { addSettlement, onSettlementsChanged, updateSettlementPaid, getAllUsers, archiveSettlement, onArchivedSettlementsChanged, updateSettlementParticipants } from "./database.js";

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
  { code: 'AUD', label: 'AUD', flag: '🇦🇺' },
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
// 3. 참가자 선택: uid/email/displayName 구조로 저장
const participantsListDiv = document.getElementById('participants-list');
let allUsers = [];
function renderParticipantsList() {
  participantsListDiv.innerHTML = allUsers.map(u => {
    const isMe = (u.email === currentUserEmail);
    return `<label style='font-size:1.1em;margin-right:1em;'><input type='checkbox' class='participant-check' value='${u.uid}' style='margin-right:0.4em;' ${isMe ? 'checked disabled' : ''}/> ${u.displayName || u.email}</label>`;
  }).join('');
}
// 4. 지불자(본인) 자동 세팅 및 오늘 날짜 설정
function setPayer(user) {
  document.getElementById('payer').value = user.displayName || user.email || '';
  // 오늘 날짜 자동 설정 (YYYY-MM-DD 형식)
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  document.getElementById('date').value = todayStr;
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
      // 사용자 정보 로드 후 정산 결과와 내야 할 내역 렌더링
      renderSettlementResult();
      renderPayResult();
    });
    // DB 연동: 내역 실시간 반영
    onSettlementsChanged(arr => {
      history = arr.reverse(); // 최신순
      renderHistory();
    });
    // 보관함(archive) 실시간 반영도 로그인 후에만 실행
    onArchivedSettlementsChanged(arr => {
      archiveHistory = arr.reverse();
      renderArchiveList();
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
resultSection.innerHTML = '오늘 정산 결과 <span class="emoji">💰</span>';
let resultList = document.createElement('div');
resultList.id = 'settle-result-list';
resultList.style.marginTop = '0.7rem';
const dashboard = document.querySelector('.dashboard-container');
dashboard.appendChild(resultSection);
dashboard.appendChild(resultList);

// 내가 내야 할 내역 표시 영역 추가
let paySection = document.createElement('div');
paySection.className = 'section-title';
paySection.id = 'pay-result-title';
paySection.innerHTML = '오늘 내가 내야 할 내역 💸';
let payList = document.createElement('div');
payList.id = 'pay-result-list';
payList.style.marginTop = '0.7rem';
dashboard.appendChild(paySection);
dashboard.appendChild(payList);

// 다국어 지원
const i18n = {
  ko: {
    logout: '로그아웃',
    settleInput: '정산 입력',
    payer: '지불자',
    amount: '금액',
    currency: '통화',
    participants: '참가자',
    settleAdd: '정산 추가',
    settleHistory: '정산 내역',
    myHistory: '내가 낸 내역',
    archive: '보관함',
    todayResult: '오늘 정산 결과',
    todayPayResult: '오늘 내가 내야 할 내역',
    user: '님이',
    paid: '결제',
    participantsList: '참가자',
    alertFill: '모든 항목을 입력해주세요!',
    noMyHistory: '본인이 낸 내역이 없습니다.',
    noArchive: '보관된 내역이 없습니다.',
    noTodayResult: '오늘 모든 미납 정산이 완료되었습니다!',
    noTodayPay: '오늘 내야 할 내역이 없습니다.',
    unpaid: '미납',
    paidComplete: '납부완료자',
    unpaidList: '미납자',
    addParticipant: '참가자 추가',
    archive: '보관',
    delete: '삭제',
    receive: '받기',
    payTo: '에게 내야 함',
    place: '장소',
    date: '날짜'
  },
  en: {
    logout: 'Logout',
    settleInput: 'Add Payment',
    payer: 'Payer',
    amount: 'Amount',
    currency: 'Currency',
    participants: 'Participants',
    settleAdd: 'Add',
    settleHistory: 'History',
    myHistory: 'My Payments',
    archive: 'Archive',
    todayResult: 'Today\'s Settlement Result',
    todayPayResult: 'What I Need to Pay Today',
    user: 'paid',
    paid: '',
    participantsList: 'Participants',
    alertFill: 'Please fill all fields!',
    noMyHistory: 'No payments made by you.',
    noArchive: 'No archived history.',
    noTodayResult: 'All unpaid settlements completed today!',
    noTodayPay: 'No payments due today.',
    unpaid: 'Unpaid',
    paidComplete: 'Paid',
    unpaidList: 'Unpaid',
    addParticipant: 'Add Participant',
    archive: 'Archive',
    delete: 'Delete',
    receive: 'receive',
    payTo: 'owe to',
    place: 'Place',
    date: 'Date'
  }
};
let lang = 'ko';

function setLang(newLang) {
  lang = newLang;
  
  // 기본 UI 요소들
  document.getElementById('btn-logout').textContent = i18n[lang].logout;
  document.querySelector('.section-title').innerHTML = `${i18n[lang].settleInput} <span class="emoji">📝</span>`;
  document.querySelector('label[for="payer"]').textContent = i18n[lang].payer;
  document.querySelector('label[for="amount"]').textContent = i18n[lang].amount;
  document.querySelector('label[for="currency"]').textContent = i18n[lang].currency;
  document.querySelector('label[for="participants"]').textContent = i18n[lang].participants;
  document.querySelector('.settle-btn').textContent = i18n[lang].settleAdd;
  
  // 섹션 제목들
  const sectionTitles = document.querySelectorAll('.section-title');
  if (sectionTitles[1]) {
    sectionTitles[1].innerHTML = `${i18n[lang].settleHistory} <span class="emoji">📋</span>`;
  }
  
  // 동적으로 생성된 섹션들
  const resultTitle = document.getElementById('settle-result-title');
  if (resultTitle) {
    resultTitle.innerHTML = `${i18n[lang].todayResult} <span class="emoji">💰</span>`;
  }
  
  const payTitle = document.getElementById('pay-result-title');
  if (payTitle) {
    payTitle.innerHTML = `${i18n[lang].todayPayResult} 💸`;
  }
  
  // 언어 토글 버튼
  document.getElementById('lang-toggle').textContent = lang === 'ko' ? '🇰🇷' : '🇺🇸';
  
  // 모든 렌더링 함수 호출
  renderHistory();
  renderMyHistory();
  renderArchiveList();
  renderSettlementResult();
  renderPayResult();
}

const langBtn = document.getElementById('lang-toggle');
if (langBtn) {
  langBtn.addEventListener('click', () => {
    setLang(lang === 'ko' ? 'en' : 'ko');
  });
}

function calculateSettlementResult() {
  // 참가자별 balance 계산 (미납만) - 오늘 날짜 기준
  const balance = {};
  console.log('=== 정산 계산 시작 (오늘 기준) ===');
  
  // 오늘 날짜 구하기
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  
  console.log('오늘 날짜:', todayStr);
  console.log('현재 history:', history);
  
  // 오늘 날짜의 정산만 필터링
  const todayHistory = history.filter(item => item.date === todayStr);
  console.log('오늘 정산 내역:', todayHistory);
  
  todayHistory.forEach(item => {
    const amount = parseFloat(item.amount);
    if (!amount || !item.participants || !item.paidStatus) return;
    const n = item.participants.length;
    const share = amount / n;
    console.log(`정산: ${item.payer.displayName || item.payer.email}이 ${amount} 지불, 참가자 ${n}명, 1인당 ${share}`);
    
    item.participants.forEach(part => {
      if (!item.paidStatus[part.uid]) {
        // 미납자만 계산
        balance[part.uid] = (balance[part.uid] || 0) - share;
        console.log(`미납자 ${part.displayName || part.email}: balance = ${balance[part.uid]}`);
      }
    });
    // 지불자는 전체 금액만큼 받음
    balance[item.payer.uid] = (balance[item.payer.uid] || 0) + amount;
    console.log(`지불자 ${item.payer.displayName || item.payer.email}: balance = ${balance[item.payer.uid]}`);
  });
  
  console.log('최종 balance:', balance);
  
  // 정산 매칭(누가 누구에게 얼마)
  // 단순히 balance > 0(받을 사람), < 0(줄 사람)로 분리
  const toReceive = Object.entries(balance).filter(([_, v]) => v > 0).sort((a,b)=>b[1]-a[1]);
  const toPay = Object.entries(balance).filter(([_, v]) => v < 0).sort((a,b)=>a[1]-b[1]);
  
  console.log('받을 사람들:', toReceive);
  console.log('줄 사람들:', toPay);
  
  const result = [];
  let i=0, j=0;
  while(i < toReceive.length && j < toPay.length) {
    const [recv, recvAmt] = toReceive[i];
    const [pay, payAmt] = toPay[j];
    const amt = Math.min(recvAmt, -payAmt);
    if (amt > 0.01) {
      result.push({ from: pay, to: recv, amount: amt });
      console.log(`정산 결과: ${pay} → ${recv}: ${amt}`);
      toReceive[i][1] -= amt;
      toPay[j][1] += amt;
    }
    if (toReceive[i][1] < 0.01) i++;
    if (toPay[j][1] > -0.01) j++;
  }
  
  console.log('최종 정산 결과:', result);
  return result;
}

// 환율 정보 가져오기 (exchangerate.host)
async function getRatesToUSD() {
  try {
    const res = await fetch('https://api.exchangerate.host/latest?base=USD');
    const data = await res.json();
    return data.rates;
  } catch (e) {
    return {};
  }
}

async function renderSettlementResult() {
  const result = calculateSettlementResult();
  resultList.innerHTML = '';
  if (result.length === 0) {
    resultList.innerHTML = `<span style="color:#888;">${i18n[lang].noTodayResult}</span>`;
    return;
  }
  // uid → displayName/email 매핑
  const uidToName = {};
  allUsers.forEach(u => { uidToName[u.uid] = u.displayName || u.email; });
  // 환율 적용: 각 정산 결과를 USD로 환산
  const rates = await getRatesToUSD();
  // 각 사람별 USD 합산
  const usdMap = {};
  result.forEach(r => {
    // 해당 거래의 통화 찾기
    const currency = (() => {
      const found = history.find(item => {
        if (!item.paidStatus) return false;
        const uids = Object.keys(item.paidStatus);
        return uids.includes(r.from) && uids.includes(r.to);
      });
      return found ? found.currency : 'USD';
    })();
    let usd = parseFloat(r.amount);
    if (currency !== 'USD' && rates[currency]) {
      usd = usd / rates[currency];
    }
    const name = uidToName[r.to] || r.to;
    usdMap[name] = (usdMap[name] || 0) + usd;
  });
  Object.entries(usdMap).forEach(([name, usd]) => {
    resultList.innerHTML += `<b>${name}</b> : <b>${usd.toLocaleString(undefined, {maximumFractionDigits:2})} USD</b> ${i18n[lang].receive}<br/>`;
  });
}

async function renderPayResult() {
  const result = calculateSettlementResult();
  payList.innerHTML = '';
  if (result.length === 0) {
    payList.innerHTML = `<span style="color:#888;">${i18n[lang].noTodayPay}</span>`;
    return;
  }
  const uidToName = {};
  allUsers.forEach(u => { uidToName[u.uid] = u.displayName || u.email; });
  const rates = await getRatesToUSD();
  // 내가 내야 할 내역만 추출
  const myUid = allUsers.find(u => u.email === currentUserEmail)?.uid;
  const myPays = result.filter(r => r.from === myUid);
  if (myPays.length === 0) {
    payList.innerHTML = `<span style="color:#888;">${i18n[lang].noTodayPay}</span>`;
    return;
  }
  myPays.forEach(r => {
    const currency = (() => {
      const found = history.find(item => {
        if (!item.paidStatus) return false;
        const uids = Object.keys(item.paidStatus);
        return uids.includes(r.from) && uids.includes(r.to);
      });
      return found ? found.currency : 'USD';
    })();
    let usd = parseFloat(r.amount);
    if (currency !== 'USD' && rates[currency]) {
      usd = usd / rates[currency];
    }
    payList.innerHTML += `<b>${uidToName[r.to] || r.to}</b> ${i18n[lang].payTo} <b>${usd.toLocaleString(undefined, {maximumFractionDigits:2})} USD</b>`;
  });
}

let archiveHistory = [];
const archiveList = document.getElementById('archive-list');
function renderArchiveList() {
  if (!archiveList) return;
  if (archiveHistory.length === 0) {
    archiveList.innerHTML = `<span style="color:#888;">${i18n[lang].noArchive}</span>`;
    return;
  }
  archiveList.innerHTML = archiveHistory.map(item => {
    const date = item.date || '-';
    const place = item.place || '-';
    const amount = item.amount || '-';
    const currency = item.currency || '';
    const participants = (item.participants || []).map(p => p.displayName || p.email).join(', ');
    return `<div class='history-item' style='font-size:1.05em;'>
      <b>${date}</b> | <b>${place}</b><br/>
      <span style='color:#0f75bc;'>${amount} ${currency}</span><br/>
      <span>${i18n[lang].participantsList}: ${participants}</span>
    </div>`;
  }).join('');
}

function renderMyHistory() {
  const myHistoryList = document.getElementById('my-history-list');
  if (!myHistoryList) return;
  const mySettles = history.filter(item => item.payer && item.payer.email === currentUserEmail);
  if (mySettles.length === 0) {
    myHistoryList.innerHTML = `<span style="color:#888;">${i18n[lang].noMyHistory}</span>`;
    return;
  }
  myHistoryList.innerHTML = mySettles.map(item => {
    const date = item.date || '-';
    const place = item.place || '-';
    const amount = item.amount || '-';
    const currency = item.currency || '';
    const participants = (item.participants || []).map(p => p.displayName || p.email).join(', ');
    const paidStatus = item.paidStatus || {};
    const unpaid = (item.participants || []).filter(part => !paidStatus[part.uid]);
    const paid = (item.participants || []).filter(part => paidStatus[part.uid]);
    const share = item.participants && item.participants.length ? (parseFloat(item.amount) / item.participants.length) : 0;
    // 미납자: 이름(미납금액)
    const unpaidList = unpaid.length ? unpaid.map(part => `<span style='color:#e74c3c;margin-right:0.7em;'>${part.displayName || part.email} <b>(${share.toLocaleString(undefined, {maximumFractionDigits:2})} ${currency})</b> <button class='remove-participant-btn' data-id='${item.id}' data-uid='${part.uid}' style='font-size:0.9em;color:#e74c3c;background:none;border:none;cursor:pointer;'>${i18n[lang].delete}</button></span>`).join('') : '<span style="color:green;">없음</span>';
    const paidList = paid.length ? paid.map(part => `<span style='color:green;margin-right:0.7em;'>${part.displayName || part.email} <button class='remove-participant-btn' data-id='${item.id}' data-uid='${part.uid}' style='font-size:0.9em;color:#e74c3c;background:none;border:none;cursor:pointer;'>${i18n[lang].delete}</button></span>`).join('') : '<span style="color:#e74c3c;">없음</span>';
    const canArchive = unpaid.length === 0;
    // 참가자 추가 버튼(항상 날짜/장소 옆에)
    const notIn = allUsers.filter(u => !(item.participants || []).some(p => p.uid === u.uid));
    const addBtn = `<button class='add-participant-btn' data-id='${item.id}' style='margin-left:0.5em;'>${i18n[lang].addParticipant}</button>`;
    return `<div class='history-item' style='font-size:1.05em;'>
      <b>${date}</b> | <b>${place}</b>${addBtn}<br/>
      <span style='color:#0f75bc;'><a href='#' style='color:#0f75bc;text-decoration:underline;'>${amount} ${currency}</a></span><br/>
      <span>${i18n[lang].participantsList}: ${participants}</span><br/>
      <span>${i18n[lang].unpaidList}: ${unpaidList}</span><br/>
      <span>${i18n[lang].paidComplete}: ${paidList}</span><br/>
      ${canArchive ? `<button class='archive-btn' data-id='${item.id}'>${i18n[lang].archive}</button>` : ''}
    </div>`;
  }).join('');
  // 참가자 삭제 이벤트
  document.querySelectorAll('.remove-participant-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = btn.getAttribute('data-id');
      const uid = btn.getAttribute('data-uid');
      const item = history.find(h => h.id === id);
      if (!item) return;
      const newParticipants = (item.participants || []).filter(p => p.uid !== uid);
      const newPaidStatus = { ...item.paidStatus };
      delete newPaidStatus[uid];
      await updateSettlementParticipants(id, newParticipants, newPaidStatus);
    });
  });
  // 참가자 추가 이벤트 (모달 select)
  document.querySelectorAll('.add-participant-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = btn.getAttribute('data-id');
      const item = history.find(h => h.id === id);
      if (!item) return;
      const notIn = allUsers.filter(u => !(item.participants || []).some(p => p.uid === u.uid));
      if (notIn.length === 0) return alert(lang === 'ko' ? '추가할 수 있는 회원이 없습니다.' : 'No members available to add.');

      // 모달 select 생성
      const modal = document.createElement('div');
      modal.style.position = 'fixed';
      modal.style.top = '0'; modal.style.left = '0'; modal.style.width = '100vw'; modal.style.height = '100vh';
      modal.style.background = 'rgba(0,0,0,0.3)';
      modal.style.display = 'flex'; modal.style.alignItems = 'center'; modal.style.justifyContent = 'center';
      modal.style.zIndex = '9999';

      const select = document.createElement('select');
      select.style.fontSize = '1.2em';
      select.style.padding = '1em';
      notIn.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.uid;
        opt.textContent = u.displayName || u.email;
        select.appendChild(opt);
      });

      const okBtn = document.createElement('button');
      okBtn.textContent = lang === 'ko' ? '추가' : 'Add';
      okBtn.style.marginLeft = '1em';
      okBtn.style.fontSize = '1em';

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = lang === 'ko' ? '취소' : 'Cancel';
      cancelBtn.style.marginLeft = '0.5em';
      cancelBtn.style.fontSize = '1em';

      const box = document.createElement('div');
      box.style.background = '#fff';
      box.style.padding = '2em';
      box.style.borderRadius = '12px';
      box.appendChild(select);
      box.appendChild(okBtn);
      box.appendChild(cancelBtn);
      modal.appendChild(box);
      document.body.appendChild(modal);

      okBtn.onclick = async () => {
        const user = notIn.find(u => u.uid === select.value);
        if (!user) return alert(lang === 'ko' ? '선택된 참가자가 없습니다.' : 'No participant selected.');
        const newParticipants = [...(item.participants || []), { uid: user.uid, email: user.email, displayName: user.displayName }];
        const newPaidStatus = { ...item.paidStatus, [user.uid]: false };
        await updateSettlementParticipants(id, newParticipants, newPaidStatus);
        document.body.removeChild(modal);
      };
      cancelBtn.onclick = () => document.body.removeChild(modal);
    });
  });
  // 보관 버튼 이벤트
  document.querySelectorAll('.archive-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = btn.getAttribute('data-id');
      const item = history.find(h => h.id === id);
      if (!item) return;
      await archiveSettlement(id, item);
      // 보관 후에는 실시간 반영(onSettlementsChanged)으로 내역에서 사라짐
    });
  });
}

function renderHistory() {
  historyList.innerHTML = '';
  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    let html = `<span class="emoji">💳</span> <b>${item.payer.displayName || item.payer.email}</b>${i18n[lang].user} <b>${item.amount} ${item.currency}</b> ${i18n[lang].paid}<br><span style="font-size:0.97em;">${i18n[lang].participantsList}: `;
    html += (item.participants || []).map(part => {
      const paid = item.paidStatus && item.paidStatus[part.uid];
      const isMe = (part.email === currentUserEmail);
      if (isMe) {
        if (paid) {
          return `<span style='color:green;'>${part.displayName || part.email} ✅</span>`;
        } else {
          return `<button data-settleid="${item.id}" data-partuid="${part.uid}" class="pay-btn" style="background:#1cb5e0;color:#fff;border:none;border-radius:6px;padding:2px 8px;cursor:pointer;">${lang === 'ko' ? '완료' : 'Done'}</button> <span style='color:#e74c3c;'>${part.displayName || part.email} ${i18n[lang].unpaid}</span>`;
        }
      } else {
        return paid ? `<span style='color:green;'>${part.displayName || part.email} ✅</span>` : `<span style='color:#e74c3c;'>${part.displayName || part.email} ${i18n[lang].unpaid}</span>`;
      }
    }).join(', ');
    html += `</span>`;
    div.innerHTML = html;
    historyList.appendChild(div);
  });
  document.querySelectorAll('.pay-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const settleId = btn.getAttribute('data-settleid');
      const partUid = btn.getAttribute('data-partuid');
      try {
        await updateSettlementPaid(settleId, partUid, true);
      } catch (err) {
        alert((lang === 'ko' ? '상태 업데이트 실패: ' : 'Status update failed: ') + err.message);
      }
    });
  });
  renderMyHistory();
  renderSettlementResult(); // 비동기 호출
  renderPayResult(); // 비동기 호출
}

if (form) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const payerUid = allUsers.find(u => u.email === currentUserEmail)?.uid;
    const payerEmail = currentUserEmail;
    const payerDisplayName = allUsers.find(u => u.email === currentUserEmail)?.displayName || currentUserEmail;
    const amount = document.getElementById('amount').value.trim();
    const currency = document.getElementById('currency').value;
    const place = document.getElementById('place').value.trim();
    const date = document.getElementById('date').value;
    let participantUids = Array.from(document.querySelectorAll('.participant-check:checked')).map(chk => chk.value);
    if (!participantUids.includes(payerUid)) participantUids.push(payerUid);
    const participants = participantUids.map(uid => {
      const u = allUsers.find(u => u.uid === uid);
      return { uid: u.uid, email: u.email, displayName: u.displayName };
    });
    // paidStatus: { [uid]: false }
    const paidStatus = {};
    participants.forEach(p => { paidStatus[p.uid] = false; });
    if (!payerUid) return alert(lang === 'ko' ? '지불자 정보가 없습니다.' : 'No payer information.');
    if (!amount) return alert(lang === 'ko' ? '금액을 입력하세요.' : 'Please enter amount.');
    if (!currency) return alert(lang === 'ko' ? '통화를 선택하세요.' : 'Please select currency.');
    if (!place) return alert(lang === 'ko' ? '장소를 입력하세요.' : 'Please enter place.');
    if (!date) return alert(lang === 'ko' ? '날짜를 입력하세요.' : 'Please enter date.');
    if (!participants.length) return alert(lang === 'ko' ? '참가자를 1명 이상 선택하세요.' : 'Please select at least one participant.');
    try {
      await addSettlement({ payer: { uid: payerUid, email: payerEmail, displayName: payerDisplayName }, amount, currency, place, date, participants, paidStatus, createdAt: Date.now() });
      form.reset();
      document.querySelectorAll('.currency-btn').forEach((btn, i) => btn.style.borderColor = i===1 ? '#0f75bc' : '#b3e0fc');
    } catch (e) {
      alert((lang === 'ko' ? 'DB 저장 실패: ' : 'Database save failed: ') + e.message);
    }
  });
}

// 최초 한글로 세팅
setLang('ko');
