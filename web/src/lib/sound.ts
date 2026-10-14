let audioContext: AudioContext | null = null

/** Короткий сигнал; без звука в браузере — молча. */
export function beep(frequency: number, durationMs: number) {
  try {
    audioContext ??= new AudioContext()
    const ctx = audioContext
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    // Плавные края, чтобы не щёлкало
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000)

    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + durationMs / 1000 + 0.05)
  } catch {
    // Звук недоступен — таймер работает и без него.
  }
}
