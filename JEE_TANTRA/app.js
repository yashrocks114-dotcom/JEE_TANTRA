import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, addDoc, onSnapshot, deleteDoc, serverTimestamp, query, where, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js';

// ==========================================
// INITIALIZATION
// ==========================================
let db, auth, storage, appId;
let confirmationResult = null; 

const configRaw = '{"apiKey":"AIzaSyAC-rfTdL9m0aVmvNvFtaV2ruutFYL9MMg","authDomain":"jee-tantra-portal.firebaseapp.com","projectId":"jee-tantra-portal","storageBucket":"jee-tantra-portal.firebasestora[...]","messagingSenderId":"367640400583","appId":"1:367640400583:web:d8c5318ffb9110cb30e4e2"}';

let isAdmin = false, session = null, capT = 0;
let pendingVideoFile = null; 
window.portalData = { videos: {}, blogs: {} }; 

let guruLog = [{ role: 'assistant', text: "Hello! I am **Guru AI v3.0**, the dedicated portal mentor for Yash Mishra.\n\nI have access to major formula sheets and strategies for JEE preparation. What would you like to know today?\n\nLaTeX ($...$) is active for Physics and Math formulas." }];
window.currentAITask = null;

// Backend URL
const BACKEND_URL = "http://localhost:3000";

// Meeting System Variables
let peerConnection = null, localStream = null, remoteStream = null, roomId = null;
let isAudioMuted = false, isVideoMuted = false, isScreenSharing = false, screenStream = null;
window.currentMeetingUID = null;

const configuration = { iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] };

// ==========================================
// WINDOW LOAD
// ==========================================
window.onload = () => { 
    lucide.createIcons(); 
    bootSystem(); 
    genGfx(); 
    dndInit(); 
    // Check for auto-join from URL
    checkAutoJoin();
};

// ==========================================
// AUTH SECTION (✅ UNCHANGED)
// ==========================================
window.switchAuth = (t) => {
    const sF = document.getElementById('afS'), aF = document.getElementById('afA');
    const sT = document.getElementById('atS'), aT = document.getElementById('atA');
    if(sF && aF && sT && aT) {
        sF.classList.toggle('hidden-element', t === 'A'); aF.classList.toggle('hidden-element', t === 'S');
        sT.classList.toggle('bg-white', t === 'S'); aT.classList.toggle('bg-white', t === 'A');
        sT.classList.toggle('dark:bg-slate-700', t === 'S'); aT.classList.toggle('dark:bg-slate-700', t === 'A');
    }
};

const bootSystem = async () => {
    if (!configRaw) return;
    try {
        const fb = JSON.parse(configRaw);
        const app = initializeApp(fb);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        
        const rawId = typeof __app_id !== 'undefined' ? __app_id : 'yash-hub-v3';
        appId = rawId.split('/')[0].replace(/[^a-zA-Z0-9]/g, '_');

        onAuthStateChanged(auth, (u) => { 
            if(u) { 
                syncNodeData(); 
                const s = localStorage.getItem('tantra_session'); 
                if(s) { 
                    session = JSON.parse(s); 
                    finalizeNodeUI(); 
                    document.getElementById('loginModal').classList.add('hidden-element');
                    // Sync scheduled meetings after login
                    setTimeout(() => syncScheduledMeets(), 1000);
                } 
            } 
        });
    } catch(e) { console.error("Boot Failure:", e); }
};

window.loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        window.msg("Connecting to Google Node..."); 
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userName = user.displayName || user.email.split('@')[0];
        authF({ id: userName, type: 'Student' });
    } catch (error) {
        console.error("Google Auth Error:", error);
        if (error.code === 'auth/popup-closed-by-user') {
            window.msg("Login Cancelled.");
        } else {
            alert("Google Login Error: " + error.message);
        }
    }
};

window.sendOTP = async () => { 
    const mobInput = document.getElementById('uM').value;
    if(mobInput.length < 10) return alert("Sahi 10-digit number daalo bhai!");

    const phoneNumber = mobInput.startsWith('+') ? mobInput : '+91' + mobInput;
    const btn = document.getElementById('otpSendBtn');
    btn.innerText = "Connecting to Satellite...";
    btn.disabled = true;

    try {
        if(!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });
        }
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
        document.getElementById('s1').classList.add('hidden-element'); 
        document.getElementById('s2').classList.remove('hidden-element'); 
        window.msg("OTP Sent to " + phoneNumber);
    } catch(error) {
        console.error("SMS Error:", error);
        alert("Error: " + error.message);
        btn.innerText = "Send OTP";
        btn.disabled = false;
    }
};

window.valS = async () => { 
    const otp = document.getElementById('uO').value;
    if(otp.length !== 6) return alert("6-digit ka OTP daal!");

    const btn = document.getElementById('otpVerifyBtn');
    btn.innerText = "Decrypting Node...";
    btn.disabled = true;

    try {
        const result = await confirmationResult.confirm(otp);
        authF({ id: result.user.phoneNumber, type: 'Student' }); 
    } catch (error) {
        console.error("OTP Error:", error);
        alert("Galat OTP hai bhai, wapas check kar!");
        btn.innerText = "Verify Node";
        btn.disabled = false;
    }
};

window.valA = async () => { 
    const btn = document.querySelector('button[onclick="valA()"]');
    if(document.getElementById('aU').value === 'Yash_05' && document.getElementById('aP').value === 'Yashmishra@2011') { 
        try {
            btn.innerText = "Verifying Node...";
            await signInAnonymously(auth);
            await authF({ id: 'Yash_05', type: 'Admin' }); 
            btn.innerText = "Access Terminal"; 
        } catch (error) {
            console.error("Admin Auth Error:", error);
            alert("Database connection failed! Console check karo.");
            btn.innerText = "Access Terminal";
        }
    } else { 
        alert("Node Denied."); 
    } 
};

async function authF(data) {
    session = data; 
    isAdmin = (data.type === 'Admin');
    localStorage.setItem('tantra_session', JSON.stringify(data));
    
    if(db && auth.currentUser) { 
        addDoc(collection(db, 'auth_logs'), { appId: appId, node: data.id, time: serverTimestamp() })
        .catch(e => console.warn("Log tracking issue (Ignore):", e)); 
    } 
    finalizeNodeUI(); 
    document.getElementById('loginModal').classList.add('hidden-element'); 
    window.msg("Identity Verified");
}

window.msg = (text) => {
    const t = document.getElementById('globalToast');
    if(t) { t.innerText = text; t.classList.remove('hidden'); setTimeout(() => t.classList.add('hidden'), 3000); }
};

function finalizeNodeUI() {
    document.getElementById('loginTrigger').classList.add('hidden');
    const p = document.getElementById('userProfile'); if(p) { p.classList.remove('hidden-element'); p.classList.add('flex'); }
    const n = document.getElementById('userName'); if(n) { n.innerText = session.id; n.className = isAdmin ? "text-[10px] font-black bg-red-100 dark:bg-red-900/30 text-red-600 px-3 py-1.5 rounded-xl border border-red-200 uppercase tracking-widest" : "text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 px-3 py-1.5 rounded-xl border border-emerald-200 uppercase tracking-widest"; }
    if(isAdmin) document.getElementById('adminSection').classList.remove('hidden-element');
    lucide.createIcons(); 
    syncNodeData();
    document.getElementById('mobileBottomNav').classList.remove('hidden-element');
}

window.logoutSession = () => { localStorage.removeItem('tantra_session'); location.reload(); };

// ==========================================
// VIDEO & BLOG SYNC (✅ UNCHANGED)
// ==========================================
function syncNodeData() {
    if(!db || !auth.currentUser) return;
    const qV = query(collection(db, 'videos'), where('appId', '==', appId));
    onSnapshot(qV, (s) => {   
        const list = s.docs.map(d => ({id: d.id, ...d.data()}));
        list.forEach(v => { window.portalData.videos[v.id] = v; });
        renderV(list);
    }, (e) => console.error("Sync Error (Videos):", e));
    
    const qB = query(collection(db, 'blogs'), where('appId', '==', appId));
    onSnapshot(qB, (s) => {
        const list = s.docs.map(d => ({id: d.id, ...d.data()}));
        list.forEach(b => { window.portalData.blogs[b.id] = b; });
        renderB(list);
    }, (e) => console.error("Sync Error (Blogs):", e));
}

