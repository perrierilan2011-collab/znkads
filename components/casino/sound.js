/**
 * Petits effets sonores générés en WebAudio.
 * Aucun fichier audio externe, aucun appel réseau.
 */

let audioContext = null

function getAudioContext() {
  if (typeof window === 'undefined') return null

  const AudioCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioCtor) return null

  if (!audioContext) audioContext = new AudioCtor()
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})

  return audioContext
}

function tone(audio, frequency, offset, duration, options = {}) {
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  const start = audio.currentTime + offset
  const peak = options.gain ?? 0.045

  oscillator.type = options.type || 'sine'
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  oscillator.connect(gain)
  gain.connect(audio.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

export function playSound(kind, enabled = true) {
  if (!enabled) return

  const audio = getAudioContext()
  if (!audio) return

  try {
    if (kind === 'win') {
      tone(audio, 523.25, 0, 0.16, { type: 'triangle' })
      tone(audio, 659.25, 0.09, 0.16, { type: 'triangle' })
      tone(audio, 783.99, 0.18, 0.18, { type: 'triangle' })
      tone(audio, 1046.5, 0.27, 0.32, { type: 'triangle', gain: 0.06 })
      return
    }

    if (kind === 'bigwin') {
      ;[523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((frequency, index) => {
        tone(audio, frequency, index * 0.08, 0.28, {
          type: 'triangle',
          gain: 0.06
        })
      })
      return
    }

    if (kind === 'lose') {
      tone(audio, 311.13, 0, 0.16, { type: 'sine', gain: 0.03 })
      tone(audio, 233.08, 0.12, 0.24, { type: 'sine', gain: 0.03 })
      return
    }

    if (kind === 'spin') {
      tone(audio, 180, 0, 0.09, { type: 'square', gain: 0.018 })
      return
    }

    if (kind === 'card') {
      tone(audio, 420, 0, 0.05, { type: 'square', gain: 0.02 })
      return
    }

    if (kind === 'coin') {
      tone(audio, 880, 0, 0.07, { type: 'square', gain: 0.022 })
      tone(audio, 1320, 0.07, 0.1, { type: 'square', gain: 0.018 })
      return
    }

    tone(audio, 520, 0, 0.05, { type: 'sine', gain: 0.02 })
  } catch {
    // Le son ne doit jamais bloquer une action de jeu.
  }
}
