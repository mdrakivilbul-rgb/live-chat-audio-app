// WebRTC Audio Call Implementation
class WebRTCManager {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.isCallActive = false;
        this.isMuted = false;
        this.callTimer = null;
        this.callStartTime = null;
        this.currentCallData = null;

        // WebRTC configuration
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        // DOM elements
        this.callModal = document.getElementById('callModal');
        this.incomingCallModal = document.getElementById('incomingCallModal');
        this.callTitle = document.getElementById('callTitle');
        this.callStatus = document.getElementById('callStatus');
        this.callUserName = document.getElementById('callUserName');
        this.callTimer = document.getElementById('callTimer');
        this.incomingCallerName = document.getElementById('incomingCallerName');
        this.muteBtn = document.getElementById('muteBtn');
        this.speakerBtn = document.getElementById('speakerBtn');
        this.localAudio = document.getElementById('localAudio');
        this.remoteAudio = document.getElementById('remoteAudio');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle ICE candidates from socket
        if (window.socket) {
            window.socket.on('ice_candidate', (data) => {
                this.handleIceCandidate(data);
            });
        }
    }

    async startCall(receiverId, receiverUsername) {
        try {
            this.currentCallData = { receiverId, receiverUsername };
            
            // Show call modal
            this.showCallModal(receiverUsername, 'Calling...');
            
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: false 
            });
            
            this.localAudio.srcObject = this.localStream;
            
            // Create peer connection
            this.createPeerConnection();
            
            // Add local stream to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            // Create offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // Send call request to server
            window.socket.emit('call_user', {
                receiverId: receiverId,
                offer: offer
            });
            
        } catch (error) {
            console.error('Error starting call:', error);
            this.showNotification('Failed to start call. Please check your microphone permissions.', 'error');
            this.hideCallModal();
        }
    }

    async handleIncomingCall(data) {
        try {
            this.currentCallData = {
                receiverId: data.callerId,
                receiverUsername: data.callerUsername,
                offer: data.offer
            };
            
            // Show incoming call modal
            this.showIncomingCallModal(data.callerUsername);
            
        } catch (error) {
            console.error('Error handling incoming call:', error);
        }
    }

    async acceptCall() {
        try {
            // Hide incoming call modal and show call modal
            this.hideIncomingCallModal();
            this.showCallModal(this.currentCallData.receiverUsername, 'Connecting...');
            
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: false 
            });
            
            this.localAudio.srcObject = this.localStream;
            
            // Create peer connection
            this.createPeerConnection();
            
            // Add local stream to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            // Set remote description
            await this.peerConnection.setRemoteDescription(this.currentCallData.offer);
            
            // Create answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            // Send answer to caller
            window.socket.emit('answer_call', {
                callerId: this.currentCallData.receiverId,
                answer: answer
            });
            
        } catch (error) {
            console.error('Error accepting call:', error);
            this.showNotification('Failed to accept call. Please check your microphone permissions.', 'error');
            this.hideCallModal();
        }
    }

    rejectCall() {
        // Send rejection to caller
        window.socket.emit('reject_call', {
            callerId: this.currentCallData.receiverId
        });
        
        this.hideIncomingCallModal();
        this.currentCallData = null;
    }

    async handleCallAnswered(data) {
        try {
            // Set remote description with the answer
            await this.peerConnection.setRemoteDescription(data.answer);
            
            // Update call status
            this.updateCallStatus('Connected');
            this.startCallTimer();
            
        } catch (error) {
            console.error('Error handling call answer:', error);
            this.endCall();
        }
    }

    handleCallRejected(data) {
        this.showNotification('Call was rejected', 'info');
        this.hideCallModal();
        this.cleanup();
    }

    handleCallEnded(data) {
        this.showNotification('Call ended', 'info');
        this.hideCallModal();
        this.cleanup();
    }

    endCall() {
        // Send end call signal
        if (this.currentCallData) {
            window.socket.emit('end_call', {
                otherUserId: this.currentCallData.receiverId
            });
        }
        
        this.hideCallModal();
        this.cleanup();
    }

    createPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.config);
        
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCallData) {
                window.socket.emit('ice_candidate', {
                    receiverId: this.currentCallData.receiverId,
                    candidate: event.candidate
                });
            }
        };
        
        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            this.remoteAudio.srcObject = this.remoteStream;
            
            // Update call status when remote stream is received
            this.updateCallStatus('Connected');
            this.startCallTimer();
        };
        
        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            
            if (this.peerConnection.connectionState === 'connected') {
                this.updateCallStatus('Connected');
                this.startCallTimer();
            } else if (this.peerConnection.connectionState === 'disconnected' || 
                      this.peerConnection.connectionState === 'failed') {
                this.endCall();
            }
        };
    }

    async handleIceCandidate(data) {
        try {
            if (this.peerConnection && data.candidate) {
                await this.peerConnection.addIceCandidate(data.candidate);
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isMuted = !audioTrack.enabled;
                
                // Update mute button
                const muteIcon = this.muteBtn.querySelector('i');
                if (this.isMuted) {
                    muteIcon.className = 'fas fa-microphone-slash';
                    this.muteBtn.style.background = 'var(--danger-color)';
                } else {
                    muteIcon.className = 'fas fa-microphone';
                    this.muteBtn.style.background = '';
                }
            }
        }
    }

    toggleSpeaker() {
        // Note: Speaker toggle is limited in web browsers for security reasons
        // This is more of a visual indicator
        const speakerIcon = this.speakerBtn.querySelector('i');
        const isOn = speakerIcon.className.includes('volume-up');
        
        if (isOn) {
            speakerIcon.className = 'fas fa-volume-mute';
            this.speakerBtn.style.background = 'var(--warning-color)';
            if (this.remoteAudio) {
                this.remoteAudio.volume = 0.1;
            }
        } else {
            speakerIcon.className = 'fas fa-volume-up';
            this.speakerBtn.style.background = '';
            if (this.remoteAudio) {
                this.remoteAudio.volume = 1.0;
            }
        }
    }

    showCallModal(username, status) {
        this.callUserName.textContent = username;
        this.updateCallStatus(status);
        this.callModal.classList.remove('hidden');
        this.isCallActive = true;
    }

    hideCallModal() {
        this.callModal.classList.add('hidden');
        this.isCallActive = false;
        this.stopCallTimer();
    }

    showIncomingCallModal(callerName) {
        this.incomingCallerName.textContent = callerName;
        this.incomingCallModal.classList.remove('hidden');
        
        // Play incoming call sound (if available)
        this.playIncomingCallSound();
    }

    hideIncomingCallModal() {
        this.incomingCallModal.classList.add('hidden');
        this.stopIncomingCallSound();
    }

    updateCallStatus(status) {
        this.callStatus.textContent = status;
    }

    startCallTimer() {
        this.callStartTime = Date.now();
        this.callTimer = setInterval(() => {
            const elapsed = Date.now() - this.callStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('callTimer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        document.getElementById('callTimer').textContent = '00:00';
    }

    playIncomingCallSound() {
        // Create a simple beep sound for incoming calls
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
            
            // Repeat every 2 seconds
            this.incomingCallSoundInterval = setInterval(() => {
                if (this.incomingCallModal.classList.contains('hidden')) {
                    this.stopIncomingCallSound();
                    return;
                }
                
                const newOscillator = audioContext.createOscillator();
                const newGainNode = audioContext.createGain();
                
                newOscillator.connect(newGainNode);
                newGainNode.connect(audioContext.destination);
                
                newOscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                newGainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                
                newOscillator.start();
                newOscillator.stop(audioContext.currentTime + 0.5);
            }, 2000);
            
        } catch (error) {
            console.log('Could not play incoming call sound:', error);
        }
    }

    stopIncomingCallSound() {
        if (this.incomingCallSoundInterval) {
            clearInterval(this.incomingCallSoundInterval);
            this.incomingCallSoundInterval = null;
        }
    }

    cleanup() {
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Reset audio elements
        this.localAudio.srcObject = null;
        this.remoteAudio.srcObject = null;
        
        // Reset state
        this.remoteStream = null;
        this.isCallActive = false;
        this.isMuted = false;
        this.currentCallData = null;
        
        // Reset UI
        this.stopCallTimer();
        this.stopIncomingCallSound();
        
        // Reset button states
        const muteIcon = this.muteBtn.querySelector('i');
        muteIcon.className = 'fas fa-microphone';
        this.muteBtn.style.background = '';
        
        const speakerIcon = this.speakerBtn.querySelector('i');
        speakerIcon.className = 'fas fa-volume-up';
        this.speakerBtn.style.background = '';
    }

    showNotification(message, type) {
        // Use the global notification function
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Initialize WebRTC manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.webRTC = new WebRTCManager();
});

// Export for global access
window.WebRTCManager = WebRTCManager;