function renderV(l) {
    const g = document.getElementById('view-video'); if(!g) return;
    g.innerHTML = l.length ? '' : '<p class="col-span-full py-24 text-center opacity-30 font-black uppercase tracking-widest italic">Node Empty</p>';
    l.forEach(v => {
        const el = document.createElement('div');
        el.className = "group bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[3.5rem] overflow-hidden hover:shadow-2xl transition-all duration-700 hover:-translate-y-4 shadow-xl";
        el.innerHTML = `
            <div class="aspect-video bg-slate-950 relative cursor-pointer" onclick="openNodePlayer('${v.id}')">
                <div class="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><i data-lucide="play" size="48" fill="white" class="scale-50 group-hover:scale-100 transition-all duration-700"></i></div>
            </div>
            <div class="p-12">
                <div class="flex justify-between items-start mb-6">
                    <h3 class="font-black text-2xl uppercase italic tracking-tighter leading-none group-hover:text-indigo-600 transition-colors">${v.title}</h3>
                    ${isAdmin ? `<button onclick="delDoc('videos', '${v.id}')" class="text-red-500 hover:scale-110 transition-transform"><i data-lucide="trash-2" size="24"></i></button>` : ''}
                </div>
                <p class="text-slate-500 dark:text-slate-400 text-lg line-clamp-3 opacity-80 leading-relaxed">${v.description || 'Premium archive asset.'}</p>
            </div>`;
        g.appendChild(el);
    });
    lucide.createIcons();
}

function renderB(l) {
    const t = document.getElementById('view-blog'); if(!t) return;
    t.innerHTML = l.length ? '' : '<p class="py-24 text-center opacity-30 uppercase tracking-[0.5em] font-black italic">No strategies posted</p>';
    l.forEach(b => {
        const art = document.createElement('article');
        art.className = "bg-white dark:bg-slate-900 p-16 rounded-[5rem] border border-slate-100 dark:border-slate-800 shadow-2xl mb-16 hover:shadow-indigo-500/10 transition-all relative";
        art.innerHTML = `
            <div class="flex justify-between items-center mb-14">
                <span class="text-xs font-black uppercase text-indigo-600 italic leading-none border border-indigo-200 px-3 py-1 rounded-lg">Master Strategy</span>
                ${isAdmin ? `<button onclick="delDoc('blogs', '${b.id}')" class="text-red-500 hover:scale-110 transition-transform"><i data-lucide="trash-2" size="32"></i></button>` : ''}
            </div>
            <h2 class="text-5xl md:text-6xl font-black tracking-tighter uppercase mb-12 group-hover:text-indigo-600 leading-none italic">${b.title}</h2>
            <div class="text-slate-600 dark:text-slate-400 text-2xl font-medium leading-relaxed markdown-content">${marked.parse(b.content || '')}</div>
        `;
        t.appendChild(art);
    });
    if(typeof renderMathInElement === 'function') renderMathInElement(t, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] });
    lucide.createIcons();
}

// ==========================================
// VIDEO PLAYER (✅ UNCHANGED)
// ==========================================
window.openNodePlayer = (id) => {
    window.currentVideoId = id; 
    const v = window.portalData.videos[id]; 
    if(!v) return;
    
    const m = document.getElementById('playerModal'), p = document.getElementById('mediaNode');
    document.getElementById('mediaTitle').innerText = v.title; 
    document.getElementById('mediaDesc').innerText = v.description || '';
    p.innerHTML = '';
    
    const match = v.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    
    if(match && match[1]) { 
        p.innerHTML = `<iframe class="w-full h-full absolute inset-0 rounded-[4rem]" src="https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`; 
    } else { 
        p.innerHTML = `
        <div id="videoContainer" class="relative w-full h-full group bg-black rounded-[4rem] overflow-hidden flex items-center justify-center">
            <video id="tantraVideo" src="${v.url}" class="w-full h-full object-contain" preload="metadata" autoplay playsinline style="filter: brightness(1);"></video>
            <div id="playerUI" class="absolute inset-0 z-30 opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-6">
                <div class="flex justify-end"><button onclick="closePlayer()" class="bg-red-500/20 hover:bg-red-500 text-white p-3 rounded-full backdrop-blur-md transition-all active:scale-90"><i data-lucide="x" size="24"></i></button></div>
                <div class="bg-gradient-to-t from-black via-black/80 to-transparent pt-10 -mx-6 -mb-6 px-8 pb-8">
                    <div class="w-full h-3 bg-white/20 rounded-full cursor-pointer relative group/bar mb-6" id="progressContainer" onclick="seekVideo(event)">
                        <div id="progressBar" class="absolute top-0 left-0 h-full bg-indigo-600 w-0 pointer-events-none transition-all duration-75 relative"></div>
                    </div>
                    <div class="flex items-center justify-between text-white">
                        <div class="flex items-center gap-6">
                            <button onclick="togglePlay()" class="hover:text-indigo-400 transition-all"><i id="playIcon" data-lucide="pause" size="32"></i></button>
                            <span id="timeDisplay" class="font-mono text-sm md:text-base font-bold tracking-widest uppercase">00:00 / 00:00</span>
                        </div>
                        <div class="flex items-center gap-6">
                            <select id="speedCtrl" onchange="changeSpeed()" class="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer text-black">
                                <option value="0.5">0.5x</option><option value="1" selected>1.0x</option><option value="1.5">1.5x</option><option value="2">2.0x</option>
                            </select>
                            <button onclick="toggleFullScreen()" class="hover:text-indigo-400 transition-all"><i id="fsIcon" data-lucide="maximize" size="28"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`; 
        setTimeout(initCustomPlayer, 100);
    }
    m.classList.remove('hidden-element');
    lucide.createIcons();
};

window.closePlayer = async () => { 
    const v = document.getElementById('tantraVideo');
    if(v) {
        v.pause();
        if(session && session.id && window.currentVideoId && v.duration) {
            const pct = Math.round((v.currentTime / v.duration) * 100);
            try {
                await setDoc(doc(db, 'progress', `${appId}_${session.id}_${window.currentVideoId}`), {
                    appId: appId, userId: session.id, videoId: window.currentVideoId,
                    title: document.getElementById('mediaTitle').innerText, progress: pct, timestamp: serverTimestamp()
                }, { merge: true });
            } catch(e) { console.error("Tracker Error:", e); }
        }
    }
    document.getElementById('mediaNode').innerHTML = ''; 
    document.getElementById('playerModal').classList.add('hidden-element'); 
    if(document.fullscreenElement) document.exitFullscreen();
};

window.initCustomPlayer = () => {
    const vid = document.getElementById('tantraVideo'); if(!vid) return;
    lucide.createIcons();
    vid.ontimeupdate = () => {
        const pBar = document.getElementById('progressBar'), tDisp = document.getElementById('timeDisplay');
        if(pBar) pBar.style.width = ((vid.currentTime / vid.duration) * 100) + '%';
        if(tDisp && vid.duration) tDisp.innerText = `${Math.floor(vid.currentTime/60)}:${Math.floor(vid.currentTime%60).toString().padStart(2,'0')} / ${Math.floor(vid.duration/60)}:${Math.floor(vid.duration%60).toString().padStart(2,'0')}`;
    };
    vid.onplay = () => { document.getElementById('playIcon').setAttribute('data-lucide', 'pause'); lucide.createIcons(); };
    vid.onpause = () => { document.getElementById('playIcon').setAttribute('data-lucide', 'play'); lucide.createIcons(); };
};
window.togglePlay = () => { const v = document.getElementById('tantraVideo'); if(v) v.paused ? v.play() : v.pause(); };
window.changeSpeed = () => { const v = document.getElementById('tantraVideo'); if(v) v.playbackRate = parseFloat(document.getElementById('speedCtrl').value); };
window.seekVideo = (e) => { const v = document.getElementById('tantraVideo'), r = document.getElementById('progressContainer').getBoundingClientRect(); if(v && v.duration) v.currentTime = ((e.clientX - r.left) / r.width) * v.duration; };
window.toggleFullScreen = () => { const c = document.getElementById('videoContainer'); if(!document.fullscreenElement) c.requestFullscreen(); else document.exitFullscreen(); };

