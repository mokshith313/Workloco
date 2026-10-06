// WorkLoco Candidate Audio Intro Simulator with animated waveform visualizer

export class AudioIntroController {
  constructor(canvasContainerId = 'audio-waveform-container') {
    this.containerId = canvasContainerId;
    this.isRecording = false;
    this.isPlaying = false;
    this.recordDuration = 0;
    this.timer = null;
    this.recordedAudioUrl = null;
  }

  startRecording(onTick, onComplete) {
    this.isRecording = true;
    this.recordDuration = 0;
    this.renderWaveform(true);

    this.timer = setInterval(() => {
      this.recordDuration++;
      if (onTick) onTick(this.recordDuration);

      if (this.recordDuration >= 30) {
        this.stopRecording(onComplete);
      }
    }, 1000);
  }

  stopRecording(onComplete) {
    this.isRecording = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.recordedAudioUrl = 'https://assets.workloco.in/user_intros/candidate_voice_intro.mp3';
    this.renderWaveform(false);
    if (onComplete) onComplete(this.recordedAudioUrl, this.recordDuration);
  }

  renderWaveform(isLive = false) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = '';
    const barCount = 28;

    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement('div');
      bar.className = 'waveform-bar';

      if (isLive) {
        // Random dynamic height for recording pulse
        const randomHeight = Math.floor(Math.random() * 36) + 8;
        bar.style.height = `${randomHeight}px`;
        bar.style.background = '#DC2626'; // Alert Red when recording
      } else {
        // Static soundwave profile
        const samplePattern = [8, 14, 22, 32, 28, 16, 24, 38, 42, 30, 18, 26, 34, 40, 36, 22, 14, 28, 36, 20, 10, 16, 24, 18, 12, 8, 6, 8];
        const height = samplePattern[i % samplePattern.length];
        bar.style.height = `${height}px`;
        bar.style.background = '#D94A26';
      }

      container.appendChild(bar);
    }
  }
}

export const audioController = new AudioIntroController();
