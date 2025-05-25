/**
 * Lock-On Audio Component
 * Provides audio feedback for lock-on system state changes
 */

import { useEffect, useRef } from 'react';

type LockState = 'SEARCHING' | 'LOCKING' | 'LOCKED' | 'LOST';

interface LockOnAudioProps {
  state: LockState;
  enabled?: boolean;
}

export default function LockOnAudio({ state, enabled = true }: LockOnAudioProps) {
  const previousStateRef = useRef<LockState | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Initialize audio context on first use
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn('Audio context not supported:', error);
        return;
      }
    }

    const previousState = previousStateRef.current;
    previousStateRef.current = state;

    // Play audio feedback on state transitions
    if (previousState !== state) {
      switch (state) {
        case 'LOCKED':
          playLockBeep();
          break;
        case 'LOST':
          playLostBoops();
          break;
        // No audio for SEARCHING or LOCKING states
      }
    }
  }, [state, enabled]);

  const playLockBeep = () => {
    if (!audioContextRef.current) return;

    try {
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // 880 Hz square wave, 200ms duration
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      
      // Quick attack and decay
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
    } catch (error) {
      console.warn('Failed to play lock beep:', error);
    }
  };

  const playLostBoops = () => {
    if (!audioContextRef.current) return;

    try {
      const ctx = audioContextRef.current;
      
      // First boop
      setTimeout(() => playBoop(220), 0);
      // Second boop
      setTimeout(() => playBoop(220), 200);
    } catch (error) {
      console.warn('Failed to play lost boops:', error);
    }
  };

  const playBoop = (frequency: number) => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Low-tone sine wave
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    // Slower attack and decay for a "boop" sound
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  };

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return null; // This component doesn't render anything visual
} 