// ==========================================
// TTS & AUDIO (✅ UPDATED)
// ==========================================
window.playTTS = async (encodedText) => {
    const text = decodeURIComponent(encodedText).replace(/[#*_$]/g, ''); 
    window.msg("🎵 Connecting to Murf AI Studio...");

    try {
        const response = await fetch(`${BACKEND_URL}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'omit',
            body: JSON.stringify({ 
                text: text.substring(0, 1000),
                langVoice: "en-IN-ehaan"
            })
        });

        if (!response.ok) {
            throw new Error(`TTS Backend Error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || "TTS API Error");
        }

        if (data.audioFile) {
            const audio = new Audio(data.audioFile);
            audio.onplay = () => window.msg("🎵 Broadcasting Premium Audio...");
            audio.onerror = () => {
                console.warn("Audio playback failed, falling back to Web Speech API");
                fallbackTTS(text);
            };
            audio.play();
        } else if (data.murf_content_type === 'audio/mpeg') {
            const audio = new Audio('data:audio/mpeg;base64,' + data.audioContent);
            audio.play();
            window.msg("🎵 Broadcasting Premium Audio...");
        } else {
            console.warn("Unexpected response format from TTS:", data);
            fallbackTTS(text);
        }
    } catch(e) {
        console.error("Premium Audio Failed:", e);
        window.msg("🔊 Using basic audio engine...");
        fallbackTTS(text);
    }
};

function fallbackTTS(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-IN';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        window.speechSynthesis.speak(utterance);
    }
}

// ==========================================
// GURU AI CHAT (WITH STOP LOGIC)
// ==========================================
document.getElementById('aiForm').onsubmit = async (e) => {
    e.preventDefault(); 
    
    if (window.currentAITask) {
        window.currentAITask.abort(); 
        window.currentAITask = null;
        resetAIUI();
        window.msg("🛑 Generation Stopped");
        return;
    }

    const i = document.getElementById('aiInput'), v = i.value.trim(); 
    if(!v) return;
    
    guruLog.push({ role: 'user', text: v }); 
    i.value = ''; 
    renderGuru();

    const submitIcon = document.getElementById('aiSubmitIcon');
    if(submitIcon) { submitIcon.setAttribute('data-lucide', 'square'); lucide.createIcons(); }

    window.currentAITask = new AbortController(); 

    let contextData = "Current Portal Strategies available from Yash Mishra:\n";
    Object.values(window.portalData.blogs).forEach(b => { contextData += `\nTitle: ${b.title}\nContent: ${b.content}\n`; });

    try {
        const r = await fetch(`${BACKEND_URL}/api/guru`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            credentials: 'omit',
            signal: window.currentAITask.signal,
            body: JSON.stringify({ 
                tool: window.currentAITool,
                messages: [ 
                    { role: "system", content: `You are Guru AI v3.0, the dedicated portal mentor for Yash Mishra. You have access to major formula sheets and strategies for JEE preparation. Use LaTeX ($...$) for Physics and Math formulas. Context:\n${contextData}` }, 
                    { role: "user", content: v } 
                ] 
            }) 
        });

        if (!r.ok) throw new Error(`Backend error: ${r.status}`);
        const d = await r.json();
        if(d.error) throw new Error(d.error.message || "API Error");

        const fullText = d.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
        
        guruLog.push({ role: 'assistant', text: "" }); 
        renderGuru(); 
        
        const hist = document.getElementById('aiHistory');
        const lastBubble = hist.lastElementChild;
        let charIndex = 0;
        
        window.typeWriterInterval = setInterval(() => {
            if (!window.currentAITask) { clearInterval(window.typeWriterInterval); return; }

            if (charIndex < fullText.length) {
                guruLog[guruLog.length - 1].text += fullText.charAt(charIndex);
                lastBubble.innerHTML = window.formatAIText(guruLog[guruLog.length - 1].text);
                hist.scrollTop = hist.scrollHeight;
                charIndex++;
            } else {
                clearInterval(window.typeWriterInterval);
                resetAIUI(); 
                window.saveChatSession(); // Save automatically
                
                if(typeof renderMathInElement === 'function') {
                    try { renderMathInElement(lastBubble, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}, {left: "\\[", right: "\\]", display: true}, {left: "\\(", right: "\\)", display: false}] }); } catch(e){}
                }
                
                try {
                    const mermaidDivs = lastBubble.querySelectorAll('.mermaid');
                    if(mermaidDivs.length > 0) mermaid.init(undefined, mermaidDivs);
                } catch(err) { console.error(err); }

                if(window.playTTS && window.currentAITool === 'chat') { window.playTTS(encodeURIComponent(fullText)); }
            }
        }, 15);

    } catch(e) { 
        resetAIUI();
        if (e.name === 'AbortError') {
            guruLog[guruLog.length - 1].text = "*(Generation stopped by user)*";
        } else {
            console.error("Chat Error:", e);
            guruLog[guruLog.length - 1].text = `**Error:** ${e.message}`; 
            window.msg("❌ Connection failed.");
        }
        renderGuru(); 
    }
};

// Helper: Reset Submit Button
function resetAIUI() {
    window.currentAITask = null;
    const submitIcon = document.getElementById('aiSubmitIcon');
    if(submitIcon) { submitIcon.setAttribute('data-lucide', 'arrow-up'); lucide.createIcons(); }
}

// ==========================================
// CHAT HISTORY MANAGEMENT (GEMINI STYLE)
// ==========================================
window.chatSessionId = Date.now().toString();

window.saveChatSession = () => {
    if(guruLog.length <= 1) return; // Empty chat save nahi karni
    
    let sessions = JSON.parse(localStorage.getItem('guru_chat_sessions') || '{}');
    
    // Auto-generate title from first prompt
    let title = "New Strategy Chat";
    const firstUserMsg = guruLog.find(m => m.role === 'user');
    if(firstUserMsg) {
        title = firstUserMsg.text.substring(0, 35) + (firstUserMsg.text.length > 35 ? '...' : '');
    }

    sessions[window.chatSessionId] = {
        id: window.chatSessionId,
        title: title,
        date: new Date().toISOString(),
        log: guruLog
    };
    
    localStorage.setItem('guru_chat_sessions', JSON.stringify(sessions));
};

window.toggleChatHistory = () => {
    const overlay = document.getElementById('chatHistoryOverlay');
    overlay.classList.toggle('hidden');
    overlay.classList.toggle('flex');
    
    if(!overlay.classList.contains('hidden')) {
        window.saveChatSession(); // Khulte hi pehle current save karo
        window.renderChatHistoryList();
    }
    lucide.createIcons();
};

window.renderChatHistoryList = () => {
    const list = document.getElementById('historyList');
    let sessions = JSON.parse(localStorage.getItem('guru_chat_sessions') || '{}');
    const sessionArray = Object.values(sessions).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if(sessionArray.length === 0) {
        list.innerHTML = '<p class="text-center text-slate-400 text-xs font-bold mt-8">📭 No past chats found.</p>';
        return;
    }

    list.innerHTML = '';
    sessionArray.forEach(session => {
        const btn = document.createElement('div');
        btn.className = "w-full text-left p-3 rounded-xl bg-slate-100 dark:bg-[#2f2f2f] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex justify-between items-center group cursor-pointer border border-transparent hover:border-indigo-500/30";
        btn.innerHTML = `
            <div class="flex-1 truncate pr-3" onclick="loadChatSession('${session.id}')">
                <p class="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">${session.title}</p>
                <p class="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">${new Date(session.date).toLocaleDateString()}</p>
            </div>
            <div class="p-2 text-slate-400 hover:text-red-500 transition-colors bg-white dark:bg-[#212121] rounded-lg shadow-sm" onclick="deleteChatSession('${session.id}', event)" title="Delete">
                <i data-lucide="trash" size="14"></i>
            </div>
        `;
        list.appendChild(btn);
    });
    lucide.createIcons();
};

