import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Firebase Configuration (ご自身のものに差し替えてください) ---
const firebaseConfig {
  apiKey: "AIzaSyAkmxcg0LykyxIlBnvJQIiiPI_H8Dy_koM",
  authDomain: "universal-8d7eb.firebaseapp.com",
  projectId: "universal-8d7eb",
  storageBucket: "universal-8d7eb.firebasestorage.app",
  messagingSenderId: "242890668753",
  appId: "1:242890668753:web:a94bf7f0eecf6f4efda3f0",
  measurementId: "G-KHLCH9QYEZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'cosmic-message-app';

let user = null;
let messages = [];
let time = 0;
let audioCtx = null;

// --- オーディオエンジン ---
window.initAudio = () => {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    const createDrone = (freq) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.connect(gain); gain.connect(masterGain);
        osc.start();
    };
    createDrone(60); createDrone(90);
};

// --- Cosmic ID 生成 ---
const generateCosmicId = (uid) => {
    const prefixes = ["NOVA", "VOYAGER", "ORION", "ZODIAC", "STELLAR"];
    const index = uid ? uid.charCodeAt(0) % prefixes.length : 0;
    const suffix = uid ? uid.substring(0, 4).toUpperCase() : "XXXX";
    return `${prefixes[index]}-${suffix}`;
};

// --- Firebase 認証 ---
signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
onAuthStateChanged(auth, u => user = u);

// --- Firestore リアルタイム監視 ---
const msgCol = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
onSnapshot(msgCol, (snapshot) => {
    document.getElementById('visitor-count').innerText = `ACTIVE_NODES: ${snapshot.size + 1069}`;
    
    snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
            const data = change.doc.data();
            // 新規メッセージをリストに追加（初期位置などはランダム）
            messages.push({
                id: change.doc.id,
                text: data.text || "",
                userId: data.userId,
                currentX: 20 + Math.random() * 60,
                currentY: 105,
                floatVelocity: -0.012 - Math.random() * 0.006,
                phase: Math.random() * Math.PI * 2,
                opacity: 0,
                element: null // 後でDOM要素を紐付け
            });
        }
    });
});

// --- アニメーションループ (毎秒60回実行) ---
function animate() {
    time += 0.005;
    const container = document.getElementById('message-stream');
    const bg = document.getElementById('bg-container');

    // 背景のゆらぎ
    if (bg) {
        bg.style.transform = `scale(${1.25 + Math.sin(time * 0.02) * 0.03}) translate(${Math.cos(time * 0.04) * 15}px, ${Math.sin(time * 0.04) * 8}px)`;
    }

    messages.forEach((msg) => {
        // 位置計算
        msg.currentY += msg.floatVelocity;
        const dX = msg.currentX + Math.sin(time * 0.2 + msg.phase) * 4;
        const dY = msg.currentY + Math.cos(time * 0.2 + msg.phase) * 3;

        // 透明度の制御（下から現れ、上で消える）
        if (msg.currentY > 10) msg.opacity = Math.min(1, msg.opacity + 0.02);
        if (msg.currentY < 5) msg.opacity = Math.max(0, msg.opacity - 0.02);

        // 初回のみHTML要素を作成
        if (!msg.element) {
            msg.element = document.createElement('div');
            msg.element.className = 'message-node';
            msg.element.innerHTML = `
                <div class="meta-info">
                    <span class="cosmic-id">${generateCosmicId(msg.userId)}</span>
                </div>
                <div class="message-bubble">${msg.text}</div>
            `;
            container.appendChild(msg.element);
        }

        // 実際の表示に反映
        msg.element.style.left = `${dX}%`;
        msg.element.style.top = `${dY}%`;
        msg.element.style.opacity = msg.opacity;
    });

    // 画面外に去ったメッセージを配列とDOMから削除
    messages = messages.filter(m => {
        if (m.currentY < -20) {
            if (m.element) m.element.remove();
            return false;
        }
        return true;
    });

    requestAnimationFrame(animate);
}

// ループ開始
requestAnimationFrame(animate);

// --- メッセージ送信 ---
document.getElementById('input-form').onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('message-input');
    const text = input.value.trim();

    if (!text || !user) return;

    try {
        await addDoc(msgCol, {
            text: text,
            userId: user.uid,
            createdAt: serverTimestamp()
        });
        input.value = '';
    } catch (err) {
        console.error("Submit Error:", err);
    }
};
