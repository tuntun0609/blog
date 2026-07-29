let audioContext: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null
let lastSoundAt = 0

const SOUND_COOLDOWN_MS = 42
const NOISE_DURATION_SECONDS = 0.08
const MASTER_GAIN = 0.75

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

const scheduleKeyImpact = (
  context: AudioContext,
  destination: AudioNode,
  startAt: number,
  volume: number,
  frequency: number,
  resonance: number,
  duration: number
): void => {
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()

  source.buffer = getNoiseBuffer(context)
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(frequency, startAt)
  filter.Q.setValueAtTime(resonance, startAt)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.001)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  source.start(startAt)
  source.stop(startAt + duration + 0.008)
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
  const normalizedIntensity = Math.min(1, Math.max(0.35, intensity))

  // 以随机噪声模拟实体撞击，避免振荡器带来的电子提示音感。
  master.gain.setValueAtTime(MASTER_GAIN * normalizedIntensity, startAt)
  master.connect(context.destination)

  // 下压时键帽撞击轴体与定位板：清脆的高频瞬态叠加短促的壳体共鸣。
  scheduleKeyImpact(context, master, startAt, 0.64, 2450, 2.4, 0.013)
  scheduleKeyImpact(context, master, startAt, 0.48, 720, 0.9, 0.031)
  // 键帽回弹比下压更轻、更闷，形成真实键程的第二个触点。
  scheduleKeyImpact(context, master, startAt + 0.038, 0.3, 1520, 1.8, 0.017)
}
