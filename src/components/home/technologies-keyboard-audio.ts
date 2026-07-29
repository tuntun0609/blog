let audioContext: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null
let lastSoundAt = 0

const SOUND_COOLDOWN_MS = 42
const NOISE_DURATION_SECONDS = 0.08
const MASTER_GAIN = 0.28

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined' || !window.AudioContext) {
    return null
  }

  audioContext ??= new window.AudioContext()
  return audioContext
}

const getNoiseBuffer = (context: AudioContext): AudioBuffer => {
  if (noiseBuffer) {
    return noiseBuffer
  }

  const frameCount = Math.ceil(context.sampleRate * NOISE_DURATION_SECONDS)
  const buffer = context.createBuffer(1, frameCount, context.sampleRate)
  const channel = buffer.getChannelData(0)

  for (let index = 0; index < frameCount; index += 1) {
    const envelope = 1 - index / frameCount
    channel[index] = (Math.random() * 2 - 1) * envelope
  }

  noiseBuffer = buffer
  return buffer
}

const scheduleClickTransient = (
  context: AudioContext,
  destination: AudioNode,
  startAt: number,
  volume: number,
  frequency: number
): void => {
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()

  source.buffer = getNoiseBuffer(context)
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(frequency, startAt)
  filter.Q.setValueAtTime(0.82, startAt)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.026)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  source.start(startAt)
  source.stop(startAt + 0.035)
}

export const unlockKeyboardAudio = (): void => {
  const context = getAudioContext()

  if (context?.state === 'suspended') {
    context.resume().catch(() => {
      // Browsers can reject audio activation outside a user gesture.
    })
  }
}

export const playMechanicalKeySound = (intensity = 1): void => {
  const now = performance.now()

  if (now - lastSoundAt < SOUND_COOLDOWN_MS) {
    return
  }

  const context = getAudioContext()

  if (context?.state !== 'running') {
    return
  }

  lastSoundAt = now
  const startAt = context.currentTime
  const master = context.createGain()
  const lowBody = context.createOscillator()
  const lowGain = context.createGain()
  const normalizedIntensity = Math.min(1, Math.max(0.35, intensity))

  // 保持短促的双段机械触感，同时让声音在常见笔记本扬声器上更清晰。
  master.gain.setValueAtTime(MASTER_GAIN * normalizedIntensity, startAt)
  master.connect(context.destination)

  scheduleClickTransient(context, master, startAt, 0.72, 1950)
  scheduleClickTransient(context, master, startAt + 0.031, 0.42, 1120)

  lowBody.type = 'triangle'
  lowBody.frequency.setValueAtTime(138, startAt)
  lowBody.frequency.exponentialRampToValueAtTime(92, startAt + 0.04)
  lowGain.gain.setValueAtTime(0.0001, startAt)
  lowGain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.002)
  lowGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.045)

  lowBody.connect(lowGain)
  lowGain.connect(master)
  lowBody.start(startAt)
  lowBody.stop(startAt + 0.05)
}
