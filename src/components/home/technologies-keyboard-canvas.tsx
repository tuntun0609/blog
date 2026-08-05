'use client'

import { type RefObject, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  playMechanicalKeySound,
  unlockKeyboardAudio,
} from './technologies-keyboard-audio'
import {
  createTechnologiesKeyboard,
  KEYBOARD_USB_CABLE_ANCHOR,
  KEYCAP_TRAVEL,
  type KeyboardCableOrigin,
  type KeyboardVisualPass,
  type TechnologySlot,
} from './technologies-keyboard-model'

interface TechnologiesKeyboardCanvasProps {
  readonly activeSlot: number | null
  readonly onCableOriginChange: (origin: KeyboardCableOrigin) => void
  readonly onSlotActivate: (slotIndex: number) => void
  readonly presentationProgressRef: RefObject<number>
  readonly slots: readonly TechnologySlot[]
}

const REVIEW_PASSES = new Set<KeyboardVisualPass>([
  'blockout',
  'structural-pass',
  'form-refinement',
  'material-pass',
  'surface-pass',
  'lighting-pass',
  'interaction-pass',
  'optimization-pass',
])
/**
 * 键盘整体构图参数。
 *
 * 默认相机位置的 x/y/z 分别控制左右视角、俯视高度、前后视角；
 * 三个数值同时向 0 靠近会放大键盘，远离则缩小键盘。
 */
const KEYBOARD_VIEW = {
  /** 默认的左前方俯视角。 */
  cameraPosition: new THREE.Vector3(-9.1, 15, 11.1),
  /** 相机注视点；提高 y 会让视线更平，降低 y 会看到更多顶面。 */
  cameraTarget: new THREE.Vector3(0, 0.45, 0),
  /** 数值越小越接近产品图，越大则透视感越强。 */
  fieldOfViewDegrees: 30,
  /** 第三屏居中展示时的正面机位；视线与水平底座保持 45°。 */
  frontCameraPosition: new THREE.Vector3(0, 15.05, 14.6),
  /** 仅供 ?keyboardView=grazing 检视的低机位。 */
  grazingCameraPosition: new THREE.Vector3(9.4, 3.25, 10.3),
  /** 鼠标移动带来的额外倾斜强度，设为 0 可关闭此交互。 */
  pointerTiltSensitivity: 0.018,
  /** 第三屏展示时底座保持水平，由相机机位形成 45° 夹角。 */
  presentationTiltRadians: 0,
  /** 仅供 ?keyboardView=rear 检视的后方机位。 */
  rearCameraPosition: new THREE.Vector3(-8.7, 7.1, -10.8),
  /** 仅供 ?keyboardView=top 检视的俯视机位。 */
  topCameraPosition: new THREE.Vector3(0.01, 15.5, 0.01),
  /** 用户侧前倾角度；增加后键帽顶面和图标会更面向视线。 */
  userFacingTiltRadians: THREE.MathUtils.degToRad(2),
} as const
const MAX_PIXEL_RATIO = 1.7
/** 快速点击也至少保留一帧以上的按压状态，确保按键行程可见。 */
const MINIMUM_KEYCAP_PRESS_DURATION_MS = 84

const getKeyTravelTarget = ({
  isActive,
  isPressed,
}: {
  isActive: boolean
  isPressed: boolean
}): number => {
  if (isPressed) {
    return KEYCAP_TRAVEL.press
  }

  if (isActive) {
    return KEYCAP_TRAVEL.hover
  }

  return 0
}

const getVisualPass = (): KeyboardVisualPass => {
  const requestedPass = new URLSearchParams(window.location.search).get(
    'keyboardPass'
  )

  if (requestedPass && REVIEW_PASSES.has(requestedPass as KeyboardVisualPass)) {
    return requestedPass as KeyboardVisualPass
  }

  return 'optimization-pass'
}

const getCameraPosition = (): THREE.Vector3 => {
  const requestedView = new URLSearchParams(window.location.search).get(
    'keyboardView'
  )

  if (requestedView === 'grazing') {
    return KEYBOARD_VIEW.grazingCameraPosition
  }

  if (requestedView === 'top') {
    return KEYBOARD_VIEW.topCameraPosition
  }

  if (requestedView === 'rear') {
    return KEYBOARD_VIEW.rearCameraPosition
  }

  return KEYBOARD_VIEW.cameraPosition
}

