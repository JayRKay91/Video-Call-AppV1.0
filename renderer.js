const { io } = require('socket.io-client');

// 1. Connection Logic: Configured for Cloudflare Tunnel
// We use 'https' and remove the port number because Cloudflare routes 443 -> 3000 for us.
const socket = io('https://server.kapplervideoapp.com', {
    transports: ['websocket'], // Force WebSocket to avoid Cloudflare polling issues
    upgrade: false             // Disable polling upgrade for a faster, direct connection
});

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('startBtn');
const endCallBtn = document.getElementById('endCallBtn');
const toggleCamBtn = document.getElementById('toggleCam');
const toggleMicBtn = document.getElementById('toggleMic');
const roomInput = document.getElementById('roomInput');
const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const statusText = document.getElementById('statusText');

let localStream;
let peerConnection;

const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// --- WEBRTC CORE LOGIC ---

async function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        console.log("Remote stream received!");
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', { 
                type: 'candidate', 
                candidate: event.candidate,
                room: roomInput.value 
            });
        }
    };
}

// --- SIGNALING RECEIVER ---

socket.on('signal', async (data) => {
    // Only process signals for our specific room
    if (data.room !== roomInput.value) return;

    if (data.type === 'offer') {
        await createPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { type: 'answer', answer: answer, room: roomInput.value });
    } 
    else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } 
    else if (data.type === 'candidate') {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
            console.error("Error adding ice candidate", e);
        }
    }
});

// --- HARDWARE & UI LOGIC ---

async function getDevices() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameraSelect.innerHTML = '';
        micSelect.innerHTML = '';
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            if (device.kind === 'videoinput') {
                option.text = device.label || `Camera ${cameraSelect.length + 1}`;
                cameraSelect.appendChild(option);
            } else if (device.kind === 'audioinput') {
                option.text = device.label || `Mic ${micSelect.length + 1}`;
                micSelect.appendChild(option);
            }
        });
    } catch (err) { console.error(err); }
}

async function startCall() {
    if (!roomInput.value) return alert("Please enter a room name first!");

    const constraints = {
        video: { deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined },
        audio: { deviceId: micSelect.value ? { exact: micSelect.value } : undefined }
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = localStream;
        
        await createPeerConnection();
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { type: 'offer', offer: offer, room: roomInput.value });
        
        // UI Updates
        startBtn.style.display = "none";
        endCallBtn.style.display = "block";
    } catch (error) { console.error(error); }
}

// End the Call and clean up resources
function endCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    remoteVideo.srcObject = null;
    localVideo.srcObject = null;
    
    // UI Reset
    startBtn.style.display = "block";
    endCallBtn.style.display = "none";
    startBtn.disabled = false;
    
    // Reset toggle button states
    toggleCamBtn.classList.remove('off');
    toggleCamBtn.innerText = "📷";
    toggleMicBtn.classList.remove('off');
    toggleMicBtn.innerText = "🎤";
}

// Toggle Video Track
toggleCamBtn.addEventListener('click', () => {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toggleCamBtn.classList.toggle('off', !videoTrack.enabled);
        toggleCamBtn.innerText = videoTrack.enabled ? "📷" : "🚫";
    }
});

// Toggle Audio Track
toggleMicBtn.addEventListener('click', () => {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        toggleMicBtn.classList.toggle('off', !audioTrack.enabled);
        toggleMicBtn.innerText = audioTrack.enabled ? "🎤" : "🔇";
    }
});

// --- CONNECTION MONITORING ---

socket.on('connect', () => {
    statusText.innerText = "Connected (Cloudflare)";
    statusText.style.color = "#2ecc71";
});

socket.on('connect_error', (error) => {
    statusText.innerText = "Connection Error";
    statusText.style.color = "#e74c3c";
    console.error("Socket Connection Error:", error);
});

getDevices();
startBtn.addEventListener('click', startCall);
endCallBtn.addEventListener('click', endCall);