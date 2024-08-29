'use client'

import { ReactElement } from 'react'
import { PhotoProvider, PhotoView } from 'react-photo-view'

export const ImagePreview = ({ src, children }: { src?: string; children: ReactElement }) => (
  <PhotoProvider bannerVisible={false} maskOpacity={0.5} speed={() => 300}>
    <PhotoView src={src}>{children}</PhotoView>
  </PhotoProvider>
)
