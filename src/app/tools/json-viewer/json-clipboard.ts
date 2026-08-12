type ClipboardWriter = (value: string) => Promise<void>
type ClipboardFallback = (value: string) => boolean

export const copyTextWithFallback = async (
  value: string,
  writeText: ClipboardWriter,
  fallback: ClipboardFallback
): Promise<void> => {
  try {
    await writeText(value)
  } catch (error) {
    if (!fallback(value)) {
      throw new Error('浏览器拒绝了复制操作。', { cause: error })
    }
  }
}