export function TechnologiesKeyboardCanvas({
  activeSlot,
  onCableOriginChange,
  onSlotActivate,
  presentationProgressRef,
  slots,
}: TechnologiesKeyboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeSlotRef = useRef(activeSlot)
  const onCableOriginChangeRef = useRef(onCableOriginChange)
  const onSlotActivateRef = useRef(onSlotActivate)
  const [isUnavailable, setIsUnavailable] = useState(false)

  useEffect(() => {
    activeSlotRef.current = activeSlot
  }, [activeSlot])

  useEffect(() => {
    onCableOriginChangeRef.current = onCableOriginChange
  }, [onCableOriginChange])

  useEffect(() => {
    onSlotActivateRef.current = onSlotActivate
  }, [onSlotActivate])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    let renderer: THREE.WebGLRenderer

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        powerPreference: 'high-performance',
      })
    } catch {
      setIsUnavailable(true)
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      KEYBOARD_VIEW.fieldOfViewDegrees,
      1,
      0.1,
      100
    )
    const raycaster = new THREE.Raycaster()
    const cameraPosition = getCameraPosition()
    const presentationCameraPosition = KEYBOARD_VIEW.frontCameraPosition
    const pointer = new THREE.Vector2(2, 2)
    const pointerTilt = new THREE.Vector2()
    const cableAnchorWorldPosition = new THREE.Vector3()
    const cableAnchorProjection = new THREE.Vector3()
    const lastCableOrigin = new THREE.Vector2(Number.NaN, Number.NaN)
    const currentTilt = new THREE.Vector2(
      KEYBOARD_VIEW.userFacingTiltRadians,
      0
    )
    const motionPreference = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    )
    const runtime = createTechnologiesKeyboard({
      anisotropy: Math.min(renderer.capabilities.getMaxAnisotropy(), 8),
      slots,
      visualPass: getVisualPass(),
    })
    runtime.root.rotation.x = KEYBOARD_VIEW.userFacingTiltRadians
    const environmentLight = new THREE.HemisphereLight(
      '#F4F6FA',
      '#2C2E33',
      1.65
    )
    const keyLight = new THREE.DirectionalLight('#FFF4E7', 3.8)
    const fillLight = new THREE.DirectionalLight('#DDE7F4', 0.72)
    const rimLight = new THREE.DirectionalLight('#E8F1FF', 1.15)

    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.02

    camera.position.copy(cameraPosition)
    camera.lookAt(KEYBOARD_VIEW.cameraTarget)

    keyLight.position.set(-7, 11, 7)
    fillLight.position.set(8, 5, -5)
    rimLight.position.set(4, 8, -10)

    scene.add(environmentLight, keyLight, fillLight, rimLight, runtime.root)

    let modelDrawCalls = 0
    let modelTriangles = 0

    runtime.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return
      }

      const positionCount = object.geometry.getAttribute('position')?.count ?? 0
      const indexCount = object.geometry.getIndex()?.count ?? 0

      modelDrawCalls += Array.isArray(object.material)
        ? object.material.length
        : 1
      modelTriangles += (indexCount || positionCount) / 3
    })
    canvas.dataset.modelDrawCalls = String(modelDrawCalls)
    canvas.dataset.modelTriangles = String(Math.round(modelTriangles))

    let animationFrame = 0
    let hoveredSlot: number | null = null
    let pressedSlot: number | null = null
    let pressStartedAt = 0
    let pressReleaseAt = 0
    let isVisible = true
    let isDestroyed = false
    let lastFrameAt = window.performance.now()
    let hasRecordedRenderStats = false
    let cameraDistanceMultiplier = 1

    const updatePresentationCamera = (presentationProgress: number): void => {
      camera.position
        .lerpVectors(
          cameraPosition,
          presentationCameraPosition,
          presentationProgress
        )
        .multiplyScalar(cameraDistanceMultiplier)
      camera.lookAt(KEYBOARD_VIEW.cameraTarget)
    }

    const updateCamera = (): void => {
      const width = Math.max(1, canvas.clientWidth)
      const height = Math.max(1, canvas.clientHeight)
      const aspect = width / height
      cameraDistanceMultiplier = aspect < 1.05 ? 1.2 : 1

      camera.aspect = aspect
      updatePresentationCamera(presentationProgressRef.current)
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
      )
      renderer.setSize(width, height, false)
    }

    const updatePointer = (event: PointerEvent): void => {
      const bounds = canvas.getBoundingClientRect()
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      pointerTilt.set(pointer.x, pointer.y)
    }

    const findHitSlot = (event: PointerEvent): number | null => {
      updatePointer(event)
      raycaster.setFromCamera(pointer, camera)
      const [hit] = raycaster.intersectObjects(runtime.clickableMeshes, false)
      const keyIndex = hit?.object.userData.keyIndex
      return typeof keyIndex === 'number' ? keyIndex : null
    }

    const setHoveredSlot = (slotIndex: number | null): void => {
      if (slotIndex === hoveredSlot) {
        return
      }

      hoveredSlot = slotIndex
      canvas.style.cursor = slotIndex === null ? 'grab' : 'pointer'

      if (slotIndex !== null) {
        playMechanicalKeySound(0.82)
      }
    }

    const handlePointerMove = (event: PointerEvent): void => {
      setHoveredSlot(findHitSlot(event))
    }

    const handlePointerDown = (event: PointerEvent): void => {
      unlockKeyboardAudio()
      const hitSlot = findHitSlot(event)
      pressedSlot = hitSlot
      pressStartedAt = window.performance.now()
      pressReleaseAt = Number.POSITIVE_INFINITY
      setHoveredSlot(hitSlot)

      if (hitSlot !== null) {
        playMechanicalKeySound(1)
      }

      canvas.setPointerCapture(event.pointerId)
    }

    const handlePointerUp = (event: PointerEvent): void => {
      const releasedSlot = findHitSlot(event)

      if (pressedSlot !== null && releasedSlot === pressedSlot) {
        onSlotActivateRef.current(pressedSlot)
      }

      pressReleaseAt = Math.max(
        window.performance.now(),
        pressStartedAt + MINIMUM_KEYCAP_PRESS_DURATION_MS
      )

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
    }

    const handlePointerCancel = (): void => {
      pressedSlot = null
      pressReleaseAt = 0
    }

    const handlePointerLeave = (): void => {
      pointerTilt.set(0, 0)
      pressedSlot = null
      pressReleaseAt = 0
      setHoveredSlot(null)
    }

    const updateKeyAnimations = (
      response: number,
      externalActiveSlot: number | null
    ): void => {
      for (let index = 0; index < runtime.keys.length; index += 1) {
        const key = runtime.keys[index]
        const isActive = index === hoveredSlot || index === externalActiveSlot
        const skill = slots[index]?.skill
        const targetTravel = getKeyTravelTarget({
          isActive,
          isPressed: index === pressedSlot,
        })

        key.travel = THREE.MathUtils.lerp(key.travel, targetTravel, response)
        key.pivot.position.y = key.baseY - key.travel
        key.keyMaterial.emissive.set(
          isActive && skill ? skill.keyColor : '#000000'
        )
        key.keyMaterial.emissiveIntensity = isActive ? 0.035 : 0
      }
    }

    const updateAssemblyTilt = (
      response: number,
      reducedMotion: boolean,
      presentationProgress: number
    ): void => {
      const baseTilt = THREE.MathUtils.lerp(
        KEYBOARD_VIEW.userFacingTiltRadians,
        KEYBOARD_VIEW.presentationTiltRadians,
        presentationProgress
      )
      const pointerInfluence = 1 - presentationProgress
      const targetTiltX =
        baseTilt +
        (reducedMotion
          ? 0
          : pointerTilt.y *
            KEYBOARD_VIEW.pointerTiltSensitivity *
            pointerInfluence)
      const targetTiltZ = reducedMotion
        ? 0
        : -pointerTilt.x *
          KEYBOARD_VIEW.pointerTiltSensitivity *
          pointerInfluence
      currentTilt.x = THREE.MathUtils.lerp(
        currentTilt.x,
        targetTiltX,
        response * 0.36
      )
      currentTilt.y = THREE.MathUtils.lerp(
        currentTilt.y,
        targetTiltZ,
        response * 0.36
      )
      runtime.root.rotation.x = currentTilt.x
      runtime.root.rotation.z = currentTilt.y
    }

    const updateCableOrigin = (presentationProgress: number): void => {
      if (presentationProgress <= 0.05) {
        return
      }

      camera.updateMatrixWorld()
      runtime.root.updateMatrixWorld(true)
      cableAnchorWorldPosition
        .set(
          KEYBOARD_USB_CABLE_ANCHOR.x,
          KEYBOARD_USB_CABLE_ANCHOR.y,
          KEYBOARD_USB_CABLE_ANCHOR.z
        )
        .applyMatrix4(runtime.root.matrixWorld)
      cableAnchorProjection.copy(cableAnchorWorldPosition).project(camera)

      const xRatio = (cableAnchorProjection.x + 1) / 2
      const yRatio = (1 - cableAnchorProjection.y) / 2
      const originHasMoved =
        !Number.isFinite(lastCableOrigin.x) ||
        Math.abs(lastCableOrigin.x - xRatio) > 0.0001 ||
        Math.abs(lastCableOrigin.y - yRatio) > 0.0001

      if (!originHasMoved) {
        return
      }

      lastCableOrigin.set(xRatio, yRatio)
      onCableOriginChangeRef.current({ xRatio, yRatio })
    }

    const renderFrame = (frameAt: number): void => {
      if (isDestroyed || !isVisible) {
        animationFrame = 0
        return
      }

      const delta = Math.min((frameAt - lastFrameAt) / 1000, 0.05)
      lastFrameAt = frameAt
      const reducedMotion = motionPreference.matches
      const response = reducedMotion ? 1 : 1 - Math.exp(-delta * 24)
      const presentationProgress = presentationProgressRef.current

      if (pressedSlot !== null && frameAt >= pressReleaseAt) {
        pressedSlot = null
      }

      updateKeyAnimations(response, activeSlotRef.current)
      updatePresentationCamera(presentationProgress)
      updateAssemblyTilt(response, reducedMotion, presentationProgress)
      updateCableOrigin(presentationProgress)
      renderer.render(scene, camera)

      if (!hasRecordedRenderStats) {
        canvas.dataset.drawCalls = String(renderer.info.render.calls)
        canvas.dataset.triangles = String(renderer.info.render.triangles)
        hasRecordedRenderStats = true
      }

      animationFrame = window.requestAnimationFrame(renderFrame)
    }

    const startRendering = (): void => {
      if (animationFrame || isDestroyed || !isVisible) {
        return
      }

      lastFrameAt = window.performance.now()
      animationFrame = window.requestAnimationFrame(renderFrame)
    }

    const stopRendering = (): void => {
      if (!animationFrame) {
        return
      }

      window.cancelAnimationFrame(animationFrame)
      animationFrame = 0
    }

    const handleVisibilityChange = (): void => {
      isVisible = document.visibilityState === 'visible'

      if (isVisible) {
        startRendering()
      } else {
        stopRendering()
      }
    }

    const handleContextLost = (event: Event): void => {
      event.preventDefault()
      stopRendering()
      setIsUnavailable(true)
    }

    const resizeCanvas = (): void => {
      updateCamera()
      renderer.render(scene, camera)
    }
    let resizeObserver: ResizeObserver | null = null
    const updateVisibility = ([entry]: IntersectionObserverEntry[]): void => {
      isVisible =
        Boolean(entry?.isIntersecting) && document.visibilityState === 'visible'

      if (isVisible) {
        startRendering()
      } else {
        stopRendering()
      }
    }
    let visibilityObserver: IntersectionObserver | null = null

    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerCancel)
    canvas.addEventListener('pointerleave', handlePointerLeave)
    canvas.addEventListener('webglcontextlost', handleContextLost)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(resizeCanvas)
      resizeObserver.observe(canvas)
    } else {
      window.addEventListener('resize', resizeCanvas)
    }
    if (typeof IntersectionObserver === 'function') {
      visibilityObserver = new IntersectionObserver(updateVisibility, {
        rootMargin: '160px',
        threshold: 0.01,
      })
      visibilityObserver.observe(canvas)
    }
    updateCamera()
    renderer.render(scene, camera)
    startRendering()

    return () => {
      isDestroyed = true
      stopRendering()
      setHoveredSlot(null)
      resizeObserver?.disconnect()
      if (typeof ResizeObserver !== 'function') {
        window.removeEventListener('resize', resizeCanvas)
      }
      visibilityObserver?.disconnect()
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerCancel)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      runtime.dispose()
      renderer.dispose()
    }
  }, [slots])

  if (isUnavailable) {
    return (
      <div aria-live="polite" role="status">
        当前浏览器无法显示 3D 键盘，技术列表仍可正常浏览。
      </div>
    )
  }

  return (
    <canvas
      aria-label="一把包含二十四个独立键帽的 3D 技术栈机械键盘；点击键帽可切换上方技术信息"
      ref={canvasRef}
      role="img"
    />
  )
}