window.loadChatSession = (id) => {
    let sessions = JSON.parse(localStorage.getItem('guru_chat_sessions') || '{}');
    if(sessions[id]) {
        window.chatSessionId = id;
        guruLog = sessions[id].log;
        window.renderGuru();
        window.toggleChatHistory(); // Drawer band karo
        window.msg("📂 Chat Loaded");
    }
};

window.deleteChatSession = (id, event) => {
    event.stopPropagation();
    if(!confirm("Delete this chat permanently?")) return;
    let sessions = JSON.parse(localStorage.getItem('guru_chat_sessions') || '{}');
    delete sessions[id];
    localStorage.setItem('guru_chat_sessions', JSON.stringify(sessions));
    window.renderChatHistoryList();
    
    // Agar current chat delete ki hai, toh new shuru karo
    if(id === window.chatSessionId) {
        window.clearGuruChat(true);
    }
};

window.clearGuruChat = (force = false) => {
    if(!force && guruLog.length > 1) {
        window.saveChatSession(); // Clear karne se pehle save karo
    }
    
    if(!force && !confirm("Start a new blank chat?")) return;
    
    if (window.currentAITask) {
        window.currentAITask.abort();
        resetAIUI();
    }
    
    window.chatSessionId = Date.now().toString(); // Generate Naya ID
    guruLog = [{ role: 'assistant', text: "Hello! I am **Guru AI v3.0**, the dedicated portal mentor for Yash Mishra.\n\nI have access to major formula sheets and strategies for JEE preparation. What would you like to know today?\n\nLaTeX ($...$) is active for Physics and Math formulas." }];
    
    window.renderGuru();
    window.msg("✨ New Chat Started");
    
    const overlay = document.getElementById('chatHistoryOverlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
};

window.playAIPodcast = async () => {
    const topicInput = document.getElementById('podcastTopic');
    const topic = topicInput && topicInput.value.trim() !== '' ? topicInput.value.trim() : "Best Motivation for IIT JEE";
    
    const s = document.getElementById('podcastStatus'); 
    s.innerText = `🎤 Scripting Podcast on: ${topic}...`;
    window.msg("📝 Generating podcast script...");

    try {
        const r = await fetch(`${BACKEND_URL}/api/guru`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            credentials: 'omit',
            body: JSON.stringify({ 
                messages: [
                    { 
                        role: "system", 
                        content: "You are an engaging podcast host. Explain the topic easily. Do not use asterisks or formatting, just plain spoken text. Keep it under 1 minute when read aloud." 
                    }, 
                    { 
                        role: "user", 
                        content: `Write a 1-minute podcast script about: ${topic}` 
                    }
                ] 
            }) 
        });

        if (!r.ok) {
            throw new Error(`Backend error: ${r.status}`);
        }

        const d = await r.json();
        
        if(d.error) {
            throw new Error(d.error.message || "Failed to generate script");
        }

        const scriptText = d.choices?.[0]?.message?.content || "Unable to generate podcast";
        
        s.innerText = "🎵 Synthesizing Studio Audio...";
        window.msg("🔊 Generating audio...");
        
        await window.playTTS(encodeURIComponent(scriptText));
        s.innerText = `✅ Playing: ${topic}`;

    } catch(e) { 
        console.error("Podcast Error:", e);
        s.innerText = "❌ Stream Failed. Check Console."; 
        window.msg(`Podcast Error: ${e.message}`);
    }
};

window.renderGuru = () => {
    const hist = document.getElementById('aiHistory');
    if (!hist) return;
    hist.innerHTML = '';
    guruLog.forEach(m => {
        const div = document.createElement('div');
        div.className = m.role === 'user' 
            ? 'ml-auto max-w-[80%] bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl text-right text-indigo-700 dark:text-indigo-300 font-medium shadow-sm' 
            : 'mr-auto max-w-[90%] bg-slate-50 dark:bg-[#2f2f2f] p-5 rounded-2xl text-left text-slate-700 dark:text-slate-300 markdown-content shadow-sm overflow-hidden';
        
        // NAYA FORMATTER USE KIYA YAHAN
        div.innerHTML = m.role === 'user' ? m.text : window.formatAIText(m.text);
        hist.appendChild(div);

        // Render Math after appending
        if (m.role === 'assistant' && typeof renderMathInElement === 'function') {
            try {
                renderMathInElement(div, { 
                    delimiters: [
                        {left: "$$", right: "$$", display: true}, 
                        {left: "$", right: "$", display: false},
                        {left: "\\[", right: "\\]", display: true},
                        {left: "\\(", right: "\\)", display: false}
                    ] 
                });
            } catch(e) {}
        }
    });
    hist.scrollTop = hist.scrollHeight;
    lucide.createIcons();
};

window.toggleChat = () => {
    const panel = document.getElementById('aiPanel');
    if (panel) panel.classList.toggle('hidden-element');
};

// ==========================================
// ADMIN SECTION (✅ UNCHANGED)
// ==========================================
window.handleVideoPublish = async () => { 
    if(!isAdmin || !db || !auth.currentUser) return; 
    const btn = document.querySelector('button[onclick="handleVideoPublish()"]'), title = document.getElementById('vTitle').value;
    let finalUrl = document.getElementById('vUrl').value;
    if(!title) return alert("Title required!");
    try {
        btn.disabled = true; btn.innerText = "🚀 Deploying...";
        if (pendingVideoFile) {
            const uploadTask = uploadBytesResumable(ref(storage, `videos/${appId}/${Date.now()}_${pendingVideoFile.name}`), pendingVideoFile);
            await new Promise((res, rej) => uploadTask.on('state_changed', null, rej, () => getDownloadURL(uploadTask.snapshot.ref).then(url => { finalUrl = url; res(); })));
        }
        await addDoc(collection(db, 'videos'), { appId: appId, title: title, url: finalUrl, description: document.getElementById('vDesc').value, timestamp: serverTimestamp() }); 
        document.getElementById('vTitle').value = ''; document.getElementById('vUrl').value = ''; document.getElementById('vDesc').value = ''; pendingVideoFile = null;
        btn.innerText = "✅ Deploy Content"; btn.disabled = false; window.msg("✅ Video Published");
    } catch(e) { alert("Upload Failed."); btn.innerText = "Deploy Content"; btn.disabled = false; }
};

window.handleBlogPublish = async () => { 
    if(!isAdmin || !db || !auth.currentUser) return; 
    try {
        await addDoc(collection(db, 'blogs'), { appId: appId, title: document.getElementById('bTitle').value, content: document.getElementById('bContent').value, timestamp: serverTimestamp() }); 
        window.msg("✅ Strategy Published"); document.getElementById('bTitle').value = ''; document.getElementById('bContent').value = '';
    } catch(e) { alert("Failed to publish."); }
};

window.delDoc = async (c, i) => { 
    if(!isAdmin || !confirm("Delete this node?")) return;
    try { await deleteDoc(doc(db, c, i)); window.msg("✅ Deleted."); } catch(e) { console.error(e); }
};

window.handleVideoUpload = (file) => {
    if(file && file.type.startsWith('video/')) {
        pendingVideoFile = file;
        document.getElementById('vTitle').value = file.name.split('.')[0];
        document.getElementById('dropZone').innerHTML = `<p class="text-xl font-bold text-emerald-500">✅ ${file.name} Ready</p>`;
    }
};

