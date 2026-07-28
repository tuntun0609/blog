import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { TechnologySkill } from './technologies-config'

export type KeyboardVisualPass =
  | 'blockout'
  | 'structural-pass'
  | 'form-refinement'
  | 'material-pass'
  | 'surface-pass'
  | 'lighting-pass'
  | 'interaction-pass'
  | 'optimization-pass'

export const KEYCAP_TRAVEL = {
  hover: 0.065,
  press: 0.15,
} as const

export interface TechnologySlot {
  readonly skill: TechnologySkill | null
  readonly slotIndex: number
}

interface KeyboardKeyRuntime {
  readonly baseY: number
  readonly iconMaterial: THREE.MeshBasicMaterial | null
  readonly keyMaterial: THREE.MeshPhysicalMaterial
  readonly mesh: THREE.Mesh
  readonly pivot: THREE.Group
  travel: number
}

export interface TechnologiesKeyboardRuntime {
  readonly clickableMeshes: THREE.Mesh[]
  dispose: () => void
  readonly keys: KeyboardKeyRuntime[]
  readonly root: THREE.Group
}

interface CreateKeyboardOptions {
  readonly anisotropy: number
  readonly slots: readonly TechnologySlot[]
  readonly visualPass: KeyboardVisualPass
}

/** 宏键盘的网格规格：4 行 × 5 列，共 20 个键位。 */
const KEY_ROWS = 4
const KEY_COLUMNS = 6
/** 相邻键帽中心的间距；调小可收紧键帽间的视觉留白。 */
const KEY_PITCH = 1.3
/** 键帽阵列相对底座沿前后方向的统一偏移；负值向后，正值向前。 */
const KEYCAP_LAYOUT_OFFSET_Z = 0.23
/** 键帽在 X / Y / Z 轴上的基础尺寸。 */
const KEY_WIDTH = 1.28
const KEY_HEIGHT = 0.9
const KEY_DEPTH = 1.28
/** 键帽侧边与顶面外缘的圆润半径；增大更圆润，减小则更利落。 */
const KEYCAP_EDGE_RADIUS = 0.08
/** 键床向键帽阵列内收，避免从最外圈键帽底部露出。 */
const KEYBED_EDGE_INSET = 0.16
const KEYBED_WIDTH =
  (KEY_COLUMNS - 1) * KEY_PITCH + KEY_WIDTH - KEYBED_EDGE_INSET
const KEYBED_DEPTH = (KEY_ROWS - 1) * KEY_PITCH + KEY_DEPTH - KEYBED_EDGE_INSET
/** 完全按下时仍保留的安全间隙，避免键帽与键床或底盘相交。 */
const PRESSED_KEYCAP_CLEARANCE = 0.018
const KEYCAP_DECK_CLEARANCE = KEYCAP_TRAVEL.press + PRESSED_KEYCAP_CLEARANCE
/** 键帽顶面相对于底面的缩放比例，使侧面形成清晰的梯形收腰。 */
const KEYCAP_TOP_SURFACE_SCALE = 0.75
/** 顶面中心内凹深度，模拟真实键帽承托指腹的浅弧。 */
const KEYCAP_TOP_CONCAVITY = 0.1
/** 顶面网格细分数；需要中心顶点才能表现内凹。 */
const KEYCAP_TOP_SURFACE_SEGMENTS = 12
/** 键盘外壳的总高度。 */
const CHASSIS_HEIGHT = 0.8
/** 内凹键床顶面高度，略高于外壳顶面以避免深度冲突。 */
const KEYBED_SURFACE_Y = CHASSIS_HEIGHT / 2 + 0.006
/** 键帽底部的静止高度，为完整按压行程预留空间。 */
const KEY_BASE_Y = KEYBED_SURFACE_Y + KEYCAP_DECK_CLEARANCE
/** 绘制技术图标时使用的离屏画布分辨率。 */
const ICON_TEXTURE_SIZE = 256
/** 结构检视阶段统一使用的中性色。 */
const BLOCKOUT_COLOR = '#A9AAAC'
/** 未配置技术栈的空键位使用的默认键帽颜色。 */
const NEUTRAL_KEY_COLOR = '#E4E1DB'
/** 统一压低键帽亮度，避免强光下品牌色显得过浅。 */
const KEYCAP_COLOR_SCALE = 0.7
const MATTE_CLEARCOAT = 0
const MATTE_CLEARCOAT_ROUGHNESS = 0.92
/** 外壳保留哑光基底，并以较集中的透明涂层勾出倒角边缘。 */
const MATTE_CHASSIS_CLEARCOAT = 0.16
const MATTE_CHASSIS_CLEARCOAT_ROUGHNESS = 0.38
const MATTE_CHASSIS_ROUGHNESS = 0.58
const MATTE_KEYBED_ROUGHNESS = 0.76
const MATTE_KEYCAP_ROUGHNESS = 0.82

