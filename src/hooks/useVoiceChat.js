import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';

export function useVoiceChat(socket, roomCode, myColor) {
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voicePeers, setVoicePeers] = useState({}); // { [color]: { peerId, isMuted, isConnected } }
  const [speakingPlayers, setSpeakingPlayers] = useState({}); // { [color]: boolean }
  const [errorMessage, setErrorMessage] = useState(null);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const callsRef = useRef({}); // { [peerId]: MediaConnection }
  const audioElementsRef = useRef({}); // { [peerId]: HTMLAudioElement }
  const audioContextRef = useRef(null);
  const analysersRef = useRef({}); // { [color]: AnalyserNode }
  const animationFrameRef = useRef(null);

  // Sync voicePeers state from socket
  useEffect(() => {
    if (!socket || !roomCode) return;

    const handleVoicePeersUpdated = ({ voicePeers: updatedPeers }) => {
      setVoicePeers(updatedPeers || {});
    };

    socket.on('VOICE_PEERS_UPDATED', handleVoicePeersUpdated);

    // Initial fetch
    socket.emit('GET_VOICE_PEERS', { roomCode }, (res) => {
      if (res && res.voicePeers) {
        setVoicePeers(res.voicePeers);
      }
    });

    return () => {
      socket.off('VOICE_PEERS_UPDATED', handleVoicePeersUpdated);
    };
  }, [socket, roomCode]);

  // Audio Level Analyzer loop for voice activity detection
  useEffect(() => {
    if (!isVoiceConnected) {
      setSpeakingPlayers({});
      return;
    }

    const checkVolumeLevels = () => {
      const activeSpeaking = {};
      Object.entries(analysersRef.current).forEach(([color, { analyser, dataArray }]) => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        if (average > 15) { // Threshold for active speech
          activeSpeaking[color] = true;
        }
      });

      setSpeakingPlayers(activeSpeaking);
      animationFrameRef.current = requestAnimationFrame(checkVolumeLevels);
    };

    checkVolumeLevels();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVoiceConnected]);

  // Helper: Setup Audio Analyzer for a stream & player color
  const setupAudioAnalyzer = (stream, color) => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
      }

      if (!audioContextRef.current) return;
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analysersRef.current[color] = { analyser, dataArray };
    } catch (err) {
      console.warn('Could not setup audio analyzer:', err);
    }
  };

  // Helper: Play incoming remote audio track
  const handleRemoteStream = (remoteStream, remotePeerId) => {
    if (audioElementsRef.current[remotePeerId]) {
      audioElementsRef.current[remotePeerId].srcObject = remoteStream;
      return;
    }

    const audio = new Audio();
    audio.srcObject = remoteStream;
    audio.autoplay = true;
    audioElementsRef.current[remotePeerId] = audio;

    // Find player color for this peer ID
    const peerInfo = Object.values(voicePeers).find(p => p.peerId === remotePeerId);
    if (peerInfo && peerInfo.color) {
      setupAudioAnalyzer(remoteStream, peerInfo.color);
    }
  };

  // Connect to a remote peer
  const connectToPeer = useCallback((remotePeerId) => {
    if (!peerRef.current || !localStreamRef.current || callsRef.current[remotePeerId]) return;

    try {
      const call = peerRef.current.call(remotePeerId, localStreamRef.current);
      callsRef.current[remotePeerId] = call;

      call.on('stream', (remoteStream) => {
        handleRemoteStream(remoteStream, remotePeerId);
      });

      call.on('close', () => {
        if (audioElementsRef.current[remotePeerId]) {
          audioElementsRef.current[remotePeerId].pause();
          delete audioElementsRef.current[remotePeerId];
        }
        delete callsRef.current[remotePeerId];
      });

      call.on('error', (err) => {
        console.warn(`Call error with ${remotePeerId}:`, err);
      });
    } catch (err) {
      console.error('Error calling peer:', err);
    }
  }, [voicePeers]);

  // When voicePeers changes, call any new peers we aren't connected to yet
  useEffect(() => {
    if (!isVoiceConnected || !peerRef.current || !localStreamRef.current) return;

    Object.values(voicePeers).forEach(p => {
      if (p.color !== myColor && p.peerId && !callsRef.current[p.peerId]) {
        connectToPeer(p.peerId);
      }
    });
  }, [voicePeers, isVoiceConnected, myColor, connectToPeer]);

  // Join Voice Channel
  const joinVoice = async () => {
    setErrorMessage(null);
    try {
      // 1. Get Microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // 2. Setup analyzer for local stream
      setupAudioAnalyzer(stream, myColor);

      // 3. Create PeerJS instance
      const peerId = `ludo-${roomCode}-${myColor}-${Math.random().toString(36).substring(2, 7)}`;
      const peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      peerRef.current = peer;

      peer.on('open', (id) => {
        setIsVoiceConnected(true);
        setIsMuted(false);

        // Notify room via socket
        socket.emit('VOICE_STATE_UPDATE', {
          roomCode,
          peerId: id,
          isMuted: false,
          isConnected: true
        });
      });

      // Handle incoming call from another player
      peer.on('call', (call) => {
        call.answer(localStreamRef.current);
        callsRef.current[call.peer] = call;

        call.on('stream', (remoteStream) => {
          handleRemoteStream(remoteStream, call.peer);
        });

        call.on('close', () => {
          if (audioElementsRef.current[call.peer]) {
            audioElementsRef.current[call.peer].pause();
            delete audioElementsRef.current[call.peer];
          }
          delete callsRef.current[call.peer];
        });
      });

      peer.on('error', (err) => {
        console.error('PeerJS connection error:', err);
        setErrorMessage('Voice connection error. Please try rejoining.');
      });

    } catch (err) {
      console.error('Microphone permission or audio capture error:', err);
      setErrorMessage('Microphone access denied or unavailable.');
    }
  };

  // Leave Voice Channel
  const leaveVoice = useCallback(() => {
    // Notify server
    if (socket && roomCode) {
      socket.emit('VOICE_STATE_UPDATE', {
        roomCode,
        isConnected: false
      });
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    // Close peer calls
    Object.values(callsRef.current).forEach(call => {
      try { call.close(); } catch {}
    });
    callsRef.current = {};

    // Pause audio elements
    Object.values(audioElementsRef.current).forEach(audio => {
      try { audio.pause(); } catch {}
    });
    audioElementsRef.current = {};

    // Destroy Peer instance
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
      peerRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    analysersRef.current = {};

    setIsVoiceConnected(false);
    setIsMuted(false);
  }, [socket, roomCode]);

  // Cleanup on unmount or room leave
  useEffect(() => {
    return () => {
      leaveVoice();
    };
  }, [leaveVoice]);

  // Toggle Mute State
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const newMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !newMuted;
    });
    setIsMuted(newMuted);

    if (socket && roomCode && peerRef.current) {
      socket.emit('VOICE_STATE_UPDATE', {
        roomCode,
        peerId: peerRef.current.id,
        isMuted: newMuted,
        isConnected: true
      });
    }
  };

  return {
    isVoiceConnected,
    isMuted,
    voicePeers,
    speakingPlayers,
    errorMessage,
    joinVoice,
    leaveVoice,
    toggleMute
  };
}
