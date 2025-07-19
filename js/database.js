import { getDatabase, ref, push, onValue, get, update } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getDatabase(app);
const auth = getAuth();

// 정산 내역 추가
export function addSettlement(data) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 필요');
  const listRef = ref(db, `settlements/${user.uid}`);
  // 참가자별 paidStatus 초기화
  const paidStatus = {};
  (data.participants || []).forEach(p => { paidStatus[p.uid] = false; });
  return push(listRef, { ...data, paidStatus });
}

// 정산 내역 전체 불러오기 (1회성)
export function getSettlements(cb) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 필요');
  const listRef = ref(db, `settlements/${user.uid}`);
  get(listRef).then(snapshot => {
    const arr = [];
    snapshot.forEach(child => {
      arr.push({ id: child.key, ...child.val() });
    });
    cb(arr);
  });
}

// 정산 내역 실시간 감지
export function onSettlementsChanged(cb) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 필요');
  const listRef = ref(db, `settlements/${user.uid}`);
  onValue(listRef, snapshot => {
    const arr = [];
    snapshot.forEach(child => {
      arr.push({ id: child.key, ...child.val() });
    });
    cb(arr);
  });
}

// 참가자별 정산 완료 상태 업데이트
export function updateSettlementPaid(settlementId, participant, paid) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 필요');
  const paidRef = ref(db, `settlements/${user.uid}/${settlementId}/paidStatus/${participant}`);
  return update(paidRef, { '.value': paid });
}

// 모든 회원(유저) 목록 불러오기
export function getAllUsers(cb) {
  const db = getDatabase(app);
  const usersRef = ref(db, 'users');
  get(usersRef).then(snapshot => {
    const arr = [];
    snapshot.forEach(child => {
      arr.push({ uid: child.key, ...child.val() });
    });
    cb(arr);
  });
}
