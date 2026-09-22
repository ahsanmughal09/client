import React from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, Volume2, AlertCircle } from 'lucide-react';
import { sounds } from '../utils/audio';

const COLOR_HEX = {
  red: '#FF4757',
  green: '#2ED573',
  yellow: '#FFA502',
  blue: '#1E90FF',
  orange: '#FF6B81',
  purple: '#A55EEA'
};

export default function VoiceChatControls({ voiceState }) {
  if (!voiceState) return null;

  const {
    isVoiceConnected,
    isMuted,
    voicePeers,
    speakingPlayers,
    errorMessage,
    joinVoice,
    leaveVoice,
    toggleMute
  } = voiceState;

  const handleJoin = () => {
    sounds.playClick();
    joinVoice();
  };

  const handleLeave = () => {
    sounds.playClick();
    leaveVoice();
  };

  const handleMuteToggle = () => {
    sounds.playClick();
    toggleMute();
  };

  const connectedCount = Object.keys(voicePeers).length;

  return (
    <div 
      className="glass-panel" 
      style={{ 
        padding: '10px 14px', 
        background: 'rgba(15, 23, 42, 0.7)', 
        borderBottom: '1px solid var(--border-glass)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Volume2 size={16} color="#818CF8" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#FFF' }}>
            Voice ({connectedCount})
          </span>
        </div>

        {!isVoiceConnected ? (
          <button 
            onClick={handleJoin}
            className="glass-btn primary"
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.8rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              border: 'none'
            }}
          >
            <PhoneCall size={14} />
            <span>Join Voice</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Mic Toggle */}
            <button
              onClick={handleMuteToggle}
              style={{
                background: isMuted ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 10px',
                color: '#FFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
              title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
              <span>{isMuted ? 'Muted' : 'Mic On'}</span>
            </button>

            {/* Leave Voice Button */}
            <button
              onClick={handleLeave}
              style={{
                background: 'rgba(71, 85, 105, 0.6)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '8px',
                padding: '6px 8px',
                color: '#EF4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem'
              }}
              title="Leave Voice Chat"
            >
              <PhoneOff size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Connected Voice Members List */}
      {connectedCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '2px' }}>
          {Object.entries(voicePeers).map(([color, peerInfo]) => {
            const isSpeaking = speakingPlayers[color];
            const hex = COLOR_HEX[color] || '#6366F1';

            return (
              <div
                key={`voice-badge-${color}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: `1px solid ${isSpeaking ? '#10B981' : hex}`,
                  boxShadow: isSpeaking ? '0 0 8px #10B981' : 'none',
                  fontSize: '0.75rem',
                  color: '#E2E8F0',
                  transition: 'all 0.2s ease'
                }}
              >
                <div 
                  style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    background: hex 
                  }} 
                />
                <span style={{ textTransform: 'capitalize' }}>{color}</span>
                {peerInfo.isMuted ? (
                  <MicOff size={12} color="#EF4444" />
                ) : (
                  <Mic 
                    size={12} 
                    color={isSpeaking ? '#10B981' : '#94A3B8'} 
                    style={{ animation: isSpeaking ? 'pulse 0.8s infinite' : 'none' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#F87171', marginTop: '2px' }}>
          <AlertCircle size={14} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