function dndInit() { 
    const dz = document.getElementById('dropZone'); if(!dz) return; 
    ['dragenter','dragover','dragleave','drop'].forEach(e => dz.addEventListener(e, (x)=> {x.preventDefault(); x.stopPropagation();})); 
    dz.addEventListener('drop', (x)=> { const f = x.dataTransfer.files[0]; handleVideoUpload(f); }); 
}

// ==========================================
// 🤖 AI AUTO-SEEDER (84 JEE TOPICS)
// ==========================================
window.autoPopulateNotes = async () => {
    if(!isAdmin || !db || !auth.currentUser) return alert("Admin access required!");
    
    const confirmSeed = confirm("⚠️ WARNING: This will use Guru AI to automatically generate and publish 84 detailed JEE notes in the background. It will consume API tokens and take about 10-15 minutes. Start process?");
    if(!confirmSeed) return;

    // The Master List of 84 JEE Advanced Topics
    const topics = [
        "Units, Dimensions and Errors", "Kinematics (1D and 2D)", "Laws of Motion & Friction", "Work, Energy and Power", "Center of Mass & Collisions", "Rotational Dynamics", "Gravitation", "Mechanical Properties of Solids", "Fluid Mechanics", "Thermal Properties of Matter", "Thermodynamics", "Kinetic Theory of Gases", "Simple Harmonic Motion (SHM)", "Waves and Sound", "Electrostatics", "Capacitance", "Current Electricity", "Moving Charges and Magnetism", "Magnetism and Matter", "Electromagnetic Induction (EMI)", "Alternating Current (AC)", "Electromagnetic Waves", "Ray Optics and Optical Instruments", "Wave Optics", "Dual Nature of Radiation and Matter", "Atoms and Nuclei", "Semiconductor Electronics",
        "Some Basic Concepts of Chemistry (Mole Concept)", "Structure of Atom", "Classification of Elements and Periodicity", "Chemical Bonding and Molecular Structure", "States of Matter (Gases and Liquids)", "Chemical Thermodynamics", "Chemical Equilibrium", "Ionic Equilibrium", "Redox Reactions", "Solid State", "Solutions", "Electrochemistry", "Chemical Kinetics", "Surface Chemistry", "General Principles of Isolation of Metals (Metallurgy)", "Hydrogen", "s-Block Elements", "p-Block Elements", "d and f-Block Elements", "Coordination Compounds", "Environmental Chemistry", "Purification and Characterisation of Organic Compounds", "General Organic Chemistry (GOC)", "Hydrocarbons", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Carboxylic Acids", "Amines", "Biomolecules", "Polymers", "Chemistry in Everyday Life",
        "Sets, Relations and Functions", "Complex Numbers", "Quadratic Equations", "Matrices and Determinants", "Permutations and Combinations", "Mathematical Induction", "Binomial Theorem", "Sequences and Series", "Limit, Continuity and Differentiability", "Differential Calculus", "Integral Calculus", "Differential Equations", "Coordinate Geometry", "Straight Lines", "Conic Sections (Parabola, Ellipse, Hyperbola)", "Circles", "Three Dimensional Geometry", "Vector Algebra", "Statistics", "Probability", "Trigonometry Ratios and Equations", "Properties of Triangles", "Mathematical Reasoning", "Applications of Derivatives", "Definite and Indefinite Integrals", "Area under Curves"
    ];

    window.msg("🚀 Initiating Auto-Seeder...");
    const btn = document.querySelector('button[onclick="autoPopulateNotes()"]');
    btn.disabled = true;
    
    for(let i=0; i<topics.length; i++) {
        const topic = topics[i];
        console.log(`[${i+1}/${topics.length}] Generating notes for: ${topic}`);
        btn.innerHTML = `<i data-lucide="loader" class="animate-spin inline mb-1 mr-2"></i> Generating ${i+1}/84...`;
        lucide.createIcons();
        
        try {
            // Send direct background request to Guru API
            const r = await fetch(`${BACKEND_URL}/api/guru`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tool: 'chat',
                    messages: [
                        { role: 'system', content: 'You are an expert IIT JEE Mentor creating a digital textbook. Output ONLY the study notes in markdown format. Do not use conversational text like "Here are the notes".' },
                        { role: 'user', content: `Write extremely detailed, highly structured short notes for JEE Mains & Advanced on the topic: "${topic}". Include crucial core concepts, important formulas wrapped properly in LaTeX ($...$), and any short tricks/shortcuts. Make it highly relevant for quick revision.` }
                    ]
                })
            });
            
            const d = await r.json();
            const content = d.choices?.[0]?.message?.content;
            
            if(content && !d.error) {
                // Save directly to Firebase Database
                await addDoc(collection(db, 'blogs'), { 
                    appId: appId, 
                    title: `${topic}`, 
                    content: content, 
                    timestamp: serverTimestamp() 
                });
                console.log(`✅ Published: ${topic}`);
            } else {
                console.error(`❌ API Error for ${topic}:`, d.error);
            }
            
            // Wait 5 seconds between requests so OpenRouter doesn't block you for Rate Limiting
            await new Promise(res => setTimeout(res, 5000));
            
        } catch(e) {
            console.error(`❌ Failed for ${topic}:`, e);
        }
    }
    
    btn.innerHTML = `<i data-lucide="check-circle" class="inline mb-1 mr-2"></i> System Seeded!`;
    lucide.createIcons();
    window.msg("🎉 All 84 JEE Topics Populated in Blogs!");
};

// ==========================================
// SCHEDULED MEETINGS WITH UID (✅ NEW)
// ==========================================
window.closeScheduleModal = () => {
    document.getElementById('scheduleModal').classList.add('hidden');
};

window.copyShareLink = async (uid, title) => {
    const shareLink = `${window.location.origin}?join=${uid}`;
    try {
        await navigator.clipboard.writeText(shareLink);
        window.msg(`📋 Share Link Copied: ${title}`);
    } catch (e) {
        console.error("Copy error:", e);
        alert(`Share Link: ${shareLink}`);
    }
};

window.showShareModal = (uid, title) => {
    document.getElementById('shareUID').innerText = uid;
    const shareLink = `${window.location.origin}?join=${uid}`;
    document.getElementById('shareLink').innerText = shareLink;
    window.currentShareUID = uid;
    window.currentShareTitle = title;
    document.getElementById('shareModal').classList.remove('hidden');
};

window.shareViaWhatsApp = () => {
    const uid = document.getElementById('shareUID').innerText;
    const title = window.currentShareTitle;
    const link = `${window.location.origin}?join=${uid}`;
    const text = `🎥 Join my Tantra Meet: "${title}"\n\n🔑 Meeting UID: ${uid}\n🔗 Link: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

window.shareViaEmail = () => {
    const uid = document.getElementById('shareUID').innerText;
    const title = window.currentShareTitle;
    const link = `${window.location.origin}?join=${uid}`;
    const subject = `Join: ${title}`;
    const body = `Meeting UID: ${uid}\nJoin Link: ${link}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
};

window.shareViaCopy = () => {
    const link = document.getElementById('shareLink').innerText;
    navigator.clipboard.writeText(link);
    window.msg("📋 Link Copied!");
};

