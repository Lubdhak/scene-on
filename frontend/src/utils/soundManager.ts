/**
 * Lightweight sound manager using Web Audio API
 * Generates simple tones for notifications without external audio files
 */

class SoundManager {
  private audioContext: AudioContext | null = null;
  private volume: number = 0.5; // Default volume (0-1)
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  
  private readonly STORAGE_KEY = 'scene-on-volume';
  
  constructor() {
    // Load saved volume preference
    const savedVolume = localStorage.getItem(this.STORAGE_KEY);
    if (savedVolume) {
      this.volume = parseFloat(savedVolume);
    }
    
    // Set up listeners for user interaction to initialize audio
    this.setupUserInteractionListeners();
  }
  
  private setupUserInteractionListeners() {
    const initAudio = () => {
      if (!this.isInitialized) {
        this.initAudioContext();
        this.isInitialized = true;
      }
    };
    
    // Listen for first user interaction
    const events = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
    const handler = () => {
      initAudio();
      // Remove listeners after first interaction
      events.forEach(event => {
        document.removeEventListener(event, handler);
      });
    };
    
    events.forEach(event => {
      document.addEventListener(event, handler, { once: true, passive: true });
    });
  }
  
  private initAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        // Audio not supported
      }
    }
  }
  
  private async ensureAudioContext() {
    if (!this.audioContext) {
      this.initAudioContext();
    }
    
    if (this.audioContext?.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        // Resume failed
      }
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
   * Play notification sound for yell broadcasts
   * Triple-tone ascending pattern: 400Hz → 600Hz → 800Hz
   * Creates an attention-grabbing broadcast notification
   */
  async playYellNotification() {
    await this.ensureAudioContext();
    if (!this.audioContext || this.isMuted || this.volume === 0) return;

    // Triple ascending tone pattern
    await this.playTone(400, 0.15, 'sine', false);
    setTimeout(() => this.playTone(600, 0.15, 'sine', false), 160);
    setTimeout(() => this.playTone(800, 0.2, 'sine'), 320);
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
   * Also ensures audio context is initialized
   */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem(this.STORAGE_KEY, this.volume.toString());
    
    // Initialize audio context on volume change (user interaction)
    if (!this.isInitialized) {
      this.initAudioContext();
      this.isInitialized = true;
    }
  }
  
  /**
   * Get current volume (0-1)
   */
  getVolume(): number {
    return this.volume;
  }
  
  /**
   * Toggle mute
   * Also ensures audio context is initialized
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    
    // Initialize audio context on mute toggle (user interaction)
    if (!this.isInitialized) {
      this.initAudioContext();
      this.isInitialized = true;
    }
    
    return this.isMuted;
  }
  
  /**
   * Check if muted
   */
  isSoundMuted(): boolean {
    return this.isMuted;
  }
  
  /**
   * Manually initialize audio (call on user interaction)
   */
  async initialize() {
    if (!this.isInitialized) {
      this.initAudioContext();
      this.isInitialized = true;
    }
    await this.ensureAudioContext();
  }
}

// Export singleton instance
export const soundManager = new SoundManager();
