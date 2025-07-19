import { getDatabase, ref, push, onValue, get, update, set } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
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
export function updateSettlementPaid(settlementId, participantUid, paid) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 필요');
  const paidRef = ref(db, `settlements/${user.uid}/${settlementId}/paidStatus/${participantUid}`);
  return set(paidRef, paid);
}

// 참가자 목록 수정 (추가/삭제)
export function updateSettlementParticipants(settlementId, participants, paidStatus) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 필요');
  const refSettle = ref(db, `settlements/${user.uid}/${settlementId}`);
  return update(refSettle, { participants, paidStatus });
}

// 정산 내역 보관(archive)
export function archiveSettlement(settlementId, data) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 필요');
  const archiveRef = ref(db, `settlements/${user.uid}/archive/${settlementId}`);
  return set(archiveRef, data);
}
// 보관된 내역 불러오기 (1회성)
export function getArchivedSettlements(cb) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 필요');
  const archiveRef = ref(db, `settlements/${user.uid}/archive`);
  get(archiveRef).then(snapshot => {
    const arr = [];
    snapshot.forEach(child => {
      arr.push({ id: child.key, ...child.val() });
    });
    cb(arr);
  });
}
// 보관된 내역 실시간 감지
export function onArchivedSettlementsChanged(cb) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 필요');
  const archiveRef = ref(db, `settlements/${user.uid}/archive`);
  onValue(archiveRef, snapshot => {
    const arr = [];
    snapshot.forEach(child => {
      arr.push({ id: child.key, ...child.val() });
    });
    cb(arr);
  });
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
