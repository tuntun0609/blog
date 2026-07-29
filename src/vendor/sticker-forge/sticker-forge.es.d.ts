export interface StickerForgeInstance {
  destroy: () => void
  reset: () => void
  resize: () => void
  setOptions: (options: unknown) => void
}

export const createSticker: (
  target: HTMLElement | string,
  options?: unknown
) => Promise<StickerForgeInstance>