const isAtLeastPass = (
  currentPass: KeyboardVisualPass,
  targetPass: KeyboardVisualPass
): boolean => {
  const passes: readonly KeyboardVisualPass[] = [
    'blockout',
    'structural-pass',
    'form-refinement',
    'material-pass',
    'surface-pass',
    'lighting-pass',
    'interaction-pass',
    'optimization-pass',
  ]

  return passes.indexOf(currentPass) >= passes.indexOf(targetPass)
}

const getSwitchStemColor = (visualPass: KeyboardVisualPass): string =>
  visualPass === 'blockout' ? '#7E8083' : '#0B0C0E'

const getKeycapColor = (color: string): string =>
  `#${new THREE.Color(color).multiplyScalar(KEYCAP_COLOR_SCALE).getHexString()}`

const createNoiseTexture = (
  kind: 'normal' | 'roughness'
): THREE.DataTexture => {
  const size = 128
  const data = new Uint8Array(size * size * 4)
  let seed = kind === 'normal' ? 17 : 31

  const random = (): number => {
    seed = (seed * 16_807) % 2_147_483_647
    return (seed - 1) / 2_147_483_646
  }

  for (let index = 0; index < size * size; index += 1) {
    const offset = index * 4

    if (kind === 'normal') {
      data[offset] = 126 + Math.round(random() * 4)
      data[offset + 1] = 126 + Math.round(random() * 4)
      data[offset + 2] = 254
    } else {
      const value = 218 + Math.round(random() * 20)
      data[offset] = value
      data[offset + 1] = value
      data[offset + 2] = value
    }

    data[offset + 3] = 255
  }

  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  )
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 3)
  texture.needsUpdate = true
  return texture
}

const createTaperedKeycapGeometry = (): THREE.BufferGeometry => {
  const geometry = new RoundedBoxGeometry(
    KEY_WIDTH,
    KEY_HEIGHT,
    KEY_DEPTH,
    5,
    KEYCAP_EDGE_RADIUS
  )
  const positions = geometry.getAttribute('position')

  for (let index = 0; index < positions.count; index += 1) {
    const normalizedY = THREE.MathUtils.clamp(
      positions.getY(index) / KEY_HEIGHT + 0.5,
      0,
      1
    )
    const taper = THREE.MathUtils.lerp(1, KEYCAP_TOP_SURFACE_SCALE, normalizedY)
    const x = positions.getX(index)
    const z = positions.getZ(index)
    positions.setX(index, x * taper)
    positions.setZ(index, z * taper)
  }

  positions.needsUpdate = true
  const retainedIndices: number[] = []

  for (let index = 0; index < positions.count; index += 3) {
    const isFlatTopFace = [0, 1, 2].every(
      (vertexOffset) =>
        positions.getY(index + vertexOffset) > KEY_HEIGHT / 2 - 0.0001
    )

    if (!isFlatTopFace) {
      retainedIndices.push(index, index + 1, index + 2)
    }
  }

  geometry.setIndex(retainedIndices)

  const topSurfaceWidth =
    (KEY_WIDTH - KEYCAP_EDGE_RADIUS * 2) * KEYCAP_TOP_SURFACE_SCALE
  const topSurfaceDepth =
    (KEY_DEPTH - KEYCAP_EDGE_RADIUS * 2) * KEYCAP_TOP_SURFACE_SCALE
  const topSurface = new THREE.PlaneGeometry(
    topSurfaceWidth,
    topSurfaceDepth,
    KEYCAP_TOP_SURFACE_SEGMENTS,
    KEYCAP_TOP_SURFACE_SEGMENTS
  )

  topSurface.rotateX(-Math.PI / 2)

  const topSurfacePositions = topSurface.getAttribute('position')

  for (let index = 0; index < topSurfacePositions.count; index += 1) {
    const x = topSurfacePositions.getX(index)
    const z = topSurfacePositions.getZ(index)
    const normalizedRadius = Math.min(
      1,
      Math.hypot(x / (topSurfaceWidth / 2), z / (topSurfaceDepth / 2))
    )
    const concavity = (1 - normalizedRadius ** 2) * KEYCAP_TOP_CONCAVITY

    topSurfacePositions.setY(index, KEY_HEIGHT / 2 - concavity)
  }

  topSurfacePositions.needsUpdate = true
  topSurface.computeVertexNormals()

  const mergedGeometry = mergeGeometries([geometry, topSurface])

  mergedGeometry.computeVertexNormals()
  mergedGeometry.name = 'tall-tapered-concave-keycap-geometry'
  return mergedGeometry
}