window.scheduleMeeting = async () => {
    if (!session) {
        alert("Please login first.");
        return;
    }

    const title = document.getElementById('meetTitle').value.trim();
    const dateTime = document.getElementById('meetDateTime').value;
    const description = document.getElementById('meetDesc').value.trim();

    if (!title || !dateTime) {
        alert("Please fill all required fields.");
        return;
    }

    const btn = document.querySelector('button[onclick="scheduleMeeting()"]');
    btn.disabled = true;
    btn.innerText = "⏳ Scheduling...";

    try {
        window.msg("📅 Creating meeting...");
        
        const response = await fetch(`${BACKEND_URL}/api/meetings/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                scheduledAt: new Date(dateTime),
                createdBy: session.id
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error?.message || "Failed to create meeting");
        }

        const { uid, shareLink } = data;

        alert(`✅ Meeting Scheduled!\n\n🔑 Meeting UID: ${uid}\n\n📎 Share Link: ${shareLink}`);
        
        window.msg(`✅ Meeting Created! UID: ${uid}`);

        document.getElementById('meetTitle').value = '';
        document.getElementById('meetDateTime').value = '';
        document.getElementById('meetDesc').value = '';

        syncScheduledMeets();
        
        document.getElementById('scheduleModal').classList.add('hidden');

    } catch (error) {
        console.error("Scheduling Error:", error);
        window.msg("❌ Failed to schedule meeting");
        alert("Error: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "📅 Schedule";
    }
};

window.syncScheduledMeets = async () => {
    if (!session) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/meetings/list?userId=${session.id}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error("Failed to fetch meetings");

        const data = await response.json();
        const container = document.getElementById('scheduledMeetList');
        
        if (!container) return;

        container.innerHTML = '';

        if (!data.meetings || data.meetings.length === 0) {
            container.innerHTML = '<p class="text-center text-slate-500 py-4">📭 No scheduled meetings</p>';
            return;
        }

        data.meetings.forEach(meet => {
            const date = new Date(meet.scheduledAt).toLocaleString();
            const isHost = meet.createdBy === session.id;
            
            const el = document.createElement('div');
            el.className = "p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 border border-indigo-200 dark:border-slate-700 shadow-md";
            
            el.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                        <h4 class="font-bold text-indigo-600 text-lg">${meet.title}</h4>
                        <p class="text-xs text-slate-500 mb-1">🕒 ${date}</p>
                        ${meet.description ? `<p class="text-sm text-slate-600 dark:text-slate-300">${meet.description}</p>` : ''}
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-bold ${
                        meet.status === 'active' ? 'bg-green-100 text-green-700' :
                        meet.status === 'ended' ? 'bg-gray-100 text-gray-700' :
                        'bg-blue-100 text-blue-700'
                    }">● ${meet.status.toUpperCase()}</span>
                </div>
                
                <div class="bg-white dark:bg-slate-800 p-3 rounded-lg mb-3 border border-slate-200 dark:border-slate-700">
                    <p class="text-xs text-slate-600 dark:text-slate-400 mb-1">🔑 UID:</p>
                    <p class="font-mono font-bold text-indigo-600 text-sm">${meet.uid}</p>
                    <p class="text-xs text-slate-500 mt-1">👥 ${meet.participants.length} participant(s)</p>
                </div>
                
                <div class="flex gap-2 flex-wrap">
                    <button onclick="joinMeetingByUID(${meet.uid})" class="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all">
                        📞 Join
                    </button>
                    <button onclick="showShareModal(${meet.uid}, '${meet.title}')" class="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-all">
                        📎 Share
                    </button>
                    ${isHost && meet.status === 'scheduled' ? `<button onclick="startMeeting(${meet.uid})" class="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-all">
                        ▶️ Start
                    </button>` : ''}
                </div>
            `;
            
            container.appendChild(el);
        });

    } catch (error) {
        console.error("Sync Error:", error);
        window.msg("❌ Failed to load meetings");
    }
};

window.joinMeetingByUID = async (uid) => {
    try {
        window.msg("📞 Fetching meeting details...");
        
        const response = await fetch(`${BACKEND_URL}/api/meetings/join?uid=${uid}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error("Meeting not found");
        }

        const data = await response.json();
        const meeting = data.meeting;

        window.currentMeetingUID = uid;
        document.getElementById('currentRoomCode').innerText = `UID: ${uid}`;
        
        const joinResponse = await fetch(`${BACKEND_URL}/api/meetings/join-participant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: uid,
                userId: session.id,
                userName: session.id
            })
        });

        if (joinResponse.ok) {
            window.msg(`✅ Joined: ${meeting.title}`);
            document.getElementById('activeRoomDisplay').classList.remove('hidden');
            await createRoom();
        }
    } catch (error) {
        console.error("Join Error:", error);
        window.msg("❌ Failed to join meeting");
        alert("Error: " + error.message);
    }
};

window.startMeeting = async (uid) => {
    try {
        window.msg("🚀 Starting meeting...");
        
        const response = await fetch(`${BACKEND_URL}/api/meetings/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: uid,
                userId: session.id
            })
        });

        if (!response.ok) {
            throw new Error("Failed to start meeting");
        }

        window.msg("✅ Meeting Started!");
        window.currentMeetingUID = uid;
        syncScheduledMeets();
        
    } catch (error) {
        console.error("Start Error:", error);
        alert("Error: " + error.message);
    }
};

window.endMeeting = async (uid) => {
    try {
        window.msg("⏹️ Ending meeting...");
        
        const response = await fetch(`${BACKEND_URL}/api/meetings/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: uid })
        });

        if (!response.ok) {
            throw new Error("Failed to end meeting");
        }

        window.msg("✅ Meeting Ended!");
        window.currentMeetingUID = null;
        syncScheduledMeets();
        
    } catch (error) {
        console.error("End Error:", error);
        alert("Error: " + error.message);
    }
};

window.checkAutoJoin = () => {
    const params = new URLSearchParams(window.location.search);
    const joinUID = params.get('join');
    
    if (joinUID) {
        console.log("Auto-join detected for UID:", joinUID);
        if (session) {
            setTimeout(() => {
                joinMeetingByUID(joinUID);
            }, 1500);
        } else {
            window.msg("⏳ Please login first to join the meeting");
        }
    }
};

// ==========================================
// WEBRTC MEETING SYSTEM (✅ UPDATED)
// ==========================================
async function openUserMedia() {
    try {
        const quality = document.getElementById('videoQuality').value;
        let constraints = { audio: { echoCancellation: true, noiseSuppression: true } };
        
        if (quality === '480') {
            constraints.video = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 15 } };
            window.msg("📊 Data Saver Mode: Active");
        } else {
            constraints.video = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };
            window.msg("🎬 HD Quality: Active");
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('localVideo').srcObject = stream; 
        localStream = stream;
        remoteStream = new MediaStream(); 
        document.getElementById('remoteVideo').srcObject = remoteStream;
    } catch (e) { 
        alert("❌ Camera/Mic access denied."); 
        throw e; 
    }
}

window.createRoom = async () => {
    const btn = document.getElementById('btnCreateRoom'); 
    btn.disabled = true; 
    btn.innerText = "⏳ Initializing...";
    
    try { 
        await openUserMedia(); 
    } catch (e) { 
        btn.disabled = false; 
        btn.innerHTML = `<i data-lucide="video"></i> Initialize Node`; 
        return; 
    }

    try {
        roomId = 'TANTRA_' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const roomRef = doc(db, 'calls', roomId);
        peerConnection = new RTCPeerConnection(configuration); 
        registerPeerConnectionListeners();
        
        localStream.getTracks().forEach(track => { 
            peerConnection.addTrack(track, localStream); 
        });

        peerConnection.addEventListener('icecandidate', e => { 
            if (e.candidate) {
                addDoc(collection(roomRef, 'callerCandidates'), e.candidate.toJSON()); 
            }
        });

        const offer = await peerConnection.createOffer(); 
        await peerConnection.setLocalDescription(offer);
        await setDoc(roomRef, { 
            offer: { type: offer.type, sdp: offer.sdp }, 
            createdAt: serverTimestamp(),
            uid: window.currentMeetingUID || 'local',
            creator: session.id
        });
        
        document.getElementById('currentRoomCode').innerText = roomId; 
        document.getElementById('activeRoomDisplay').classList.remove('hidden'); 
        document.getElementById('btnHangup').classList.remove('hidden');
        document.getElementById('meetControls').classList.remove('hidden');
        document.getElementById('meetControls').classList.add('flex');
        window.msg(`✅ Room Created: ${roomId}`);

        onSnapshot(roomRef, async snapshot => { 
            const data = snapshot.data(); 
            if (!peerConnection.currentRemoteDescription && data?.answer) { 
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer)); 
                document.getElementById('waitingText').classList.add('hidden'); 
            } 
        });

        onSnapshot(collection(roomRef, 'calleeCandidates'), snapshot => { 
            snapshot.docChanges().forEach(async change => { 
                if (change.type === 'added') {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data())); 
                }
            }); 
        });

        btn.innerText = '✅ Room Ready';

    } catch (e) {
        console.error("Room creation error:", e);
        window.msg("❌ Failed to create room");
    }
};

