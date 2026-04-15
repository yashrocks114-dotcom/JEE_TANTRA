const http = require('http');
const url = require('url');
const { v4: uuidv4 } = require('uuid');

const PORT = 3000;

// Secure API Keys (Recommend moving these to a .env file for production)
const OPENROUTER_API_KEY = "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";
const MURF_API_KEY = "ap2_e217f200-bb8f-469e-9fb6-ba72260cc38c";

// In-memory database (Use MongoDB, Firebase, or PostgreSQL in production)
let scheduledMeetings = [];
let activeMeetings = {};
let meetingParticipants = {};

// Helper: Generate 11-digit UID for meetings
function generate11DigitUID() {
    return Math.floor(Math.random() * 90000000000) + 10000000000;
}

// Helper: Generate shareable link
function generateShareableLink(meetingUID, baseURL = "http://localhost:3000") {
    return `${baseURL}?join=${meetingUID}`;
}

const server = http.createServer(async (req, res) => {
    // CORS Headers for Frontend Communication
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);


  // ===================================
    // ROUTE 1: GURU AI (Optimized for Text/Code/Flowchart)
    // ===================================
    if (req.method === 'POST' && pathname === '/api/guru') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { messages, tool } = JSON.parse(body);
                if (!messages) return res.end(JSON.stringify({ error: { message: "Invalid request" } }));

                console.log(`📨 Guru AI Request... Tool: ${tool || 'chat'}`);

                let aiModel = "openrouter/elephant-alpha"; 
                if (tool === 'search') aiModel = "perplexity/llama-3.1-sonar-large-128k-online"; 

                let systemInstruction = "You are Guru AI v3.0, the dedicated portal mentor for Yash Mishra. Use LaTeX ($...$) for Physics and Math formulas.";
                
                if (tool === 'quiz') {
                    systemInstruction = "You are an expert quiz maker. Generate a 3-question Multiple Choice Quiz on the user's topic. Format clearly with Options A, B, C, D and provide the correct answers at the end.";
                } else if (tool === 'flowchart') {
                    systemInstruction = "You are a concept visualizer. You MUST use Mermaid.js syntax (wrap it EXACTLY in ```mermaid and ```) to create flowchart diagrams for the user's topic. Keep the graph labels short. Only output the mermaid code block, nothing else.";
                } else if (tool === 'search') {
                    systemInstruction = "Search the live web to provide the most up-to-date, deeply researched, and real-time answer to the user's query. Provide citations where necessary.";
                }

                const formattedMessages = [
                    { role: "system", content: systemInstruction },
                    ...messages
                ];

                const requestPayload = { 
                    model: aiModel, 
                    max_tokens: 4000,
                    temperature: 0.7,
                    messages: formattedMessages
                };

                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'http://localhost:3000',
                        'X-Title': 'JEE TANTRA Portal'
                    },
                    body: JSON.stringify(requestPayload)
                });

                const data = await response.json();
                
                if (!response.ok) {
                    res.writeHead(response.status);
                    return res.end(JSON.stringify({ error: data.error }));
                }

                res.writeHead(200);
                res.end(JSON.stringify(data));
            } catch (e) {
                console.error("❌ Guru AI Error:", e.message);
                res.writeHead(500);
                res.end(JSON.stringify({ error: { message: e.message } }));
            }
        });
        return;
    }
    
    // ===================================
    // ROUTE 2: MURF AI TTS
    // ===================================
   
    if (req.method === 'POST' && pathname === '/api/tts') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { text, langVoice } = JSON.parse(body);
                if (!text) {
                    res.writeHead(400);
                    return res.end(JSON.stringify({ error: { message: "Text required" } }));
                }

                console.log("🎤 TTS Request received...");
                const response = await fetch("https://api.murf.ai/v1/speech/generate", {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'api-key': MURF_API_KEY 
                    },
                    body: JSON.stringify({ 
                        voiceId: langVoice || "en-IN-ehaan",
                        style: "Conversational", 
                        text: text.substring(0, 1000),
                        rate: 0, 
                        pitch: 0, 
                        sampleRate: 48000, 
                        format: "MP3", 
                        channelType: "MONO" 
                    })
                });
                
                const data = await response.json();
                if (!response.ok) {
                    res.writeHead(response.status);
                    return res.end(JSON.stringify({ error: data.error }));
                }

                res.writeHead(200);
                res.end(JSON.stringify(data));
            } catch (e) {
                console.error("❌ TTS Error:", e.message);
                res.writeHead(500);
                res.end(JSON.stringify({ error: { message: e.message } }));
            }
        });
        return;
    }

    // ===================================
    // ROUTE 3: CREATE SCHEDULED MEETING
    // ===================================
    if (req.method === 'POST' && pathname === '/api/meetings/create') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { title, description, scheduledAt, createdBy } = JSON.parse(body);
                
                const meetingUID = generate11DigitUID();
                const meeting = {
                    id: uuidv4(),
                    uid: meetingUID,
                    title,
                    description,
                    scheduledAt: new Date(scheduledAt),
                    createdBy,
                    createdAt: new Date(),
                    status: 'scheduled', // scheduled, active, ended
                    shareLink: generateShareableLink(meetingUID),
                    participants: [createdBy],
                    recordingURL: null
                };

                scheduledMeetings.push(meeting);
                console.log(`✅ Meeting Created - UID: ${meetingUID}`);

                res.writeHead(201);
                res.end(JSON.stringify({ 
                    success: true, 
                    meeting,
                    shareLink: meeting.shareLink,
                    uid: meetingUID 
                }));
            } catch (e) {
                console.error("❌ Create Meeting Error:", e.message);
                res.writeHead(500);
                res.end(JSON.stringify({ error: { message: e.message } }));
            }
        });
        return;
    }

    // ===================================
    // ROUTE 4: GET MEETING BY UID
    // ===================================
    if (req.method === 'GET' && pathname === '/api/meetings/join') {
        try {
            const meetingUID = query.uid;
            if (!meetingUID) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: { message: "UID required" } }));
            }

            const meeting = scheduledMeetings.find(m => m.uid == meetingUID);
            if (!meeting) {
                res.writeHead(404);
                return res.end(JSON.stringify({ error: { message: "Meeting not found" } }));
            }

            console.log(`✅ Meeting Retrieved - UID: ${meetingUID}`);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, meeting }));
        } catch (e) {
            console.error("❌ Get Meeting Error:", e.message);
            res.writeHead(500);
            res.end(JSON.stringify({ error: { message: e.message } }));
        }
        return;
    }

    // ===================================
    // ROUTE 5: START MEETING
    // ===================================
    if (req.method === 'POST' && pathname === '/api/meetings/start') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { uid, userId } = JSON.parse(body);
                
                const meeting = scheduledMeetings.find(m => m.uid == uid);
                if (!meeting) {
                    res.writeHead(404);
                    return res.end(JSON.stringify({ error: { message: "Meeting not found" } }));
                }

                meeting.status = 'active';
                meeting.startedAt = new Date();
                activeMeetings[uid] = meeting;
                meetingParticipants[uid] = [userId];

                console.log(`🚀 Meeting Started - UID: ${uid}`);
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, meeting }));
            } catch (e) {
                console.error("❌ Start Meeting Error:", e.message);
                res.writeHead(500);
                res.end(JSON.stringify({ error: { message: e.message } }));
            }
        });
        return;
    }

    // ===================================
    // ROUTE 6: JOIN MEETING AS PARTICIPANT
    // ===================================
    if (req.method === 'POST' && pathname === '/api/meetings/join-participant') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { uid, userId, userName } = JSON.parse(body);
                
                const meeting = scheduledMeetings.find(m => m.uid == uid);
                if (!meeting) {
                    res.writeHead(404);
                    return res.end(JSON.stringify({ error: { message: "Meeting not found" } }));
                }

                if (!meeting.participants.includes(userId)) {
                    meeting.participants.push(userId);
                }
                
                if (!meetingParticipants[uid]) {
                    meetingParticipants[uid] = [];
                }
                meetingParticipants[uid].push({ userId, userName, joinedAt: new Date() });

                console.log(`👤 Participant Joined - UID: ${uid}, User: ${userId}`);
                res.writeHead(200);
                res.end(JSON.stringify({ 
                    success: true, 
                    meeting,
                    participants: meetingParticipants[uid],
                    message: `${userName} joined the meeting` 
                }));
            } catch (e) {
                console.error("❌ Join Meeting Error:", e.message);
                res.writeHead(500);
                res.end(JSON.stringify({ error: { message: e.message } }));
            }
        });
        return;
    }

    // ===================================
    // ROUTE 7: END MEETING
    // ===================================
    if (req.method === 'POST' && pathname === '/api/meetings/end') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { uid } = JSON.parse(body);
                
                const meeting = scheduledMeetings.find(m => m.uid == uid);
                if (!meeting) {
                    res.writeHead(404);
                    return res.end(JSON.stringify({ error: { message: "Meeting not found" } }));
                }

                meeting.status = 'ended';
                meeting.endedAt = new Date();
                meeting.duration = Math.round((meeting.endedAt - meeting.startedAt) / 1000 / 60); // minutes

                delete activeMeetings[uid];
                delete meetingParticipants[uid];

                console.log(`⏹️ Meeting Ended - UID: ${uid}, Duration: ${meeting.duration} mins`);
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, meeting }));
            } catch (e) {
                console.error("❌ End Meeting Error:", e.message);
                res.writeHead(500);
                res.end(JSON.stringify({ error: { message: e.message } }));
            }
        });
        return;
    }

    // ===================================
    // ROUTE 8: GET ALL MEETINGS FOR USER
    // ===================================
    if (req.method === 'GET' && pathname === '/api/meetings/list') {
        try {
            const userId = query.userId;
            if (!userId) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: { message: "userId required" } }));
            }

            const userMeetings = scheduledMeetings.filter(m => 
                m.createdBy === userId || m.participants.includes(userId)
            );

            res.writeHead(200);
            res.end(JSON.stringify({ success: true, meetings: userMeetings }));
        } catch (e) {
            console.error("❌ List Meetings Error:", e.message);
            res.writeHead(500);
            res.end(JSON.stringify({ error: { message: e.message } }));
        }
        return;
    }

    // ===================================
    // ROUTE 9: GET MEETING STATS
    // ===================================
    if (req.method === 'GET' && pathname === '/api/meetings/stats') {
        try {
            const uid = query.uid;
            if (!uid) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: { message: "UID required" } }));
            }

            const meeting = scheduledMeetings.find(m => m.uid == uid);
            if (!meeting) {
                res.writeHead(404);
                return res.end(JSON.stringify({ error: { message: "Meeting not found" } }));
            }

            const stats = {
                uid: meeting.uid,
                title: meeting.title,
                status: meeting.status,
                totalParticipants: meeting.participants.length,
                participants: meeting.participants,
                duration: meeting.duration || null,
                createdAt: meeting.createdAt,
                startedAt: meeting.startedAt || null,
                endedAt: meeting.endedAt || null
            };

            res.writeHead(200);
            res.end(JSON.stringify({ success: true, stats }));
        } catch (e) {
            console.error("❌ Stats Error:", e.message);
            res.writeHead(500);
            res.end(JSON.stringify({ error: { message: e.message } }));
        }
        return;
    }

    // ===================================
    // HEALTH CHECK
    // ===================================
    if (req.method === 'GET' && pathname === '/health') {
        res.writeHead(200);
        return res.end(JSON.stringify({ 
            status: "✅ Server Running", 
            timestamp: new Date().toISOString(),
            activeMeetings: Object.keys(activeMeetings).length,
            totalScheduledMeetings: scheduledMeetings.length
        }));
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: { message: "Endpoint not found" } }));
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║   🚀 TANTRA ENGINE WITH MEETING SYSTEM RUNNING     ║
╠════════════════════════════════════════════════════╣
║  Main Server:        http://localhost:${PORT}        ║
║  Guru AI:            /api/guru                     ║
║  Text-to-Speech:     /api/tts                      ║
║  Create Meeting:     POST /api/meetings/create     ║
║  Join Meeting:       GET /api/meetings/join?uid=   ║
║  Start Meeting:      POST /api/meetings/start      ║
║  End Meeting:        POST /api/meetings/end        ║
║  List Meetings:      GET /api/meetings/list        ║
║  Meeting Stats:      GET /api/meetings/stats       ║
║  Health Check:       /health                       ║
╚════════════════════════════════════════════════════╝
    `);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} already in use!`);
        console.error(`Try finding the process: lsof -i :${PORT} | grep LISTEN | awk '{print $2}' | xargs kill -9`);
    } else {
        console.error("❌ Server Error:", err);
    }
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});