const createRoundedRectangleShape = (
  width: number,
  depth: number,
  cornerRadius: number
): THREE.Shape => {
  const halfWidth = width / 2
  const halfDepth = depth / 2
  const radius = Math.min(cornerRadius, halfWidth, halfDepth)
  const shape = new THREE.Shape()

  shape.moveTo(-halfWidth + radius, -halfDepth)
  shape.lineTo(halfWidth - radius, -halfDepth)
  shape.quadraticCurveTo(halfWidth, -halfDepth, halfWidth, -halfDepth + radius)
  shape.lineTo(halfWidth, halfDepth - radius)
  shape.quadraticCurveTo(halfWidth, halfDepth, halfWidth - radius, halfDepth)
  shape.lineTo(-halfWidth + radius, halfDepth)
  shape.quadraticCurveTo(-halfWidth, halfDepth, -halfWidth, halfDepth - radius)
  shape.lineTo(-halfWidth, -halfDepth + radius)
  shape.quadraticCurveTo(
    -halfWidth,
    -halfDepth,
    -halfWidth + radius,
    -halfDepth
  )
  shape.closePath()
  return shape
}

const createBeveledSlabGeometry = ({
  bevel,
  cornerRadius,
  depth,
  height,
  width,
}: {
  bevel: number
  cornerRadius: number
  depth: number
  height: number
  width: number
}): THREE.ExtrudeGeometry => {
  const shape = createRoundedRectangleShape(
    width - bevel * 2,
    depth - bevel * 2,
    Math.max(0.01, cornerRadius - bevel)
  )
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 8,
    depth: height - bevel * 2,
    steps: 1,
  })

  geometry.rotateX(Math.PI / 2)
  geometry.center()
  geometry.computeVertexNormals()
  return geometry
}

const createKeybedGeometry = (): THREE.ShapeGeometry => {
  const geometry = new THREE.ShapeGeometry(
    createRoundedRectangleShape(KEYBED_WIDTH, KEYBED_DEPTH, 0.28),
    8
  )

  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  geometry.name = 'flush-keybed-surface-geometry'
  return geometry
}

const createIconTexture = (
  skill: TechnologySkill,
  anisotropy: number
): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas')
  canvas.width = ICON_TEXTURE_SIZE
  canvas.height = ICON_TEXTURE_SIZE
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error(`无法为 ${skill.name} 创建图标画布`)
  }

  const padding = 42
  const iconScale = (ICON_TEXTURE_SIZE - padding * 2) / 24
  const iconPath = new Path2D(skill.iconPath)

  context.translate(padding, padding)
  context.scale(iconScale, iconScale)
  context.fillStyle = skill.iconColor
  context.fill(iconPath)

  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = anisotropy
  texture.colorSpace = THREE.SRGBColorSpace
  texture.name = `technology-icon-${skill.id}`
  texture.needsUpdate = true
  return texture
}