window.joinRoom = async () => {
    roomId = document.getElementById('roomCodeInput').value.trim().toUpperCase(); 
    if (!roomId) return alert("Enter Node Code.");
    
    const btn = document.getElementById('btnJoinRoom'); 
    btn.innerText = "⏳ Connecting..."; 
    btn.disabled = true;
    
    try {
        const roomRef = doc(db, 'calls', roomId), 
              roomSnapshot = await getDoc(roomRef);
        
        if (!roomSnapshot.exists()) { 
            btn.innerText = "Join"; 
            btn.disabled = false; 
            return alert("❌ Invalid Code."); 
        }

        await openUserMedia();
        
        peerConnection = new RTCPeerConnection(configuration); 
        registerPeerConnectionListeners();

        localStream.getTracks().forEach(track => { 
            peerConnection.addTrack(track, localStream); 
        });

        peerConnection.addEventListener('icecandidate', e => { 
            if (e.candidate) {
                addDoc(collection(roomRef, 'calleeCandidates'), e.candidate.toJSON()); 
            }
        });

        await peerConnection.setRemoteDescription(new RTCSessionDescription(roomSnapshot.data().offer));
        const answer = await peerConnection.createAnswer(); 
        await peerConnection.setLocalDescription(answer);
        await updateDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } });
        
        document.getElementById('activeRoomDisplay').classList.remove('hidden'); 
        document.getElementById('currentRoomCode').innerText = roomId; 
        document.getElementById('btnHangup').classList.remove('hidden');
        document.getElementById('meetControls').classList.remove('hidden');
        document.getElementById('meetControls').classList.add('flex');
        document.getElementById('waitingText').classList.add('hidden');
        window.msg("✅ Connected!");

        onSnapshot(collection(roomRef, 'callerCandidates'), snapshot => { 
            snapshot.docChanges().forEach(async change => { 
                if (change.type === 'added') {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data())); 
                }
            }); 
        });

        btn.innerText = '✅ Connected';
    } catch(e) { 
        console.error("Join error:", e);
        btn.innerText = "Join"; 
        btn.disabled = false; 
        window.msg("❌ Failed to join");
    }
};

window.hangUp = async () => {
    document.getElementById('localVideo').srcObject?.getTracks().forEach(t => t.stop());
    if (remoteStream) remoteStream.getTracks().forEach(t => t.stop());
    if (peerConnection) peerConnection.close();
    
    document.getElementById('localVideo').srcObject = null; 
    document.getElementById('remoteVideo').srcObject = null;
    document.getElementById('activeRoomDisplay').classList.add('hidden'); 
    document.getElementById('btnHangup').classList.add('hidden'); 
    document.getElementById('waitingText').classList.remove('hidden');
    document.getElementById('meetControls').classList.add('hidden');
    document.getElementById('btnCreateRoom').disabled = false; 
    document.getElementById('btnCreateRoom').innerHTML = '<i data-lucide="video"></i> Initialize Node';
    document.getElementById('btnJoinRoom').innerText = 'Join'; 
    document.getElementById('btnJoinRoom').disabled = false; 
    document.getElementById('roomCodeInput').value = '';
    
    if (window.currentMeetingUID) {
        try {
            await endMeeting(window.currentMeetingUID);
        } catch (e) {
            console.log("Meeting end notification sent");
        }
    }
    
    lucide.createIcons(); 
    window.msg("⏹️ Connection Terminated");
};

function registerPeerConnectionListeners() {
    peerConnection.addEventListener('track', e => { 
        e.streams[0].getTracks().forEach(track => { 
            remoteStream.addTrack(track); 
        }); 
    });

    peerConnection.addEventListener('connectionstatechange', () => { 
        if (peerConnection.connectionState === 'disconnected' || 
            peerConnection.connectionState === 'failed') {
            window.hangUp(); 
        }
    });
}

// ==========================================
// MEETING CONTROLS (✅ NEW)
// ==========================================
window.toggleMic = () => {
    if (!localStream) return;
    isAudioMuted = !isAudioMuted; 
    localStream.getAudioTracks()[0].enabled = !isAudioMuted;
    
    const btn = document.getElementById('btnToggleMic'), 
          icon = document.getElementById('iconMic');
    
    if (isAudioMuted) { 
        btn.classList.replace('bg-slate-800', 'bg-red-500/20'); 
        btn.classList.replace('border-slate-600', 'border-red-500'); 
        btn.classList.add('text-red-500'); 
        icon.setAttribute('data-lucide', 'mic-off'); 
    } else { 
        btn.classList.replace('bg-red-500/20', 'bg-slate-800'); 
        btn.classList.replace('border-red-500', 'border-slate-600'); 
        btn.classList.remove('text-red-500'); 
        icon.setAttribute('data-lucide', 'mic'); 
    }
    
    lucide.createIcons();
    window.msg(isAudioMuted ? "🔇 Mic Off" : "🎙️ Mic On");
};

window.toggleCam = () => {
    if (!localStream) return;
    isVideoMuted = !isVideoMuted; 
    localStream.getVideoTracks()[0].enabled = !isVideoMuted;
    
    const btn = document.getElementById('btnToggleCam'), 
          icon = document.getElementById('iconCam');
    
    if (isVideoMuted) { 
        btn.classList.replace('bg-slate-800', 'bg-red-500/20'); 
        btn.classList.replace('border-slate-600', 'border-red-500'); 
        btn.classList.add('text-red-500'); 
        icon.setAttribute('data-lucide', 'video-off'); 
    } else { 
        btn.classList.replace('bg-red-500/20', 'bg-slate-800'); 
        btn.classList.replace('border-red-500', 'border-slate-600'); 
        btn.classList.remove('text-red-500'); 
        icon.setAttribute('data-lucide', 'video'); 
    }
    
    lucide.createIcons();
    window.msg(isVideoMuted ? "📹 Camera Off" : "📷 Camera On");
};

window.toggleScreenShare = async () => {
    try {
        if (!isScreenSharing) {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            peerConnection.getSenders().find(s => s.track.kind === 'video').replaceTrack(screenTrack);
            document.getElementById('localVideo').srcObject = screenStream; 
            document.getElementById('localVideo').classList.remove('scale-x-[-1]');
            isScreenSharing = true;
            document.getElementById('btnScreenShare').classList.replace('bg-indigo-600', 'bg-emerald-500'); 
            document.getElementById('iconScreen').setAttribute('data-lucide', 'stop-circle');
            screenTrack.onended = () => stopScreenShare();
            window.msg("📺 Screen Sharing ON");
        } else { 
            stopScreenShare(); 
        }
        lucide.createIcons();
    } catch (e) { 
        console.error(e); 
        window.msg("❌ Share Denied."); 
    }
};

function stopScreenShare() {
    if(!isScreenSharing) return;
    peerConnection.getSenders().find(s => s.track.kind === 'video').replaceTrack(localStream.getVideoTracks()[0]);
    document.getElementById('localVideo').srcObject = localStream; 
    document.getElementById('localVideo').classList.add('scale-x-[-1]');
    screenStream.getTracks().forEach(t => t.stop()); 
    isScreenSharing = false;
    document.getElementById('btnScreenShare').classList.replace('bg-emerald-500', 'bg-indigo-600'); 
    document.getElementById('iconScreen').setAttribute('data-lucide', 'monitor-up');
    lucide.createIcons();
    window.msg("📺 Screen Sharing OFF");
}

