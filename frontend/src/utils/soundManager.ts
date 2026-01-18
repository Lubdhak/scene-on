/**
 * Lightweight sound manager using Web Audio API
 * Generates simple tones for notifications without external audio files
 */

class SoundManager {
  private audioContext: AudioContext | null = null;
  private volume: number = 0.5; // Default volume (0-1)
  private isMuted: boolean = false;
  
  private readonly STORAGE_KEY = 'scene-on-volume';
  
  constructor() {
    // Load saved volume preference
    const savedVolume = localStorage.getItem(this.STORAGE_KEY);
    if (savedVolume) {
      this.volume = parseFloat(savedVolume);
    }
    
    // Initialize on user interaction (required by browsers)
    this.initAudioContext();
  }
  
  private initAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new AudioContext();
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    }
  }
  
  private async ensureAudioContext() {
    this.initAudioContext();
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
  
  private async playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    fadeOut: boolean = true
  ) {
    if (this.isMuted || this.volume === 0 || !this.audioContext) return;
    
    await this.ensureAudioContext();
    if (!this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    
    // Create oscillator
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    
    // Create gain node for volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.volume;
    
    // Fade out for smoother sound
    if (fadeOut) {
      gainNode.gain.setValueAtTime(this.volume, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    }
    
    // Connect and play
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
  
  /**
   * Play notification sound for incoming chat requests
   * Higher pitched, attention-grabbing
   */
  async playRequestNotification() {
    await this.ensureAudioContext();
    if (!this.audioContext || this.isMuted || this.volume === 0) return;
    
    const now = this.audioContext.currentTime;
    
    // Two-tone notification (like a doorbell)
    await this.playTone(800, 0.15, 'sine', false);
    setTimeout(() => this.playTone(600, 0.2, 'sine'), 150);
  }
  
  /**
   * Play sound for incoming chat messages
   * Soft, pleasant tone
   */
  async playIncomingMessage() {
    await this.playTone(520, 0.12, 'sine');
  }
  
  /**
   * Play sound for outgoing chat messages
   * Subtle confirmation sound
   */
  async playOutgoingMessage() {
    await this.playTone(440, 0.08, 'sine');
  }
  
  /**
   * Set volume (0-1)
   */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem(this.STORAGE_KEY, this.volume.toString());
  }
  
  /**
   * Get current volume (0-1)
   */
  getVolume(): number {
    return this.volume;
  }
  
  /**
   * Toggle mute
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
  
  /**
   * Check if muted
   */
  isSoundMuted(): boolean {
    return this.isMuted;
  }
}

// Export singleton instance
export const soundManager = new SoundManager();