const createPlasticMaterial = ({
  clearcoat = MATTE_CLEARCOAT,
  clearcoatRoughness = MATTE_CLEARCOAT_ROUGHNESS,
  color,
  name,
  normalMap,
  roughness,
  roughnessMap,
}: {
  clearcoat?: number
  clearcoatRoughness?: number
  color: string
  name: string
  normalMap: THREE.Texture | null
  roughness: number
  roughnessMap: THREE.Texture | null
}): THREE.MeshPhysicalMaterial => {
  const material = new THREE.MeshPhysicalMaterial({
    clearcoat,
    clearcoatRoughness,
    color,
    metalness: 0,
    name,
    normalMap,
    roughness,
    roughnessMap,
  })

  if (normalMap) {
    material.normalScale.set(0.16, 0.16)
  }

  return material
}

const createIconMesh = (
  skill: TechnologySkill,
  anisotropy: number,
  keyIndex: number
): {
  material: THREE.MeshBasicMaterial
  mesh: THREE.Mesh
} => {
  const texture = createIconTexture(skill, anisotropy)
  const material = new THREE.MeshBasicMaterial({
    alphaTest: 0.08,
    depthWrite: false,
    map: texture,
    name: `icon-material-${skill.id}`,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: THREE.DoubleSide,
    transparent: true,
  })
  const geometry = new THREE.PlaneGeometry(0.69, 0.69)
  const mesh = new THREE.Mesh(geometry, material)

  mesh.name = `icon-slot-${keyIndex}`
  mesh.position.y = KEY_HEIGHT / 2 + 0.012
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 2
  mesh.userData.explodeWithParent = true
  return { material, mesh }
}

