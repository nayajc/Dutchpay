// Firebase Auth 관련 기능
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);

// Google 로그인
const btnGoogle = document.getElementById('btn-google');
if (btnGoogle) {
  btnGoogle.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      // DB에 회원 등록
      const db = getDatabase(app);
      const userRef = ref(db, 'users/' + user.uid);
      const snap = await get(userRef);
      if (!snap.exists()) {
        await set(userRef, {
          email: user.email,
          displayName: user.displayName || '',
          uid: user.uid
        });
        alert('멤버가입을 환영합니다.');
      }
      window.location.href = 'dashboard.html';
    } catch (e) {
      alert('Google 로그인 실패: ' + e.message);
    }
  });
}

// 이메일 로그인 및 회원가입
const btnEmail = document.getElementById('btn-email');
if (btnEmail) {
  btnEmail.addEventListener('click', async () => {
    const email = prompt('이메일을 입력하세요:');
    if (!email) return;
    const pw = prompt('비밀번호를 입력하세요:');
    if (!pw) return;
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      window.location.href = 'dashboard.html';
    } catch (e) {
      // 계정 없음 등으로 로그인 실패 시 회원가입 안내
      if (e.code === 'auth/user-not-found') {
        if (confirm('계정이 없습니다. 회원가입 하시겠습니까?')) {
          try {
            await createUserWithEmailAndPassword(auth, email, pw);
            alert('회원가입 성공!');
            window.location.href = 'dashboard.html';
          } catch (signupErr) {
            alert('회원가입 실패: ' + signupErr.message);
          }
        }
      } else if (e.code === 'auth/invalid-login-credentials') {
        alert('비밀번호가 틀렸거나 회원이 아닙니다. 회원가입을 해주세요');
        window.location.href = 'index.html';
      } else {
        alert('이메일 로그인 실패: ' + e.message);
      }
    }
  });
}

const btnSignup = document.getElementById('btn-signup');
if (btnSignup) {
  btnSignup.addEventListener('click', async () => {
    const email = prompt('이메일을 입력하세요:');
    if (!email) return;
    const pw = prompt('비밀번호를 입력하세요:');
    if (!pw) return;
    try {
      await createUserWithEmailAndPassword(auth, email, pw);
      alert('회원가입 성공!');
      window.location.href = 'dashboard.html';
    } catch (e) {
      alert('회원가입 실패: ' + e.message);
    }
  });
}

// 다국어 지원
const i18n = {
  ko: {
    title: 'KK DutchPay',
    desc1: '번갈아 밥값 내기, 자동 정산!',
    desc2: '환율까지 자동 계산, 복잡한 더치페이 끝!',
    google: 'Google로 로그인',
    email: '이메일로 로그인',
    made: 'Made by CowboyBibimbap',
  },
  en: {
    title: 'KK DutchPay',
    desc1: 'Take turns paying, auto split!',
    desc2: 'Even currency rates, no more Dutch headaches!',
    google: 'Login with Google',
    email: 'Login with Email',
    made: 'Made by CowboyBibimbap',
  }
};
let lang = 'ko';
function setLang(newLang) {
  lang = newLang;
  document.querySelector('.logo').innerHTML = `${i18n[lang].title} <span class="emoji">💸</span>`;
  document.querySelector('.desc').innerHTML = `<span class="emoji">🍽️👫🌏</span><br/>${i18n[lang].desc1}<br/><small>${i18n[lang].desc2}</small>`;
  document.getElementById('btn-google').innerHTML = `<span class="emoji" style="margin-right:0.6em;">🔑</span> ${i18n[lang].google}`;
  document.getElementById('btn-email').innerHTML = `<span class="emoji" style="margin-right:0.6em;">📧</span> ${i18n[lang].email}`;
  document.querySelector('.footer').innerHTML = `<span class="emoji">🌐</span> ${i18n[lang].made}<br/><small>© 2024 DutchPay Splitter</small>`;
  document.getElementById('lang-toggle').textContent = lang === 'ko' ? '🇺🇸' : '🇰🇷';
}
const langBtn = document.getElementById('lang-toggle');
if (langBtn) {
  langBtn.addEventListener('click', () => {
    setLang(lang === 'ko' ? 'en' : 'ko');
  });
}
setLang('ko');