window.togglePiP = async () => {
    const video = document.getElementById('remoteVideo');
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
        window.msg("❌ PiP Disabled");
    }
    else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        window.msg("✅ PiP Enabled");
    }
};

window.kickPeer = async () => {
    if(!isAdmin) return alert("Only Admin can block users.");
    if(!confirm("Block and disconnect this user?")) return;
    try {
        await updateDoc(doc(db, 'calls', roomId), { isBlocked: true });
        window.hangUp(); 
        window.msg("✅ User Blocked Successfully");
    } catch(e) { console.error(e); }
};

// ==========================================
// UTILITY FUNCTIONS (✅ UNCHANGED)
// ==========================================
window.openAccountDash = () => {
    document.getElementById('accountModal').classList.remove('hidden-element');
    document.getElementById('dashName').innerText = session.id; 
    document.getElementById('dashRole').innerText = isAdmin ? '👑 Admin Root' : '👤 Student Access';
    
    if(session && db) {
        onSnapshot(query(collection(db, 'progress'), where('appId', '==', appId), where('userId', '==', session.id)), (s) => {
            let html = ''; 
            s.docs.forEach(d => { 
                const data = d.data(); 
                html += `<div class="mb-4"><div class="flex justify-between text-xs font-bold mb-1"><span class="truncate pr-4">${data.title}</span><span class="text-indigo-600">${data.progress}%</span></div><div class="w-full h-2 bg-slate-100 rounded-full"><div class="h-full bg-indigo-500 rounded-full" style="width: ${data.progress}%"></div></div></div>`; 
            });
            document.getElementById('progressTrackerBox').innerHTML = html || '<p class="text-xs italic">📭 No lectures started.</p>';
        });
    }
};

window.switchTab = (tabId) => {
    ['video', 'blog', 'podcast', 'notebook', 'meet'].forEach(id => {
        const s = document.getElementById(`view-${id}`), 
              bD = document.getElementById(`tab-btn-${id}`), 
              bM = document.getElementById(`mob-btn-${id}`);
        
        if(s) { 
            s.classList.toggle('hidden-element', id !== tabId); 
            s.classList.toggle('animate-in', id === tabId); 
        }
        
        if(bD) bD.className = id === tabId ? "px-6 py-2.5 rounded-xl text-xs font-bold transition-all bg-white dark:bg-slate-700 text-indigo-600 shadow-sm uppercase" : "px-6 py-2.5 rounded-xl text-xs font-bold transition-all text-slate-500 hover:text-indigo-600 uppercase";
        
        if(bM) bM.className = id === tabId ? "flex-1 text-center py-3 text-[10px] font-black uppercase tracking-widest rounded-xl bg-indigo-50 text-indigo-600" : "flex-1 text-center py-3 text-[10px] font-black uppercase tracking-widest rounded-xl text-slate-500";
    });

    // Sync meetings when opening meet tab
    if (tabId === 'meet' && session) {
        setTimeout(() => syncScheduledMeets(), 500);
    }
};

window.toggleTheme = () => { 
    const d = document.documentElement.classList.toggle('dark'); 
    document.getElementById('icon-sun').classList.toggle('hidden', !d); 
    document.getElementById('icon-moon').classList.toggle('hidden', d); 
};

window.copyToClipboard = (t) => { 
    navigator.clipboard.writeText(t); 
    window.msg("📋 Copied!"); 
};

async function genGfx() { 
    const bg = document.getElementById('heroImageContainer'); 
    if(bg) bg.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-black flex items-center justify-center opacity-80"><i data-lucide="network" class="text-indigo-500/20 animate-pulse" size="200"></i></div>`; 
    lucide.createIcons(); 
}

// ==========================================
// ANTI-INSPECT SHIELD
// ==========================================
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    window.msg("🚫 Access Denied: Restricted Zone");
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'F12') {
        e.preventDefault();
        return false;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
        e.preventDefault();
        return false;
    }
    if (e.ctrlKey && e.key === 'U') {
        e.preventDefault();
        return false;
    }
});

setTimeout(() => {
    console.clear();
    console.log("%c⚠️ WARNING", "color: red; font-size: 20px; font-weight: bold;");
    console.log("%cYou are in the JEE TANTRA Core Engine. Unauthorized access is forbidden.", "color: #6366f1; font-size: 14px;");
}, 2000);

// ==========================================
// AI TOOL SELECTION LOGIC (NEW)
// ==========================================
window.currentAITool = 'chat'; // Default

window.setAITool = (toolName, btnElement) => {
    window.currentAITool = toolName;
    
    // UI Update: Reset all buttons
    document.querySelectorAll('.ai-tool-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
        btn.classList.add('bg-slate-200', 'dark:bg-slate-700', 'text-slate-500');
    });
    
    // UI Update: Active button
    btnElement.classList.remove('bg-slate-200', 'dark:bg-slate-700', 'text-slate-500');
    btnElement.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
    
  // Input Placeholder Update
const aiInput = document.getElementById('aiInput');
if(toolName === 'search') aiInput.placeholder = "Search the live web for...";
else if(toolName === 'quiz') aiInput.placeholder = "Topic for multiple choice quiz...";
else aiInput.placeholder = "Message Guru AI or Scan Photo...";
};

// Auto-check for join parameter on page load
window.addEventListener('load', () => {
    if (session) {
        checkAutoJoin();
    }
});
// ==========================================
// OCR IMAGE SCANNER SYSTEM
// ==========================================
window.triggerScanner = () => {
    document.getElementById('imageScanner').click();
};

window.handleImageScan = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const aiInput = document.getElementById('aiInput');
    const originalPlaceholder = aiInput.placeholder;
    
    window.msg("📸 Extracting text from image... Please wait.");
    aiInput.placeholder = "Scanning physics/math text... ⏳";
    aiInput.disabled = true;

    try {
        const result = await Tesseract.recognize(file, 'eng', {
            logger: m => console.log(m) 
        });
        
        const extractedText = result.data.text.trim();

        if (extractedText) {
            aiInput.value = extractedText;
            window.msg("✅ Scan Complete! Review text before sending.");
        } else {
            window.msg("⚠️ Could not read text. Try a clearer photo.");
        }
    } catch (error) {
        console.error("OCR Error:", error);
        window.msg("❌ Scanning Failed. Check console.");
    } finally {
        aiInput.placeholder = originalPlaceholder;
        aiInput.disabled = false;
        event.target.value = ""; 
        lucide.createIcons();
    }
};

// ==========================================
// CUSTOM TEXT & MEDIA PARSER (NEW)
// ==========================================
window.formatAIText = (text) => {
    if(!text) return "";
    
    // Step A: Protect Math formulas from Marked.js breaking them
    let safeText = text.replace(/\\/g, '\\\\'); // Double escape slashes so marked ignores them
    
    // Step B: Parse Markdown
    let html = marked.parse(safeText);
    
    // Step C: Fix single slashes for KaTeX to read properly later
    html = html.replace(/\\\\/g, '\\');

    // Step D: Auto-convert Video Links to actual Video Players
    html = html.replace(
        /<a href="(https?:\/\/[^\s"']+\.mp4)".*?>.*?<\/a>/gi, 
        '<video src="$1" controls autoplay loop muted class="w-full rounded-2xl shadow-md mt-3 border border-slate-200 dark:border-slate-700"></video>'
    );
    
    // Step E: Auto-convert Image Links to actual Images
    html = html.replace(
        /<img src="(.*?)" alt="(.*?)">/gi,
        '<img src="$1" alt="$2" class="w-full rounded-2xl shadow-md mt-3 border border-slate-200 dark:border-slate-700 object-cover">'
    );
// Step F: Auto-convert Mermaid code blocks to renderable divs
html = html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi, 
    '<div class="mermaid flex justify-center my-6 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-inner border border-slate-200 dark:border-slate-700 w-full overflow-x-auto">$1</div>'
);

return html;

};