export const createTechnologiesKeyboard = ({
  anisotropy,
  slots,
  visualPass,
}: CreateKeyboardOptions): TechnologiesKeyboardRuntime => {
  const root = new THREE.Group()
  const clickableMeshes: THREE.Mesh[] = []
  const keys: KeyboardKeyRuntime[] = []
  const materialTextures: THREE.Texture[] = []
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const hasMaterials = isAtLeastPass(visualPass, 'material-pass')
  const hasSurface = isAtLeastPass(visualPass, 'material-pass')
  const hasRefinedForm = isAtLeastPass(visualPass, 'form-refinement')
  const normalMap = hasSurface ? createNoiseTexture('normal') : null
  const roughnessMap = hasSurface ? createNoiseTexture('roughness') : null
  const chassisGeometry = createBeveledSlabGeometry({
    bevel: 0.11,
    cornerRadius: 0.38,
    depth: 6.4, // 前后长度（Z 轴）
    height: CHASSIS_HEIGHT, // 高度（Y 轴）
    width: 8.5, // 左右宽度（X 轴）
  })
  const keybedGeometry = createKeybedGeometry()
  const switchStemGeometry = new THREE.BoxGeometry(0.42, 0.16, 0.42)
  const keycapGeometry = hasRefinedForm
    ? createTaperedKeycapGeometry()
    : new RoundedBoxGeometry(KEY_WIDTH, KEY_HEIGHT, KEY_DEPTH, 3, 0.1)

  root.name = 'technologies-keyboard-root'
  root.userData.sculptRuntime = {
    actionReady: true,
    pass: visualPass,
    reference: 'technologies-keyboard-approved.png',
  }

  if (normalMap) {
    materialTextures.push(normalMap)
  }

  if (roughnessMap) {
    materialTextures.push(roughnessMap)
  }

  geometries.push(
    chassisGeometry,
    keybedGeometry,
    keycapGeometry,
    switchStemGeometry
  )

  const chassisMaterial = createPlasticMaterial({
    clearcoat: MATTE_CHASSIS_CLEARCOAT,
    clearcoatRoughness: MATTE_CHASSIS_CLEARCOAT_ROUGHNESS,
    color: visualPass === 'blockout' ? BLOCKOUT_COLOR : '#111214',
    name: 'black-chassis-plastic',
    normalMap,
    roughness: MATTE_CHASSIS_ROUGHNESS,
    roughnessMap,
  })
  const keybedMaterial = createPlasticMaterial({
    color: visualPass === 'blockout' ? '#929395' : '#17191B',
    name: 'recessed-keybed-plastic',
    normalMap,
    roughness: MATTE_KEYBED_ROUGHNESS,
    roughnessMap,
  })
  const switchStemMaterial = createPlasticMaterial({
    color: getSwitchStemColor(visualPass),
    name: 'switch-stem-plastic',
    normalMap,
    roughness: MATTE_KEYBED_ROUGHNESS,
    roughnessMap,
  })
  const switchStems = new THREE.InstancedMesh(
    switchStemGeometry,
    switchStemMaterial,
    slots.length
  )
  const switchStemMatrix = new THREE.Matrix4()
  materials.push(chassisMaterial, keybedMaterial, switchStemMaterial)

  const chassis = new THREE.Mesh(chassisGeometry, chassisMaterial)
  chassis.castShadow = true
  chassis.name = 'chassis-shell'
  chassis.receiveShadow = true
  chassis.userData.collider = { type: 'box' }
  root.add(chassis)

  const keybed = new THREE.Mesh(keybedGeometry, keybedMaterial)
  keybed.name = 'keybed-recess'
  keybed.position.y = KEYBED_SURFACE_Y
  keybed.receiveShadow = true
  root.add(keybed)

  switchStems.castShadow = true
  switchStems.name = 'switch-stems'
  switchStems.receiveShadow = true
  root.add(switchStems)

  for (const slot of slots) {
    const row = Math.floor(slot.slotIndex / KEY_COLUMNS)
    const column = slot.slotIndex % KEY_COLUMNS
    const x = (column - (KEY_COLUMNS - 1) / 2) * KEY_PITCH
    const z = (row - (KEY_ROWS - 1) / 2) * KEY_PITCH + KEYCAP_LAYOUT_OFFSET_Z
    const keyColor =
      hasMaterials && slot.skill ? slot.skill.keyColor : NEUTRAL_KEY_COLOR
    const keyMaterial = createPlasticMaterial({
      color:
        visualPass === 'blockout' ? BLOCKOUT_COLOR : getKeycapColor(keyColor),
      name: `keycap-material-${slot.slotIndex}`,
      normalMap,
      roughness: MATTE_KEYCAP_ROUGHNESS,
      roughnessMap,
    })
    keyMaterial.clearcoat = 0
    const pivot = new THREE.Group()
    const mesh = new THREE.Mesh(keycapGeometry, keyMaterial)

    switchStemMatrix.makeTranslation(x, KEYBED_SURFACE_Y + 0.08, z)
    switchStems.setMatrixAt(slot.slotIndex, switchStemMatrix)
    pivot.name = `keycap-r${row}c${column}-pivot`
    pivot.position.set(x, KEY_BASE_Y + KEY_HEIGHT / 2, z)
    pivot.userData.animationRole = 'pressable-key'
    pivot.userData.collider = { trigger: true, type: 'box' }
    mesh.castShadow = true
    mesh.name = `keycap-r${row}c${column}-mesh`
    mesh.receiveShadow = true
    mesh.userData.keyIndex = slot.slotIndex
    mesh.userData.skillId = slot.skill?.id ?? null
    pivot.add(mesh)
    root.add(pivot)
    materials.push(keyMaterial)
    clickableMeshes.push(mesh)

    let iconMaterial: THREE.MeshBasicMaterial | null = null

    if (hasMaterials && slot.skill) {
      const icon = createIconMesh(slot.skill, anisotropy, slot.slotIndex)
      iconMaterial = icon.material
      pivot.add(icon.mesh)
      geometries.push(icon.mesh.geometry)
      materials.push(icon.material)

      if (icon.material.map) {
        materialTextures.push(icon.material.map)
      }
    }

    keys.push({
      baseY: pivot.position.y,
      iconMaterial,
      keyMaterial,
      mesh,
      pivot,
      travel: 0,
    })
  }

  switchStems.instanceMatrix.needsUpdate = true

  const dispose = (): void => {
    for (const geometry of new Set(geometries)) {
      geometry.dispose()
    }

    for (const material of new Set(materials)) {
      material.dispose()
    }

    for (const texture of new Set(materialTextures)) {
      texture.dispose()
    }
  }

  return {
    clickableMeshes,
    dispose,
    keys,
    root,
  }
}
