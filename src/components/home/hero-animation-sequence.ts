type TitleRevealListener = () => void

let hasHeroTitleRevealed = false
const titleRevealListeners = new Set<TitleRevealListener>()

export const markHeroTitleRevealed = (): void => {
  if (hasHeroTitleRevealed) {
    return
  }

  hasHeroTitleRevealed = true
  for (const listener of titleRevealListeners) {
    listener()
  }
  titleRevealListeners.clear()
}

export const subscribeToHeroTitleReveal = (
  listener: TitleRevealListener
): (() => void) => {
  if (hasHeroTitleRevealed) {
    listener()
    return () => undefined
  }

  titleRevealListeners.add(listener)
  return () => {
    titleRevealListeners.delete(listener)
  }
}
