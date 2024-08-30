import NextImage, { ImageProps } from 'next/image'

import { cn } from '@/lib/utils'

import { ImagePreview } from '../image-preview'

const Image = ({ src, className, ...rest }: ImageProps) => (
  <ImagePreview src={src as string}>
    <NextImage {...rest} className={cn('mb-4 cursor-pointer', className)} src={src} />
  </ImagePreview>
)

export default Image
