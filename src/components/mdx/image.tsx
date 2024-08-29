import NextImage, { ImageProps } from 'next/image'

import { ImagePreview } from '../image-preview'

const Image = ({ src, ...rest }: ImageProps) => (
  <ImagePreview src={src as string}>
    <NextImage className="cursor-pointer" src={src} {...rest} />
  </ImagePreview>
)

export default Image
