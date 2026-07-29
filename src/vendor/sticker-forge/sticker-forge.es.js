import * as g from "three";
var EA = `
  uniform float uPeel;
  uniform float uPeelDepth;
  uniform float uDetachedTension;
  uniform float uRadius;
  uniform float uMaxAngle;
  uniform float uWind;
  uniform float uTime;
  uniform vec2 uOrigin;
  uniform vec2 uPeelDir;
  uniform vec2 uMeshSize;
  uniform float uEntranceScaleProgress;
  uniform float uPreEntranceProgress;
  uniform vec2 uEntranceAxis;

  vec3 scaleEntranceSlice(vec3 base) {
    if (uEntranceScaleProgress < 0.0) return base;

    float entranceCoordinate = abs(uEntranceAxis.x) > 0.5
      ? (uEntranceAxis.x > 0.0
          ? base.x / uMeshSize.x + 0.5
          : 0.5 - base.x / uMeshSize.x)
      : (uEntranceAxis.y < 0.0
          ? 0.5 - base.y / uMeshSize.y
          : base.y / uMeshSize.y + 0.5);
    float sliceProgress = clamp(
      uEntranceScaleProgress * 1.42 - entranceCoordinate * 0.42,
      0.0,
      1.0
    );
    float springResponse = 1.0
      - exp(-3.8 * sliceProgress) * cos(9.0 * sliceProgress);
    float sliceScale = mix(0.6, 1.0, springResponse);
    base.xy *= sliceScale;
    return base;
  }

  vec3 deformSticker(vec3 base) {
    float preEntrance = smoothstep(
      0.0,
      1.0,
      clamp(uPreEntranceProgress, 0.0, 1.0)
    );
    base.xy *= mix(1.0, 0.6, preEntrance);
    base = scaleEntranceSlice(base);
    if (uPeelDepth <= 0.00001 || uPeel <= 0.0) return base;

    vec2 direction = normalize(uPeelDir + vec2(0.00001));
    vec2 tangent = vec2(-direction.y, direction.x);
    vec2 relative = base.xy - uOrigin;
    float side = dot(relative, tangent);
    float along = dot(relative, direction);
    float front = uPeelDepth;
    float arcDistance = front - along;
    if (arcDistance <= 0.0) return base;

    float radius = max(uRadius, 0.001);
    float maxAngle = clamp(uMaxAngle, 2.55, 3.14159265);
    float arcLength = radius * maxAngle;
    float angle = min(arcDistance / radius, maxAngle);
    float projected = -radius * sin(angle);
    float elevation = radius * (1.0 - cos(angle));

    if (arcDistance > arcLength) {
      float freeLength = arcDistance - arcLength;
      projected += -freeLength * cos(maxAngle);
      elevation += freeLength * sin(maxAngle);
    }

    vec3 curved = base;
    vec2 crease = base.xy + direction * (front - along);
    curved.xy = crease + direction * projected;
    curved.z = elevation;

    float normalizedPeel = clamp(arcDistance / max(front, 0.001), 0.0, 1.0);
    float flutterEnvelope = sin(normalizedPeel * 3.14159265);
    float windWave =
      sin(uTime * 3.1 + side * 4.6 + arcDistance * 2.2) * 0.72 +
      sin(uTime * 7.4 - side * 6.8 + arcDistance * 4.1) * 0.28;
    float windDisplacement = windWave * uWind * flutterEnvelope;
    curved.z += windDisplacement * 0.032;
    curved.xy += tangent * windDisplacement * 0.04;
    curved.xy += direction * windDisplacement * 0.01;
    // Pulling a detached sheet taut unfolds the curl without turning the
    // sticker back over. Reflecting it across the peel front keeps the back
    // face toward the viewer when the sheet becomes flat.
    vec3 tautBack = base;
    tautBack.xy += direction * (2.0 * arcDistance);
    curved = mix(curved, tautBack, clamp(uDetachedTension, 0.0, 1.0));
    return curved;
  }

  vec3 stickerSurfaceNormal(vec3 base) {
    if (uPeelDepth <= 0.00001 || uPeel <= 0.0) {
      return vec3(0.0, 0.0, 1.0);
    }

    vec2 direction = normalize(uPeelDir + vec2(0.00001));
    float along = dot(base.xy - uOrigin, direction);
    float arcDistance = uPeelDepth - along;
    if (arcDistance <= 0.0) return vec3(0.0, 0.0, 1.0);

    float radius = max(uRadius, 0.001);
    float maxAngle = clamp(uMaxAngle, 2.55, 3.14159265);
    float angle = min(arcDistance / radius, maxAngle);
    vec3 curledNormal = normalize(vec3(direction * sin(angle), cos(angle)));
    return normalize(mix(
      curledNormal,
      vec3(0.0, 0.0, -1.0),
      clamp(uDetachedTension, 0.0, 1.0)
    ));
  }
`, Ae = `
  ${EA}
  #include <common>
  #include <shadowmap_pars_vertex>

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying float vLift;
  varying float vCurl;
  varying float vAdhered;
  varying float vShadowReceiverProximity;

  void main() {
    vUv = uv;
    vec3 deformed = deformSticker(position);
    vec3 localNormal = stickerSurfaceNormal(position);

    vec2 direction = normalize(uPeelDir + vec2(0.00001));
    vec2 relative = position.xy - uOrigin;
    float along = dot(relative, direction);
    float front = uPeelDepth;
    float arcDistance = max(front - along, 0.0);
    float peelMask =
      step(along, front) * step(0.00001, uPeelDepth);
    float effectiveRadius = max(uRadius, 0.001);
    float normalizedArc = arcDistance / effectiveRadius;
    float receiverFeather = max(min(uMeshSize.x, uMeshSize.y) * 0.006, 0.004);
    float activePeel = step(0.00001, uPeelDepth);
    float receiverDistance = max(along - front, 0.0);
    float receiverShadowReach = max(effectiveRadius * 1.6, receiverFeather * 3.0);

    vLift = max(deformed.z, 0.0);
    vCurl = peelMask
      * sin(clamp(normalizedArc, 0.0, 3.14159265))
      * (1.0 - clamp(uDetachedTension, 0.0, 1.0));
    vAdhered = mix(
      1.0,
      smoothstep(front - receiverFeather, front + receiverFeather, along),
      activePeel
    );
    vShadowReceiverProximity =
      activePeel
      * (1.0 - smoothstep(
        receiverFeather,
        receiverShadowReach,
        receiverDistance
      ));

    vec4 viewPosition = modelViewMatrix * vec4(deformed, 1.0);
    vViewPosition = viewPosition.xyz;
    vNormalView = normalize(normalMatrix * localNormal);
    vec3 transformedNormal = vNormalView;
    vec4 worldPosition = modelMatrix * vec4(deformed, 1.0);
    #include <shadowmap_vertex>
    gl_Position = projectionMatrix * viewPosition;
  }
`, ot = `
  ${EA}

  uniform vec2 uShadowDirection;
  uniform float uShadowDistance;
  uniform float uShadowLiftScale;

  varying vec2 vShadowUv;

  void main() {
    vShadowUv = uv;
    vec3 deformed = deformSticker(position);
    vec4 worldPosition = modelMatrix * vec4(deformed, 1.0);
    float projectionDistance =
      uShadowDistance + max(deformed.z, 0.0) * uShadowLiftScale;
    worldPosition.xy += normalize(uShadowDirection) * projectionDistance;
    worldPosition.z = -0.004;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`, ee = `
  uniform sampler2D uMap;
  uniform sampler2D uPreparedMap;
  uniform float uPreparedMix;
  uniform vec2 uTexel;
  uniform float uEdgeFinishScale;
  uniform float uEdgeBevelWidth;
  uniform float uEdgeFinishStrength;
  uniform vec3 uBackColor;
  uniform float uGloss;
  uniform float uRoughness;
  uniform vec3 uLightDirection;
  uniform float uLightIntensity;
  uniform float uAmbientLight;
  uniform float uLightSoftness;
  uniform float uMaterialType;
  uniform float uMaterialIntensity;
  uniform float uMaterialScale;
  uniform float uHolographicGrain;
  uniform float uMaterialSeed;
  uniform float uMaterialBaked;
  uniform vec3 uHolographicColorA;
  uniform vec3 uHolographicColorB;
  uniform vec3 uHolographicColorC;
  uniform vec3 uShadowColor;
  uniform float uShadowOpacity;
  uniform float uSurfaceShadowEnabled;
  uniform float uEntranceSweep;
  uniform vec2 uEntranceAxis;
  uniform float uLaserCoreWidth;
  uniform float uLaserBandWidth;
  uniform float uLaserBandOpacity;
  uniform float uLaserBrightness;
  uniform float uLaserHighlightIntensity;
  uniform float uBackgroundRemovalDistortion;
  uniform float uRemovalDistortionRange;
  uniform float uRemovalDistortionStrength;
  uniform float uRemovalRippleDensity;
  uniform float uRemovalRippleSpeed;
  uniform float uInteractionHint;
  uniform float uInteractionHintRadius;
  uniform vec3 uInteractionHintColor;
  uniform float uTime;
  uniform float uPeel;
  uniform float uPreserveFrontColor;
  uniform float uOpacity;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying float vLift;
  varying float vCurl;
  varying float vAdhered;
  varying float vShadowReceiverProximity;

  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  vec4 artworkSample(vec2 uv) {
    vec2 safeUv = clamp(uv, vec2(0.0), vec2(1.0));
    vec4 artwork = texture2D(uMap, safeUv);
    if (uPreparedMix > 0.0) {
      artwork = mix(
        artwork,
        texture2D(uPreparedMap, safeUv),
        uPreparedMix
      );
    }
    return artwork;
  }

  vec3 spectralPalette(float phase) {
    return 0.55 + 0.45 * cos(
      6.2831853 * (phase + vec3(0.0, 0.333333, 0.666667))
    );
  }

  vec3 screenBlend(vec3 base, vec3 layer) {
    return 1.0 - (1.0 - base) * (1.0 - layer);
  }

  vec3 holographicPalette(float phase) {
    float position = fract(phase);
    if (position < 0.333333) {
      return mix(
        uHolographicColorA,
        uHolographicColorB,
        position * 3.0
      );
    }
    if (position < 0.666667) {
      return mix(
        uHolographicColorB,
        uHolographicColorC,
        (position - 0.333333) * 3.0
      );
    }
    return mix(
      uHolographicColorC,
      uHolographicColorA,
      (position - 0.666667) * 3.0
    );
  }

  float previewGradientPhase() {
    float aspect = uTexel.y / max(uTexel.x, 0.000001);
    float aspectSquared = aspect * aspect;
    float horizontalWeight = aspectSquared / (aspectSquared + 1.0);
    return vUv.x * horizontalWeight
      + vUv.y * (1.0 - horizontalWeight);
  }

  float previewReflectiveOpacity(float phase) {
    float position = fract(phase);
    if (position < 0.25 || position > 0.78) return 0.0;
    if (position < 0.46) {
      return mix(0.0, 0.7, (position - 0.25) / 0.21);
    }
    if (position < 0.58) {
      return mix(0.7, 0.14, (position - 0.46) / 0.12);
    }
    return mix(0.14, 0.0, (position - 0.58) / 0.2);
  }

  vec3 applyFrontMaterial(
    vec3 base,
    vec3 normal,
    vec3 viewDirection,
    vec3 lightDirection,
    vec3 halfDirection,
    float finishActivation,
    float deformation
  ) {
    float kind = floor(uMaterialType + 0.5);
    // The default path is deliberately a no-op so it is pixel-identical to
    // Sticker Forge's front material before selectable finishes were added.
    if (kind < 0.5) return base;

    float amount =
      clamp(uMaterialIntensity, 0.0, 1.0)
      * clamp(finishActivation, 0.0, 1.0);
    float scale = max(uMaterialScale, 0.2);
    vec2 detailUv = vUv * scale;
    float facing = max(dot(normal, viewDirection), 0.0);
    float directLight = max(dot(normal, lightDirection), 0.0);
    float materialLight = clamp(
      uAmbientLight + directLight * uLightIntensity,
      0.0,
      1.65
    );
    float ndh = max(dot(normal, halfDirection), 0.0);
    float edge = pow(1.0 - facing, 3.0);
    float grain = hash21(detailUv * 913.7 + uMaterialSeed * 71.3) - 0.5;
    float fineGrain = hash21(detailUv * 2471.0 + uMaterialSeed * 131.0);
    float sharpSpec = pow(ndh, 72.0);

    // Diffractive holographic film.
    if (kind < 1.5) {
      // Keep the diffraction bands anchored to the undeformed sticker.
      // Match the gallery thumbnail's single, soft diagonal color wash. Light
      // and view changes move that wash without replacing the printed artwork.
      vec3 defaultLightDirection = normalize(vec3(-0.38, 0.52, 0.76));
      float holographicLightShift =
        dot(
          lightDirection.xy - defaultLightDirection.xy,
          vec2(0.32, -0.26)
        );
      float holographicViewShift =
        (1.0 - facing) * 0.12
        + vCurl * 0.08;
      float phase =
        (previewGradientPhase() - 0.5) * scale + 0.5
        + holographicLightShift
        + holographicViewShift;
      vec3 rainbow = holographicPalette(phase);
      float broadSpec = pow(ndh, 12.0);
      float lightStrength = clamp(
        1.0 + (uLightIntensity - 0.8) * 0.35,
        0.6,
        1.3
      );
      float holographicMix =
        0.24
        * amount
        * lightStrength;
      vec3 holographicBase = mix(
        base,
        rainbow,
        holographicMix
      );
      float frostGrain =
        hash21(detailUv * 1380.0 + uMaterialSeed * 113.0) - 0.5;
      float frostAmount =
        clamp(uHolographicGrain, 0.0, 1.0) * amount;
      holographicBase *= 1.0 + frostGrain * 0.22 * frostAmount;
      holographicBase = mix(
        holographicBase,
        vec3(0.92 + frostGrain * 0.16),
        abs(frostGrain) * 0.1 * frostAmount
      );
      float holographicHighlight =
        broadSpec * 0.1
        + sharpSpec * 0.16
        + vCurl * 0.035;
      holographicHighlight *= smoothstep(0.0, 0.18, deformation);
      return screenBlend(
        holographicBase,
        rainbow
          * holographicHighlight
          * amount
          * uLightIntensity
      );
    }

    // Glitter laminate.
    if (kind < 2.5) {
      vec2 cell = floor(detailUv * 115.0);
      float flake = hash21(cell + uMaterialSeed * 97.0);
      float orientation = hash21(cell.yx + uMaterialSeed * 43.0);
      float twinkle = pow(
        max(0.0, cos((orientation - dot(normal.xy, vec2(0.47, 0.83))) * 6.2831853)),
        18.0
      );
      float sparkle = smoothstep(0.91, 0.995, flake) * twinkle;
      vec3 sparkleColor = mix(vec3(1.0), spectralPalette(flake), 0.46);
      return base * (1.0 + grain * 0.04 * amount)
        + sparkleColor * sparkle * amount * 1.35
        + sharpSpec * 0.08 * amount;
    }

    // Retroreflective film.
    float retroAlignment = max(dot(lightDirection, viewDirection), 0.0);
    float retroCone = pow(
      retroAlignment,
      mix(10.0, 3.0, clamp(uLightSoftness, 0.0, 1.0))
    );
    vec3 defaultLightDirection = normalize(vec3(-0.38, 0.52, 0.76));
    float reflectivePhase =
      (previewGradientPhase() - 0.5) * scale + 0.5
      + dot(
        lightDirection.xy - defaultLightDirection.xy,
        vec2(0.28, -0.22)
      );
    float reflectivePreview = previewReflectiveOpacity(
      reflectivePhase
    );
    float lightStrength = clamp(
      1.0 + (uLightIntensity - 0.8) * 0.5,
      0.5,
      1.4
    );
    float retro = reflectivePreview * lightStrength
      + retroCone
        * mix(0.42, 1.0, directLight)
        * smoothstep(0.0, 0.18, deformation)
        * 0.18;
    float beads = 0.78 + fineGrain * 0.28;
    float reflectiveLift = retro * beads * amount;
    return mix(base, vec3(1.0), clamp(reflectiveLift, 0.0, 0.78))
      + edge * 0.025 * amount * materialLight;
  }

  float interactionHitArea(vec2 uv, float centerAlpha, float radius) {
    vec2 hitOffset = uTexel * radius;
    vec2 diagonalOffset = hitOffset * 0.70710678;
    float sampledAlpha = min(
      min(
        min(
          texture2D(uMap, uv + vec2(hitOffset.x, 0.0)).a,
          texture2D(uMap, uv - vec2(hitOffset.x, 0.0)).a
        ),
        min(
          texture2D(uMap, uv + vec2(0.0, hitOffset.y)).a,
          texture2D(uMap, uv - vec2(0.0, hitOffset.y)).a
        )
      ),
      min(
        min(
          texture2D(uMap, uv + diagonalOffset).a,
          texture2D(uMap, uv - diagonalOffset).a
        ),
        min(
          texture2D(
            uMap,
            uv + vec2(diagonalOffset.x, -diagonalOffset.y)
          ).a,
          texture2D(
            uMap,
            uv + vec2(-diagonalOffset.x, diagonalOffset.y)
          ).a
        )
      )
    );
    return smoothstep(0.04, 0.28, centerAlpha)
      * (1.0 - smoothstep(0.08, 0.72, sampledAlpha));
  }

  void main() {
    vec2 surfaceUv = vUv;
    if (uBackgroundRemovalDistortion > 0.5 && uEntranceSweep >= 0.0) {
      vec2 scanDirection = abs(uEntranceAxis.x) > 0.5
        ? vec2(sign(uEntranceAxis.x), 0.0)
        : vec2(0.0, sign(uEntranceAxis.y));
      vec2 scanTangent = vec2(-scanDirection.y, scanDirection.x);
      float scanCoordinate = abs(uEntranceAxis.x) > 0.5
        ? (uEntranceAxis.x > 0.0 ? vUv.x : 1.0 - vUv.x)
        : (uEntranceAxis.y < 0.0 ? 1.0 - vUv.y : vUv.y);
      float tangentCoordinate = dot(vUv - vec2(0.5), scanTangent);
      float sweepCenter = mix(-0.3, 1.3, uEntranceSweep);
      float sweepDelta = scanCoordinate - sweepCenter;
      float distortionEnvelope =
        1.0 - smoothstep(
          uRemovalDistortionRange * 0.15,
          uRemovalDistortionRange,
          abs(sweepDelta)
        );
      float ripplePhase =
        tangentCoordinate * uRemovalRippleDensity;
      float rippleAcross = sweepDelta * uRemovalRippleDensity;
      float waterWaveA = sin(
        ripplePhase * 0.55
        + rippleAcross * 0.8
        + uTime * uRemovalRippleSpeed
      );
      float waterWaveB = sin(
        ripplePhase * 0.31
        - rippleAcross * 0.45
        - uTime * uRemovalRippleSpeed * 0.63
        + 1.7
      );
      float waterWaveC = sin(
        ripplePhase * 0.18
        + uTime * uRemovalRippleSpeed * 0.37
        + 3.1
      );
      float waterRipple =
        (waterWaveA * 0.58 + waterWaveB * 0.3 + waterWaveC * 0.12)
        * 0.0045
        * distortionEnvelope
        * uRemovalDistortionStrength;
      surfaceUv += scanTangent * waterRipple;
      surfaceUv +=
        scanDirection
        * (
          cos(ripplePhase * 0.42 + uTime * uRemovalRippleSpeed * 0.48)
          * 0.65
          + sin(ripplePhase * 0.23 - uTime * uRemovalRippleSpeed * 0.31)
          * 0.35
        )
        * distortionEnvelope
        * uRemovalDistortionStrength
        * 0.0016;
      surfaceUv = clamp(surfaceUv, vec2(0.001), vec2(0.999));
    }

    vec4 printSample = artworkSample(surfaceUv);
    float finishScale = clamp(uEdgeFinishScale, 0.75, 8.0);
    vec2 bevelOffset = uTexel * clamp(
      uEdgeBevelWidth * finishScale,
      0.5,
      24.0
    );
    float alphaLeft = artworkSample(
      surfaceUv - vec2(bevelOffset.x, 0.0)
    ).a;
    float alphaRight = artworkSample(
      surfaceUv + vec2(bevelOffset.x, 0.0)
    ).a;
    float alphaUp = artworkSample(
      surfaceUv + vec2(0.0, bevelOffset.y)
    ).a;
    float alphaDown = artworkSample(
      surfaceUv - vec2(0.0, bevelOffset.y)
    ).a;
    float innerAlpha = min(
      min(alphaLeft, alphaRight),
      min(alphaUp, alphaDown)
    );
    float edgeBand = smoothstep(0.06, 0.56, printSample.a)
      * (1.0 - smoothstep(0.1, 0.88, innerAlpha));
    vec2 inwardGradient = vec2(
      alphaRight - alphaLeft,
      alphaUp - alphaDown
    );
    vec2 outwardNormal = -inwardGradient
      / max(length(inwardGradient), 0.0001);
    vec2 edgeLightDirection = length(uLightDirection.xy) > 0.001
      ? normalize(uLightDirection.xy)
      : normalize(vec2(-0.65, 0.76));
    float directionalEdgeLight =
      dot(outwardNormal, edgeLightDirection);
    float edgeHighlight = pow(
      max(directionalEdgeLight, 0.0),
      1.35
    );
    float edgeShade = pow(
      max(-directionalEdgeLight, 0.0),
      1.2
    );

    if (printSample.a < 0.1) discard;

    vec3 surfaceNormal = normalize(vNormalView);
    vec3 viewDirection = normalize(-vViewPosition);
    float frontDeformation = clamp(vCurl * 0.82 + vLift * 0.48, 0.0, 1.0);
    float preservedFront = uPreserveFrontColor * (
      1.0 - smoothstep(0.025, 0.34, frontDeformation)
    );
    float signedFacing = dot(surfaceNormal, viewDirection);
    float frontMix = smoothstep(-0.035, 0.035, signedFacing);
    frontMix = mix(
      frontMix,
      step(0.0, signedFacing),
      preservedFront
    );
    vec3 normal = signedFacing < 0.0 ? -surfaceNormal : surfaceNormal;
    vec3 lightDirection = length(uLightDirection) > 0.0001
      ? normalize(uLightDirection)
      : normalize(vec3(-0.38, 0.52, 0.76));
    vec3 halfDirection = normalize(lightDirection + viewDirection);
    float normalLight = max(dot(normal, lightDirection), 0.0);
    float lightLevel = clamp(
      uAmbientLight + normalLight * uLightIntensity,
      0.0,
      1.65
    );
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, 3.0);
    float micro = (hash21(vUv * 970.0) - 0.5) * 0.018;

    float highlightExponent = mix(52.0, 18.0, uLightSoftness);
    float printHighlight =
      pow(max(dot(normal, halfDirection), 0.0), highlightExponent)
      * 0.068
      * uLightIntensity
      * mix(1.0, 0.68, uLightSoftness);
    float frontDiffuse = mix(
      1.0,
      lightLevel,
      0.18 + frontDeformation * 0.82
    );
    vec3 litFrontColor = printSample.rgb * frontDiffuse + printHighlight;
    litFrontColor += fresnel * 0.025;
    vec3 neutralFrontColor = mix(
      litFrontColor,
      printSample.rgb,
      preservedFront
    );
    float materialFinishActivation = mix(
      1.0,
      smoothstep(0.0, 0.22, frontDeformation) * 0.35,
      clamp(uMaterialBaked, 0.0, 1.0)
    );
    vec3 frontColor = applyFrontMaterial(
      neutralFrontColor,
      normal,
      viewDirection,
      lightDirection,
      halfDirection,
      materialFinishActivation,
      frontDeformation
    );
    frontColor = mix(
      frontColor,
      vec3(1.0),
      edgeBand
        * edgeHighlight
        * clamp(uEdgeFinishStrength, 0.0, 1.0)
        * 0.2
    );
    frontColor *= 1.0
      - edgeBand
        * edgeShade
        * clamp(uEdgeFinishStrength, 0.0, 1.0)
        * 0.12;

    float exponent =
      mix(17.0, 86.0, clamp(uGloss, 0.0, 1.0))
      * mix(1.2, 0.42, uLightSoftness);
    float specular = pow(max(dot(normal, halfDirection), 0.0), exponent);
    specular *=
      mix(0.06, 0.3, uGloss)
      * (1.0 - uRoughness * 0.58)
      * uLightIntensity
      * mix(1.0, 0.72, uLightSoftness);
    float satinBand = pow(max(vCurl, 0.0), 1.7) * (0.045 + uGloss * 0.1);
    vec3 backColor = uBackColor * mix(0.76, 1.0, lightLevel);
    backColor += specular + fresnel * (0.055 + 0.085 * uGloss) + satinBand + micro;

    vec3 color = mix(backColor, frontColor, frontMix);

    float projectedShadow =
      (1.0 - getShadowMask())
      * vAdhered
      * vShadowReceiverProximity;
    float peelShadowActivation = smoothstep(0.001, 0.035, uPeel);
    color = mix(
      color,
      uShadowColor,
      clamp(
        projectedShadow
          * uShadowOpacity
          * uSurfaceShadowEnabled
          * peelShadowActivation,
        0.0,
        1.0
      )
    );

    if (uEntranceSweep >= 0.0) {
      float sweepCoordinate = abs(uEntranceAxis.x) > 0.5
        ? (uEntranceAxis.x > 0.0 ? vUv.x : 1.0 - vUv.x)
        : (uEntranceAxis.y < 0.0 ? 1.0 - vUv.y : vUv.y);
      float sweepCenter = mix(-0.3, 1.3, uEntranceSweep);
      float laserDistance = abs(sweepCoordinate - sweepCenter);
      float laserCore =
        1.0 - smoothstep(0.0, uLaserCoreWidth, laserDistance);
      float laserHalo =
        1.0 - smoothstep(uLaserCoreWidth, uLaserBandWidth, laserDistance);
      float laserPhase =
        (sweepCoordinate - sweepCenter) * 3.6 + uEntranceSweep * 1.7;
      vec3 laserColor = 0.58 + 0.42 * cos(
        6.2831853 * (laserPhase + vec3(0.0, 0.33, 0.67))
      );
      color = mix(
        color,
        laserColor * uLaserBrightness,
        laserHalo * uLaserBandOpacity
      );
      color += laserColor * (
        laserCore * uLaserHighlightIntensity
        + laserHalo * uLaserBandOpacity * 0.347826
      );
    }

    if (uInteractionHint > 0.0) {
      float hitArea = interactionHitArea(
        vUv,
        printSample.a,
        uInteractionHintRadius
      );
      float nearbyAlpha = min(
        min(
          texture2D(uMap, vUv + vec2(uTexel.x * 3.0, 0.0)).a,
          texture2D(uMap, vUv - vec2(uTexel.x * 3.0, 0.0)).a
        ),
        min(
          texture2D(uMap, vUv + vec2(0.0, uTexel.y * 3.0)).a,
          texture2D(uMap, vUv - vec2(0.0, uTexel.y * 3.0)).a
        )
      );
      float edge = smoothstep(0.04, 0.28, printSample.a)
        * (1.0 - smoothstep(0.08, 0.72, nearbyAlpha));
      float innerLineWidth = max(2.0, uInteractionHintRadius * 0.09);
      float innerEdgeOuter = interactionHitArea(
        vUv,
        printSample.a,
        uInteractionHintRadius + innerLineWidth
      );
      float innerEdgeInner = interactionHitArea(
        vUv,
        printSample.a,
        max(0.0, uInteractionHintRadius - innerLineWidth)
      );
      float innerEdge = clamp(
        innerEdgeOuter - innerEdgeInner,
        0.0,
        1.0
      ) * (1.0 - edge);
      float dash = smoothstep(
        -0.22,
        0.22,
        sin((gl_FragCoord.x + gl_FragCoord.y) * 0.72)
      );
      color = mix(
        color,
        uInteractionHintColor,
        hitArea * 0.28 * uInteractionHint
      );
      color = mix(
        color,
        uInteractionHintColor,
        max(edge, innerEdge) * dash * uInteractionHint
      );
    }

    gl_FragColor = vec4(color, printSample.a * uOpacity);
    #include <colorspace_fragment>
  }
`, te = `
  uniform float uPeelDepth;
  uniform vec2 uOrigin;
  uniform vec2 uPeelDir;
  uniform vec2 uMeshSize;

  varying vec2 vResidueUv;
  varying float vResidueReveal;

  void main() {
    vResidueUv = uv;
    vec2 direction = normalize(uPeelDir + vec2(0.00001));
    float along = dot(position.xy - uOrigin, direction);
    float revealFeather = max(min(uMeshSize.x, uMeshSize.y) * 0.012, 0.004);
    float peeledArea = 1.0 - smoothstep(
      uPeelDepth - revealFeather,
      uPeelDepth + revealFeather,
      along
    );
    vResidueReveal = peeledArea * step(0.00001, uPeelDepth);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`, ie = `
  uniform sampler2D uMap;
  uniform float uOpacity;

  varying vec2 vResidueUv;
  varying float vResidueReveal;

  float residueNoise(vec2 point) {
    point = fract(point * vec2(127.1, 311.7));
    point += dot(point, point + 19.19);
    return fract(point.x * point.y);
  }

  void main() {
    float artworkAlpha = texture2D(uMap, vResidueUv).a;
    if (artworkAlpha < 0.1 || vResidueReveal < 0.001) discard;

    float grain = mix(0.82, 1.0, residueNoise(vResidueUv * 760.0));
    float residueAlpha = artworkAlpha * vResidueReveal * grain * 0.085;
    gl_FragColor = vec4(vec3(0.34), residueAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`, re = `
  ${EA}

  varying vec2 vDepthUv;

  void main() {
    vDepthUv = uv;
    vec3 deformed = deformSticker(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(deformed, 1.0);
  }
`, we = `
  uniform sampler2D uMap;
  varying vec2 vDepthUv;

  void main() {
    float artworkAlpha = texture2D(uMap, vDepthUv).a;
    if (artworkAlpha < 0.04) discard;
    gl_FragColor = vec4(1.0);
  }
`, se = "data:audio/mpeg;base64,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UQCH0q01oGmnLht0AgjKHjedpdG/krlVFsiA60xsCOJAJGxQuctRBikVDCbaTUEF7DKXioqWTRMvieniNKzXbJ6NvOpKCgDxTTANikDcLwMN8CzIFjAfQHyARlBkVDZE5GJFwIIxIJyQfAOQCYCCcDBODEhAIyg2gFKQfNeshgoqDChdrP15//3v85///rrojcHrwn0eMNntU1Rsg88/YYvkE//7nMy//HEVLmXZQCAAAbVTAQmCCEoRa7S0SGUTSCFcrJUbr1BWmTqTNpmJsUw7wFJMnQgms6ssYNkEwC2N1DkOK5nhuNHNPqsyBYo0Vcq5muk0rVtDRXZ8mmJENNkZThQ9cqa7Evt6eQobp2H/+5LEMoAhRhFMmYeAAz2wLj8w8ADMeYQ5CyEpBvLgIEdY2SFGchpdi9K57cqgaRKUugS7k7EHLgoUAkFadBvkob0k/YkdRdKKxxGuJjKJwonEvhYlaczezIcX9aLehZ/s6NY4qAXmk5WtDmZhZYV4J2pVvUT0Q414AjyFOZ7D6Rl2CLK2nAuz6U101Taof2k1lTR5ewul00VgQqGTG4tMH///////////saaaluT///////////q5zk1d3dxkxcPURDtt8miWQiW17cAsRoaRSkmOPkgWLCa63i69KoM3ao8gMAMAHqGmW8slSaaOEcLqOc9BbRIC4Cbk7OtVLsekeMdJni7OhOeCn04wriKac8JvSScVbgwKCBEljRWWdhv3kWj7xP3jyIxwW672RktWl3mqIXe6rxzTUceKxqBTN7AuntsUpi1s70z70h6Hs6GKyJam2uVacWeeBPesbWYcCDWPqPnMTV3jJEfv7vHlI8N+7dNMd6wwHF5L9OLXaDDawAiElSf//AKltttttciUSiSJRJBIKKlIloqtQhUVMrQN//uSxAwAGS2VabmHgBsesWx3MYADBaA20IArpwV3FzC9DVIumsfwk6H4AhjWSBklxujILxbXkJP9kUTTAbUPgRrOacVK5bEIVLArDuZYM0JsljVXRpVmu/fxFer4MVlVsmVxMzWYltFK9csTpONrYpYT5igOS4a6M2JbVcZnl77zOz2iPLNvfMU7LNqLLF0+vBe1g2pEeRLut0xS0img+TMXeqq1iznP8JVWxSl7pyBL4je513msKLNtcLmKwsV7wp2uSCuoUT0kizlSiUSIIBAA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yRlBLhYGgLd9+38EiTWIMZ09+TzAAV4ZQFSSZgFGhccLCJrrYDKv5/////////////////yCBN9////////////////W64MsCKTcSSAeIK4nY6UwrXGqYs1MckZOqA8YO+sqtlueq9v/Ha8NK9F21jn/+5LEsoAngg8Y2PyAAoszZG+ewAG1Wo4Phk6XfD9DJ5aeuxZdv48YhhWk0xMS6uv8P8zafOrR/ZpHlsaOoGvddaeTNWfXm30axw4+zSx1aYh6TaPLjJbTk6UkmJ6691IW25epl08nKW0Dzh8TicISFEOo6oy6VTEmiS6erX77WKJ1a5b9vq7HIGmv3auulQU2o0QgHgjGgeAVoKiEoVsUA2K562c+h36Gu7uzt+96n97K+BaurHl9a3Z5bAWzNQV1yH8DCxdaJYvPF2x3j1G+8kO2N+q6J5Gy8WT51UgD/Gsu7T59mq9ktxJYWYT41H5YW1DZ0lJLXITrCXUqGcVcfWIyavhV5TdlpmT4SRKJJK6i+ygjmK4OzAljocjsTSVy7oUi5b8CZew/B0bD9LX62fOrH/AIAAAALzoVIGAYsQ0AAZ7XvQnJ1mWiqszaXue1UCBDwcld9balSKxcTKQWluLsU3dUaQDoODYEzl6ljWFAFhQcDSiBglDrVd11VjrJgNk6W67KdNNCcgqlSNAW8ph4Es+MtzTSdOVs7csQARIu//uSxImAFLGbJXSWAAT0weLXM6AACg6tyjih6AZhqYbSWauA78eEgRQUYw3FUDDZQk6ISxdhJAyYcOHiwhlLQYAbVp7zveztoRax32TyhgzXmJNbcIOQCIQXwMMIMsCTUL2EAEDE3ZRvdd4YchpmELrxllIoFbuzlVddrFGZp0uyuuGmxqquioA7ZEPauzdDmcg4Sgb7MuM1Rsx7v4YT0//+eSTTTWHS3z/9St2t9/0a1nNdVTMwGWSjneldO4Zc8vWWQLsb////////////////////////////////////+BHX6rV0+HAGAAImYEKOGTDqxwAcQgGI2Cjw54qR+2uAQAsI3dN4DCoBTXMCBBABFVBWiizJQMDSDdNVF21oxeH18JWGAHJmGFFGCJyxMdl7Ny3jd11go2vhOUzgMMnGJZBw9ti5QsASUSMVgoXflip4eYWFwYADAYewMQkmGLUXSs0SCrTZIDhiO4cDf9NC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0ZOnULjZ60vEEKnO1en5xJYKRanqkuxIKLRosiRzm4dPc3Dkqd//3mXqt7VpqKoARlNOLMTRJGlFOz0aceZG5/s07xakiJxoEKLKPhyizCni1JGnFvV1dJpKkJY6ojUTODIKh4ugXSOnDp1JdScJw3YyVSThNJZNK6tY6cLJpKrEI0Hxg4dLHTh0oNjAeGyAnPEwpEQyMh4bICc8TCkiIipYqWKh4bGDhdRdJNIuUSXhOF1axxpRZRZQGBAR5l5v+TU1JxpwGJAjyCaKRpx1VVVMQf/7ksRSA9QloIJDJNtIAAA0gAAABE1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=", ne = "data:audio/wav;base64,UklGRpD2AABXQVZFZm10IBAAAAABAAIAgLsAAADuAgAEABAAZGF0YWz2AAD///3//v///wAA+//+/wEAAAD7//7//v//////AAD8//3/AAABAPv//P8AAAIA+//8/wEAAgD7//z///8CAP7//P/9/wMA/v/8////AgD9//7///8AAP7/AAD9//7/AAACAP7//f/+/wIAAAD+//3///8BAAIA/f/9/wAAAgD+//7/AQAAAP7/AAAAAP7//v8CAAAA/P///wEAAQD+//3///8CAAIA/P/8/wMAAwD9//v/AgAEAP7//P8AAAIAAgD///3///8DAAIA/v///wIAAgAAAAEAAQAAAP//AwAEAP////8FAAIA//8BAAQAAQABAAIAAgACAAMAAAABAAMAAwABAAIAAgACAAEAAwACAAEAAQAEAAMA//8BAAYAAgD//wIAAwABAAEAAwACAAAAAQACAAIAAQACAAEAAAACAAQAAQD+/wEABAACAP3/AAAHAAIA+////wcABAD+//3/AQAFAAMA/v/+/wIAAgAAAAEAAQABAP7/AAAEAAEA/f8BAAMAAAD+/wMAAgD9////BQABAP7/AAADAP//AAACAAAA/v8CAAIAAAD//wIAAQAAAP//AgAAAP//AAAEAAEA/v///wMAAgD///3/AgAEAAEA/P8AAAQAAgD9////AwACAP7/AAACAAEAAAAAAAAAAQAAAP//AQABAP//AQAEAP7//f8DAAIA/P8AAAMAAAD+/wMAAAD+/wIAAwD9////AwADAP////8AAAMAAgAAAP//AwABAAAAAgADAP7///8DAAUA///+/wIABAABAAEA//8CAAQAAQD+/wMABQAAAP//BAACAAAAAgADAAEAAgACAAIAAQACAAMAAgAAAAEAAwADAAIAAQAAAAMABQAAAP7/BQAGAP3///8IAAQA+/8BAAgAAQD9/wQABQAAAP//AwAEAAAAAQABAAEAAwADAP//AQADAAEAAAADAAAA//8DAAQA/v8AAAQAAgD9/wIAAwABAP//AQABAAIAAQABAAAAAgABAAEAAQACAAEAAAAAAAQAAgD//wEAAwACAAEAAQABAAIAAwACAP//AQAEAAMAAAADAAIAAQABAAMAAgADAAIAAQAAAAMABAACAP//AQADAAMAAQACAAEAAAACAAUAAgD+/wAABgADAP7///8GAAUA/v/+/wYABgD///3/AwAGAAMA//8BAAMABAADAAEAAAADAAQAAwAAAAMABAADAAEABAAEAAMAAAAEAAYABAD+/wMACAAGAP7/AwAGAAYAAQACAAQABgACAAIABAAGAAEAAwAFAAYAAgACAAMABwAEAAIAAAAFAAYAAwABAAUABQAEAAEABAAEAAUAAgACAAQABwABAAIABgAGAP//AgAGAAYAAgABAAEABwAGAAAA//8IAAUAAAABAAQABAAEAAEAAgAEAAQAAAADAAMAAgADAAUAAAABAAYAAwD+/wMABAACAAEABAACAAAAAwAEAP//AAAGAAQA/f///wgABAD8/wEABQABAAEAAwABAP7/BAAGAP///f8EAAYAAAD+/wIAAgACAAMAAQD+/wIABAABAP7/AAADAAMA///+/wIABAD/////AgABAP7/AQACAAAA/v8BAAIAAAD+/wIAAQD+//7/AwACAP///v8CAAEA///+/wIAAQD///7/AgACAAAA/P8BAAMAAAD8/wIAAwD///3/AwABAP////8CAAEAAAD//wIAAgABAP7/AQACAAIA/////wAAAwABAAEA//8AAAEABAD/////AQAAAP//BAACAP3///8FAAEA/v8AAAIAAQABAAAAAAABAAIAAAD//wAAAgAAAAAAAAAAAAEAAQAAAP//AAABAP//AAACAAAA/v8AAAEAAQAAAP7/AQACAAAA/v8AAAIAAAD+////AgABAP3/AAADAP7//P8DAAMA/P/9/wQAAQD8/wAAAwD+//3/AgADAP3//f8CAAIA///+////AAABAAEA/v/9/wEAAwAAAPz///8CAAEA/f/9/wIAAwD+//z///8FAAEA+//9/wQAAgD9//3/AwAAAP3/AAACAP7/AAABAAAA/P8BAAIA/v/9/wIAAgD///7/AgAAAP//AQABAP7/AQADAAAA/f8CAAIAAQABAP////8EAAIA/v8BAAQAAAD//wQAAQD//wIAAwABAAEAAQACAAIAAgABAAMAAQABAAIAAwAAAAIAAwAEAAAAAAAEAAUA//8AAAMABQABAAEAAQADAAIAAQABAAQAAgACAAAAAgADAAIA/v8CAAQAAgD//wMAAgAAAP//BQACAP//AAACAAIAAwAAAP//AAAEAAEA/////wMAAgD/////BAABAP//AAADAP//AAACAAIA/v8BAAEAAQABAAIA//8AAAAAAgACAAAA/P8CAAMAAAD//wIAAAD//wAABAAAAP7///8DAAAAAAAAAAAA//8BAAIAAQD9/wAAAwAAAPv/AQAFAP7//P8CAAIA///+////AQABAP7///8BAAAA/v8AAAEA///+/wAAAwD///z/AAACAP////////7///8DAP///f///wEA//////7/AAAAAP///f8AAAAA/v/+/wIA/v/8/wAAAwD8//v/AQADAPz//f8AAAAA/v/////////+//7///8AAP3///8AAP7//f8AAAAA/v/9//7/AAABAP7//f///wEAAAD9//7/AAD+//7/AQAAAPv///8CAP7//P///wAA///+//7///8AAP///f/+/wAA///9//7/AAD////////9////AQD///z//v8AAP7/AAAAAPz//P8BAAIA/P/6/wAAAQD+//v//v8BAP///P/9////AAD8//z///8AAP3//P///wIA/P/6//7/AQD8//z//v////z//v/9/////f/8//z/AQD+//r/+v8BAP7//P/7/////v/9//r///////v/+f8AAP///P/6//3//v////n//P/+////+//8//z//v/+//z/+f/+/////v/8//3/+//9//7////6//v//f8AAPz/+//7/wAA/v/8//v////8//z//f////z//f/9/wAA/P/7//z/AQD///z//P8AAP7//v/8//7//v8AAP7//P/9/wIA///7//z/AgD///7//f///////v/9/wAA//////7///8AAAEA/f/9/wEAAAD8/wAAAQD///3/AQAAAP///f/+/wEAAQD8////AgD+//3/BAAAAPr///8EAP3//f8BAAAA/v//////AAABAP///f///wIAAQD8//7/AQAAAP////8AAAAAAAD+////AgAAAP3///8CAAAA/v8AAAAA//8AAAAA/////wEA///+/wEAAAD///////8BAAAA/v///wAAAAAAAAAA/v///wEA//////////8BAAAA/f///wIA/////wAAAAD//wEAAQD///7/AAABAAIA///9////BAACAP7//v8BAAEAAgD///3///8FAAMA/f/7/wMABgAAAPr/AQAEAAAA/v8DAAEA/P8BAAQA/v/+/wMAAQD9/wAAAgD/////AQD/////AQACAP///f8AAAMAAAD9/wAAAwAAAP7///8AAAIAAgD9//3/AwACAP3/AAACAP///v8CAAEA/////wEA//8CAAEA/f///wUAAAD9/wAABAD/////AQABAP//AQABAAEA//8AAAAAAgD/////AQABAP//AQAAAP////8EAP///P8BAAYA///7/wAABgD///z/AQAEAP7//v8CAAIA/v8AAAAA//8BAAMA/v/9/wEABAD///7///8BAAAAAgD///7/AQADAP7//v8AAAMAAAD///7/AwABAP7///8CAP//AAABAAAA/v8CAAAA/////wIA/////wAAAQAAAAAA/f8BAAMA///7/wIAAgD+//3/AgABAAAA/v//////AgAAAP///f8AAAIAAgD9//3/AQADAP7//v8BAAEA/v8BAAEAAAD//wEAAAD//wAAAQD//wAAAQAAAP//AgAAAP7/AAACAAAAAAAAAAAAAQABAP//AAACAAAA//8CAAEAAAAAAAAAAQABAAIA///+/wIABAD+//3/AgADAAAA//8AAAIAAQAAAP7/AQADAP///f8DAAMA/v/9/wQAAQD+/wAAAgD/////AgACAP3/AAADAAEA/v8AAAEAAQD//wAAAQACAP///v8CAAMA/f///wMAAAD+/wMAAgD9////AwABAP///f8BAAMAAQD8////AgABAP//AAD//wAA//8BAAEA/v/8/wMAAwD9//3/AwD///7//v8BAP//AAD+//7/AAACAPz//v8AAAAA/P8BAAAA/v/7/wEAAAD+//3////9/wAA//////v///8BAP//+v/+////AAD9//7//P/////////7////AAD+//r/AAAAAP7/+//+////AgD9//v///8DAPz//P8AAAEA/P8AAP///f/+/wIA///+//7/AQD+/wAA////////AAD//wIA///+////AwAAAP////8BAP//AQAAAAAA//8BAAIAAQD+/wAAAQACAP//AQABAP////8EAAIA/P/9/wYAAwD9//7/AwACAAAA/v8AAAEAAgAAAAAA//8BAAIAAQD+/wAAAgAAAP7/AgACAP///v8BAAEAAAAAAAEA/////wEAAQD//wAA/////wIAAQD//wAAAQD+/wAAAwAAAP3/AAABAAIAAAD/////AwABAP////8BAP//AQABAAAA//8DAAAAAQAAAAAA/v8CAAEAAgAAAAAA/v8FAAIA/f/+/wYAAQD+////BQAAAP//AAAFAP////8CAAMA/f8DAAIAAAD//wQAAAAAAAEAAgD+/wIAAQABAP//AgAAAAIAAAACAP//AAAAAAMAAAAAAP//AgAAAAIA//8AAAAAAwAAAP///v8DAAAAAAAAAAIA/v/+/wEABAD+//3///8EAAEA/v/+/wMAAQD/////AgD//wEAAQABAP//AQABAAIA/v///wMABQD9//7/AwAFAP7//P8CAAYAAAD9/wEAAwD//wIAAgD+////BQACAP7/AAADAAEAAgAAAAAAAgACAP//AgADAAEA//8DAAMAAAD//wIAAgADAAAAAQADAAMA//8BAAIAAgAAAAIAAQADAAEAAAABAAQA//8AAAQABAD9/wAAAwACAP//AgABAAAAAQAEAAAA/v///wIAAgACAP3//v8CAAQAAAD+////AQABAAIA///9//7/BAADAP7//f8BAAIAAgD+//7/AQADAP///v8BAAIAAAD//wAAAgAAAP//AgACAP3///8EAAIA/v///wEAAgACAAAA/v8BAAQAAAD9/wIABAD+//3/BAAEAP////8AAAEAAgACAP7///8DAAIA//8AAAAAAQACAAEA/f8CAAQA///+/wIAAgABAAAAAAABAAIA//8BAAQAAQD9/wIABAAAAPz/AgAFAAAA/f8DAAQA/v///wUAAQD9/wEABgD///3/AwAEAP3///8GAAIA+/8CAAUAAQD+/wEAAAACAAEA/////wUAAgD9//7/BgADAPv//P8HAAQA/f/9/wQAAQABAAEAAAD+/wIAAgACAP7/AAADAAMAAAAAAAAAAgAAAAIAAQABAP//AQADAAIA/f8AAAIAAwAAAAAAAAAAAAEAAwD///7/AQAEAAAA/f8BAAMAAAD//wAAAQABAAEA//8AAAMAAAD+/wEAAgD//wEAAgD/////AwABAAAAAQAAAP//BAADAPz//v8GAAQA/v/9/wMAAwD/////AgACAAAAAAADAAEA/////wEAAgABAAAAAAAAAAIAAAABAAEA/v8AAAMAAAD9/wEAAgD+////AgAAAP////8BAAAA//8BAP///f8BAAIA/v/9/wIAAQD+/wAAAQD9////AgAAAPz/AAACAAAA/v///wAAAAABAAAA/P8AAAMAAQD8//7/AgABAP//AAD9////AwADAPz//P8DAAMA/v/+/wAAAgABAP///v8BAAIA///9/wIAAgD+////AgAAAP//AQAAAAAAAgAAAP7/AAABAAEAAgD///z/BAAGAP3/+v8EAAUA/f/+/wMAAAD+/wEAAgD///7/AQABAP///v8AAAAA//8AAAEA/f/+/wEAAQD8//3/AgACAPz//f8CAAEA/P///wAA/v/8/wIAAQD8//z/AQAAAP7//f8AAP///v/+/wAA/f/8////AwD9//r//v8DAP//+//9/wEAAAD9//3/AAD///3//v8AAP///f/8////AAD+//3///8AAP7//f/+///////9//3///////7////+//z///8CAP//+//+/wEA/v/+/////f/+/wIAAAD7//7/AwAAAPz//f8BAAEA/v/+/wAAAQD///7///8CAAAA/f///wIAAQD/////AAD//wEAAQD///3/AQADAAEA/v///wAABAABAP3//v8FAAIA/f8AAAQAAAD+/wAAAwACAP///v8DAAMAAAD//wEAAQABAAAA/v8BAAUA///6/wQACAD8//n/BgAGAPr//P8GAAMA/f///wIAAQAAAP//AAAAAAAAAAABAP7//v8BAAIA///9////AgAAAP7//v8BAAAA//8BAP///v8BAAEA/v///wEA/////wEAAAD+/wAAAAAAAAAA/v/+/wIAAwD9//v/AgADAP3//f8CAAEA/v8AAAEA/v/+/wIAAAD9////BAABAP3///8CAAAAAAD//wEAAAD//wAAAwAAAP7/AQADAP//AAAAAAEAAAAAAAEAAwD/////AgADAP7/AAABAAEAAAACAAEAAQAAAAAAAQADAP////8BAAIAAAABAAEAAQAAAAEAAQAAAP//AgADAP///v8DAAIA/v8AAAIAAAAAAAIAAgD//wAAAgACAAAA/v8BAAQAAAD9/wIABQD///7/AwACAP7///8DAAEA//8BAAEAAAACAAEA/v8AAAMA//8AAAIA///+/wMAAQD//wAAAQAAAAIAAQD+//7/AwAEAP///P8DAAUA///8/wEAAwACAP///v8BAAUAAAD8/wAABQAAAP7/AgACAP7/AAACAAEA/v///wIAAwAAAP7/AQABAAAAAQD///7/AgAEAAAA/f///wIAAgD///3/AAACAAAA//8BAAEA/v///wEAAAAAAAAA/v/+/wMAAgD9//7/AgABAP7///8AAP//AAAAAAAAAAD+//7/AwABAPv//v8DAP7//v8BAP///P8BAAIA/f/8/wEAAQD9//3/AQD///3///8BAPz//v8AAP7//f8AAP///v/+/wAA/v///////v///wEA/P/9/wEAAwD8//v/AAAEAP///P/9/wMAAQD8//z/BAABAPz///8EAP///P8BAAMA/v8AAAIAAAD//wIAAgD///7/AgADAAEA//8AAAMAAgD+/wAABAACAP3/AQAGAAEA/v8BAAIAAQACAAEAAAACAAIA//8BAAMAAQD//wIAAwABAP//AQACAAIAAAABAAEAAgACAAEA//8CAAMAAQD+/wIAAwAAAP//AwABAAAAAQABAAAAAwABAP//AAAFAAAA/f8BAAUAAAD+/wEABQAAAP7///8EAAIA//8AAAIA//8CAAIA///9/wMAAwABAP//AQAAAAIAAAAAAAAAAgAAAAAAAAACAAAAAAD//wMAAAD//wEAAwD+//7/AQACAP//AAAAAAEAAAD//wAAAgD+//7/AQACAP/////+/wAAAwAAAPr///8FAAIA+v/+/wQAAgD8//7/AwABAPz/AQADAP///v8CAAIA/////wIAAAD//wIAAwD/////AwADAP7/AQADAAAA//8CAAUAAAD8/wIABgABAP3/AgAFAAAA//8EAAMA//8AAAMAAwAAAAEAAwACAAEAAgABAAAAAgAFAAAA//8EAAQAAQAAAAEAAgAFAAMA/v8CAAcAAwD+/wEABQAEAAEAAQACAAMAAgACAAIAAgAAAAQABQABAP//AwADAAAAAQAEAAEAAgACAAIAAAACAAMAAQD//wMAAgABAAAAAgACAAIAAAAAAAIAAwD//wAAAQACAAAAAQABAAEAAAABAAEAAQD//wAAAQADAAMA/v/9/wMABQD+//z/AwAEAP////8CAAIAAAD/////AgACAAAA//8AAAEAAgABAP///v8BAAEAAQABAP///v8CAAMA///9/wEAAgABAAAA/v///wIAAQD+////AQAAAP//AAAAAAAA//8AAAAA/v/+/wIAAgD8//3/BAACAPz//f8CAAEA/f///wIAAAD9/wAAAgD+//z/AQACAPz//v8DAAAA/P/+/wEAAAD9////AAAAAP////8AAP7//v8BAP///////////v8BAAAA/f/9/wIAAgD+//z/AAACAAAA+/8BAAQA/f/6/wQABAD8//v/AgABAAEAAAD9//3/BQACAPz//f8EAAEA///+/wEAAAAAAAAAAQD+/wEAAAAAAP7/AgAAAP3//v8FAP///P///wMA///////////+/wIAAAD+//3/AQAAAAAA/P///////////wAA/v///wAA///+/wEA///8//7/AgAAAP3//v8BAAEA/f/+/wEA///9////AgD+//v/AgADAPv/+/8DAAIA/P/9/wEA/////wAA/v/9/wAAAAD////////+////AAABAP3//P8AAAMA///7////AAD+////AAD+//3/AAABAP7//P8BAAMA/P/8/wIAAgD9//7//////wIAAAD7////BAAAAPz/AAABAP7/AAABAP7///8CAP///f8BAAIA/v///wEAAQAAAAEA/v///wIAAgD/////AAACAAEAAAD+/wEAAgABAP7/AAACAAMA/v///wIABAD/////AAADAAEAAQD+/wIAAwADAP3///8DAAUA/f///wIABAD//wEAAQACAP//AgABAAIA/v8CAAEAAgD//wMAAQAAAP//BAABAAAA/v8DAAEAAQD+/wAAAwACAPv/AQAEAAAA+/8CAAIA/v///wIA/f///wEAAAD9/wEAAgD///v/AQACAP7/+/8AAAIAAAD9/wAA/v/9/wAAAwD8//v/AgADAPv//v8AAP7//v8CAP///f/+/wEA//////3//v///wEA///+//z/AAABAP///P/+/wAAAQD+//3//f8CAAEA/P/7/wIAAgD9//z/AAAAAP7//v////7/AAD///3//v8AAAAA/v/+//3///8BAP7//P///wAAAAD9//3///////3///////7//f8AAP7//v////7/+////wEA///8//7///8BAP7//P/9/wEA///9//7/AAD+/////v////7/AAD+//3///8CAP3//P8AAAIA/v/+/wAAAAD+/wAA/v///wEAAAD9////AgACAPz//v8BAAEA///+/wAAAgD+////AQACAP7//f8CAAMA////////AAAAAAIA///+/wAAAwD///7/AgADAP3//v8CAAIA/v///wEAAQD+/wAAAAABAP7//////wEA//8AAP/////+/wAA//8AAP7//////wIA/f/9/wAAAgD8//3/AAABAP3////+/wAA/v8AAP7//v/9/wEA///+//z///8BAAIA+//7/wEABQD7//n/AAAEAP7//f/+/wAA//8BAP7//f/+/wIAAQD///z///8CAAEA/f8AAAIAAAD8/wEAAwD///3/AwADAP7//v8DAAIAAAD+/wAAAgADAP////8BAAMAAAD//wEAAgD/////AgADAP//AAAAAAAAAQABAP7///8BAAIAAAD/////AQAAAP7///8CAAAA/f///wMA/v/8/wEAAgD+//3/AAACAP///f///wIA///9/wEAAQD9////AQD/////AQD///7/AAABAP7//v8BAAEA/f/9/wEAAwD9//z/AgACAP3//v8BAP///f8BAAEA/v/+/wEAAgD+//z/AAACAAAA/P/+/wEAAQD+//7//////wAAAAD+////AQD///3/AAAAAP7//v8AAP///v8AAAAA/f/9/wAAAQD9//7/AAD+//3/AQAAAPz//f8BAAEA/f/7/wAAAgD///v//v8BAAAA/f/8/wAAAwD+//v///8CAP7//v/+////AQD///3///8CAP///P8AAAIAAAD8//3/AwADAPv/+/8EAAQA+//8/wQAAQD7/wAAAwD+//7/AQAAAP//AQD///7/AAACAAAA//8AAAEAAAD/////AgABAP7//v8EAAIA/f///wQAAAD+/wEAAgD+/wEAAQABAAAA//8AAAMA/////wEAAQD+/wMAAgD9//3/BQACAP7//v8EAAEA///+/wQAAQD+//7/BAABAAAA/v8CAAEAAgD//wEAAAABAP//AwD//wAAAAAEAAAAAAD+/wUAAgD///v/BgAFAP7//P8FAAEAAQABAAIA/f8EAAIAAAD//wMA//8CAAEAAAD//wQA///+/wEABQD+//7/AQADAP7///8AAAAA//8CAAAA/v/+/wIAAAD+//7/AgD///7///8AAP////////////8AAP///f/+/wAAAQD///z///8CAAAA+//+/wQA///7////AgAAAP7///////7/AAABAAAA/v///wEAAQD9//7/AgABAP3/AAACAAAAAAABAP7///8CAAIA//8AAAEAAQAAAAEA//8AAAEAAgAAAP//AAAEAAEA/f///wUAAQD+/wAAAgABAAEAAAAAAAEAAwAAAP7/AAADAAEA/v///wIAAQABAAAA/////wIAAQD+/wAAAQAAAAEAAAD//wAAAgAAAP7/AQABAP//AAAAAAEAAQD/////AQACAP////8BAAIAAAD+/wAABAACAP7///8CAAEAAQABAP//AAAEAAIAAAAAAAMAAgAAAAEAAwABAAAAAgADAAEAAgADAAAA//8EAAUAAAD+/wMABQABAAAAAgACAAIAAgACAAEAAAABAAMAAgD//wIAAwABAP7/AAACAAIA/v8AAAIAAgD+/wAAAQAAAP//AQAAAAEAAAABAP//AAAAAAEAAAABAP7/AAACAAEA/f8BAAEA/////wQA///8/wEABAD//wAAAAAAAAAAAgAAAAEAAQD/////BQADAP3//f8EAAQA///+/wMAAwABAP//AQADAAIA/v8BAAQAAQD+/wMABAD///7/BAADAAAAAAADAAAAAAABAAMAAAD//wEABQAAAP3/AgAGAP///f8BAAQAAQAAAP7/AgACAAAA//8DAAEA/v8AAAUAAQD9////BQABAP7/AAABAAEAAwD///7/AQAEAP///v8BAAIA/////wIAAgD9/wAABAAAAP3/AQAEAAAA/v8AAAMAAQD+/wAAAwAAAAAAAQAAAAEAAQD+////BAABAPv/AQAFAP///P8DAAIA/v///wMAAAD//wAAAgAAAP////8BAAAA/////wEAAAAAAP////8AAAAA//8AAP///////wAA//8BAP////8BAAAA/f8AAAEAAQD+//7///8DAAEA/v/+/wAAAgACAPz//f8EAAQA+//+/wUAAwD9////AQACAAEAAQD//wIAAgACAAEAAgD//wEABAADAP//AgADAAQAAQACAAIABAABAAIAAwAEAAAABAAFAAQA//8DAAYABQD+/wMABgAGAAEAAgACAAgABQABAAEACAADAAIABQAGAAAABgAGAAMAAQAHAAQAAwADAAUAAwAGAAMAAgADAAgABAABAAEABwAFAAEAAQAIAAUAAAACAAYAAgACAAMABQACAAMABAAEAAIAAgADAAUAAQACAAQAAwABAAMABAADAAIAAwACAAMAAwADAAMAAgAAAAQABQABAAAABQADAAIAAwAFAAAAAAAEAAYAAQAAAAMABQAAAAQABQD+//7/CAAGAP7///8FAAIAAgAEAAEA//8DAAMAAQAAAAIAAgACAAEAAAACAAMAAQD+/wAAAwADAAAA/v8BAAMAAQABAP//AAABAAIA//8AAAIAAQD9/wEAAwAAAP3/AgACAP///v8CAAEA///+/wEAAgABAP7///8AAAMAAQD9//z/AgAEAAEA/P/9/wMABgD8//v/AwAFAPv//P8EAAQA/f8AAAAAAAAAAAIA/v/+/wMAAgD6/wEABgAAAPn/AgAFAP///P8BAAAAAgABAP///v8DAAEA/v///wMA/////wIAAwD9////AgACAP7/AAACAAEA/v8BAAEAAAD//wEAAQABAAEA/v///wQA///+/wEAAQD+/wEAAgD+//3/AgAAAAAA////////AQAAAP///f8AAAEAAAD9/wAA/////wAAAAD8/wEAAAD9//3/AgD+//7/AAD+//v/AgAAAPz/+/8BAP///v/9////+//+///////8//7//v////z//f/9/wEA/f/7//3/AgD9//r//v8CAPv//f/+/////P/+//3//v/8/////f/+//3//v/7///////8//n/AwD9//n/+/8DAPv/+//9//7//P8AAPr//f/9//7/+v/+//3//v/7//7/+/////z//f/6/////v/9//n////+//7/+v/+//3//v/8//7//f8AAPv//P/+/wEA/P/7//3/AQD///7/+v/+/wAA///8//3///8AAP7//f/8/wEAAAD8//z/AAAAAP3//f8AAAAA/v/9////AgD+//v///8DAAEA/P/8/wIAAQD///7/AAAAAAAA//8BAP/////+/wEAAQD/////AQD//wAAAAABAP7/AAAAAAEAAAAAAP7/AgACAAAA/P8BAAIAAwD+//7/AAAEAAAA/v///wMA/v///wIAAgD9/wAAAAACAP//AAD//wEAAAACAP//AAD//wQAAAD+////BAAAAAEA//8BAAAAAwD//wAAAQADAP3/AgACAAEA/f8CAAIAAgD9/wEAAgADAPz///8DAAUA/P/+/wIABQD9////AQADAP7/AAD//wIAAAABAP7/AQAAAAIA/v8AAP//AAD//wIA//8AAP//AQD+////AAABAP3/AQACAP7//P8EAAEA+//+/wQA///+/wIAAAD8/wEAAgABAP3//v8BAAQAAAD8//7/AwABAP//AAABAP//AAACAAAA/P/+/wMAAgD+////AQABAP//AAD/////AAAAAAEAAQD+/wAAAgD///3/AgAAAP7/AQACAP////8AAAAAAQABAPz//v8DAAIA/f/+/wIAAQD+/wAAAQD///3/AgACAP3//v8CAAEA/f///wEAAAD+////AAABAP7//f8AAAIA/v/+/////////wIA///8//7/AwAAAP3//f8BAAAA///9/wAAAAAAAPz///8CAAEA/P/+/wAAAAD//wEA/v/+////AgD///7//f8AAAEAAQD+//7//v8BAAAA///9/wEAAAD+//7/AQAAAP///f///wAAAQD8//7/AAAAAP3//v8AAAAA/f////7/AAD///7//v8AAP7//f/+/wIA/f/8/wAAAgD9//z/AAABAPv//f8BAAEA+//8/wEAAQD8//3//v/////////8//7/AQD+//v/AAAAAPz//f8CAP//+//9/wIAAAD9//3///8CAAAA+////wQA///6/wIABAD8//z/BAAAAP3/AAADAP///////wEAAgABAPz/AAADAAEA/v8BAAEAAQABAAAA//8CAAAA//8BAAIA/v8BAAQA///8/wQABAD9//7/AwABAP7/AQACAP7/AAADAAAA/f8BAAMA/////wEAAAAAAAEA///+/wIABAD9//3/AwADAP3//f8BAAMAAAD9////BAAAAPv/AAAEAP//+/8AAAMAAAD+//7/AAABAP///v/+/wAAAgAAAPz//v8EAAIA+//8/wIAAwD+//z/AAABAAAA/////////v8BAAEA/v/9////AQAAAP3///8AAP////8BAP///P///wEA//////////////////8BAAAA/P///wMAAAD9//7/AAABAAAA//8AAAEA/v/9/wIAAgD+//3/AQAEAAAA/v8AAAAA//8BAAMAAAD8/wAABQADAPv//f8FAAQA/P///wQAAgD9////AgACAP7//v8DAAQA/f/9/wIABAD+//3/AQAEAAAA/v///wMAAQAAAP//AgABAP//AAACAP7/AQADAAAA/f8CAAMA///+/wIAAAAAAAEAAgD+/wAAAgABAP//AgAAAAAAAAABAAEAAgD+//7/AwAEAPz//v8DAAIA/v8AAAAAAAABAAIA/////wAAAwAAAAAA/v8BAAIAAQD//wEAAAABAAEAAQD9/wIAAgD/////AwD//wAAAgADAP3/AAABAAMAAQABAP//AwABAAIA//8DAAIAAAD//wUAAwAAAP//BQAAAAAAAgAFAAAA//8AAAUAAQABAAIAAgD+/wQABAABAP7/AwABAAIABAADAP3/AQADAAMAAAABAAEAAgABAAEAAQABAP//AgADAAAA//8DAAIA/v///wQAAwAAAP7/AQAEAAMA/f///wMAAwABAAAA//8AAAQAAwD8//7/BAAFAP///v8CAAMAAAABAAAAAgACAAEAAAADAAEAAQABAAIAAAACAAMAAQAAAAIAAgABAAAAAgACAP//AQADAAEAAAABAAEAAgADAAAA//8EAAMA/f///wYAAgD9/wAABQACAP//AAACAAEAAgAAAAAAAQADAAAAAAACAAIA//8CAAIA//8AAAQAAgD//wAAAwABAAEA//8AAAMAAQD//wMAAgD+////BAABAP3/AAAEAAIA/v/+/wMAAgD+//7/AgAAAAAAAQABAP3/AAADAAAA/P8BAAIAAAD9/wIAAgD///7/AwABAP///f8DAAEA/////wIAAAACAAAAAQD+/wEAAgACAP7/AgABAAEA//8CAAAAAgABAAAAAAAGAP///f8CAAUA/v///wQABAD8/wIAAwAAAP//BAAAAP7/AgAFAP7/AAAAAAIAAQABAP//AgAAAP//AgADAPz/AQADAAAA/P8DAAMA/f/9/wQAAQD+//7/AwABAP7//v8BAAAAAAAAAAEA/v/+/wIAAwD9//3/AQACAP//AAAAAP7/AAACAP////8AAAAAAAABAAAA/v8BAAEA//8BAAIA//8AAAIAAAD+/wIAAgD+//7/BQAEAPz//P8GAAUA/P/8/wUAAwD+/wAAAwD//wAAAwADAP3/AAAEAAIA/f8BAAMAAQD9/wIAAwAAAP7/AwACAP///v8BAAAAAQAAAP///v8DAAEA///+/wEAAAAAAP7/AAD//wAA//8AAP7/AAABAAAA+////wIAAQD9//7//f8BAAMA///5/wAABAD///z/AAD///3/AAADAPz//P8CAAEA/f///wAA/v/+/wIA///+////AAD//wAA//8AAP////8AAAIA///9/wAAAwD+//3/AQABAP7///8BAAAA//8BAP7//v8CAAEA/P/+/wMAAgD8//7/AwABAPv//v8DAP///P8AAAEA//////7//v8BAAAA/f/+////AQAAAP3//P8BAAIA/v/9/wAA//////7/AQD+//z/AAAEAP//+//9/wIAAQD///7/AAD/////AgABAPz//v8DAAIAAAD/////AQADAAEA/f///wQAAgAAAP//AAACAAIAAQAAAP//AAADAAQA/////wIAAgD//wEAAgABAAAAAAACAAMAAAD+/wIAAgD+////BAAAAP3/AQADAP7/AAAAAP//AAABAP3///8EAAAA+v8CAAQA/f/8/wMAAQD8//7/BAD///v/AAAEAP7//v8BAAAA/f8BAAAA/f/+/wIAAAD+//3/AgACAP3/+/8CAAMA/f/8/wMAAgD9////AwAAAP3/AAADAP7//v8BAAIAAAD/////AgABAP///f8BAAMAAQD8////BQADAP3///8BAAAAAgADAP3//v8FAAMA/P8BAAUA/v/8/wYABQD7//v/BgAGAP3/+/8CAAMAAQD+////AAADAAAA/f8AAAMA///+/wAAAgAAAAAA/////wAAAAD//wEAAAD+////AwAAAPz///8DAAAA/v8AAAEAAQAAAP7/AAADAAIA/v/+/wIAAwAAAP//AQABAAAAAQABAAAAAgAAAP//AgACAP//AAABAAEAAQABAAAAAgAAAP//AwABAP7/AQACAAAAAAABAP//AQACAP///v8BAAMA///9////AQABAAAA/v/+/wEAAwD///3///8BAAIA///8/wAAAQAAAAAAAAD9/wAABQD///j/AgAFAP3/+/8DAAIA/v/+/wAAAAACAP7//f8BAAMA/v/+/wIAAAD8/wIABAD9//v/AgAEAP///P8BAAEA/////wEAAAD+/wEAAgD/////AAABAAAA//8AAAEAAAAAAAAA///+/wIAAgD9//z/AgADAP//+v///wQAAgD6//z/AwACAPr//v8DAP//+/8BAAIA/v/6/wAAAgD+//n///8BAP7/+/8CAP7/+//+/wAA/P/9//7/AAD9//3//f8AAP//+//7/wIAAQD8//n/AAACAPz/+v8AAAEA/f/8/wAA///9//7/AAD+//z/AAACAP7//P///wEA///+//7///8BAAAA/f/+/wIAAgD9//v/AgAEAP7/+/8AAAUAAQD6////BQAAAPr///8FAAAA/P///wIAAQD+//3///8BAAAA/////wAA/////////v/+/wIAAAD7//7/AgD///3//f///wAAAAD9//7/AAD///3//v/9/wAAAQD8//r/AgADAPz/+f8AAAIA///7//7///8AAP///v/9/wAA///+////AgD8//z/AgABAPv///8BAAAA/f8AAAEAAAD9//7/AgACAPz///8CAAEA/f8AAAAAAAABAAIA/v///wAAAgAAAP///v8CAAEAAQD///////8CAAAA/v///wIAAAAAAP7///8CAAIA+////wQAAQD7/wEAAgD+//7/BAD///z/AAADAP///f///wAAAAD///7/AAD/////////////AAD+//7/AQAAAPz/AAABAPz//v8DAP7/+/8AAAMA/v/9////AAAAAP///f/+/wEAAQD9////AQAAAP3/AAABAP///v8BAP////8AAAIA/////wAAAQD//wEAAAAAAP//AgABAAAA//8CAAEAAAD//wEAAQABAAAAAQAAAAEAAgAAAP7/AQADAAAA/v8BAAIAAgD//wAAAgAAAAAAAwABAP7/AQAEAP///v8CAAIA//8AAAIAAQAAAAEAAQAAAP//AgACAP//AAACAAAAAAAAAAIAAAD//wAABAACAP3//v8FAAIA/v/9/wIABAABAP7/AQACAAIA//8AAAAAAgAAAAAAAgADAP////8AAAIAAQAAAP7/AQADAAMA///+////BgAEAPv//P8GAAUA/v/9/wMAAgACAAEAAAD//wMAAgAAAAAAAwABAAEAAQABAAEAAgAAAP//AwADAP////8CAAIAAAAAAAEAAQABAAEAAQABAAAAAAADAAIA/////wMAAwAAAP//AgACAAAA//8DAAIAAAAAAAIAAgABAAAAAQAAAAIAAgAAAAAABAADAP3//v8GAAUA/f/9/wUABAD/////AgADAAEA//8BAAMAAgD/////AwADAAAA//8CAAQAAAD+/wEAAwAAAP//AAACAAIAAAD+/wEABAAAAPz/AQAEAP///v8DAAEA//8AAAEAAQACAP///v8BAAMA//8AAAEAAgD/////AAADAAEA/f/+/wQAAgD+//3/AQADAAEA/P///wQAAwD7//z/AgAEAP7/+/8AAAUA///8/wAAAwD+//3///8BAP/////+/wAA////////AQD8//7/AQABAPz//v8AAP///v8BAP3//v8AAAAA/P8BAAAA/f/8/wEAAAD+//z/AAAAAP///v8BAPz//v8CAAAA+/8AAP///f///wQA/P/7/wAAAwD8//3///8BAPz///8AAP///P/+////AgD9//z//v8EAP3/+////wMA/v/9//7/AQD+/wAA//////z/AQACAAAA+/8AAAEAAQAAAP7//P8DAAIA///9/wEA//8BAAEAAAD+/wAAAAADAAEA/P/+/wUAAQD+/wAAAwAAAP7/AQACAAAA/////wIAAgAAAAAAAAAAAAAAAgABAAAAAAACAAIAAQD9/wEABAABAP7/AwADAAEA//8CAAEAAwAAAAIAAwADAP//AQACAAUA/////wQABQD+/wEABAADAP7/AwADAAIAAAADAAEAAgACAAMAAAABAAIABQD/////AwAFAP7/AAAEAAMA//8DAAIAAAD//wMAAQABAAEAAwAAAAEAAgADAP7/AQADAAIA//8BAAIAAgD//wEAAgADAP//AgACAAIA//8BAAIABAD//wAAAwAFAP7//v8DAAUA//8AAAAAAwADAAIA/v8AAAIABAACAAAA/v8EAAMAAQABAAMA//8CAAUAAgD9/wEABQAEAP7/AQAEAAIA//8DAAMA/v///wYAAwD+////BAADAAEAAAABAAEAAwABAAEAAQACAAEAAgABAAEAAQACAAAAAQACAAEA//8AAAIAAgD//wAAAQACAAAA//8AAAIAAQD///7/AgADAP///f8BAAMAAAD8/wAABAABAPz/AAAEAAAA/f8AAAEAAAD+/wAAAwABAP3///8DAAEA/f///wEAAQAAAP////8CAAEA/v///wIAAAD+/wEAAQD+/wEAAgD+//3/AgADAP7//f8BAAMAAQD9//7/AQABAAAA/////wAAAQAAAAAA/v///wAAAAD//wAAAAD/////AQD///////8AAAAAAAD//wAA/v/+/wAAAwD///3///8CAAEAAAD9//7/AAADAAEA/f/+/wIA//8BAAIAAAD8/wAABAABAP3///8BAAMAAAD//wEAAAD//wMAAQD9////BQAAAP3/AQADAP///v8BAAMA//8AAAIAAQD//wIAAQD+////BAABAP//AQADAP//AQABAAEA//8BAAEAAgAAAAAAAQADAP//AAAAAAEAAQADAP7///8EAAMA/P8BAAMAAAD+/wQAAAD//wMAAwD7/wEABAD///7/AwAAAAAAAgABAP3/AgABAP7/AAADAP7//v8DAAIA/f///wIAAQD//wEA//8AAAEAAAAAAAAA//8BAAIA///+/wMAAgD+////AgABAP7/AAACAAIA/v8AAAMAAQD+////AgACAP7/AAABAAEAAAAAAP//AQACAP///v8CAAEA/////wAA//8CAAEA/f///wMAAAD9////AgD/////AQAAAP7///8CAP///P8AAAIA/v/9/wEAAgD+//7//v8AAAEA///9////////////AQD///3///8CAAAA/f/9/wEAAAD+////AQAAAP7//v8BAAAA///+////AQAAAP7/AAACAP///f8CAAMA/v/9/wEAAwAAAP7/AAADAAAA/f8BAAMA/v/+/wIAAwD/////AAABAAEA///+/wMAAQD9/wAABQD///3/AgADAP3/AQADAP7//f8FAAMA/P/9/wUAAgD9//7/AwACAAAA/v8BAAEAAAD//wAAAAAAAAAAAQD/////AQACAP3//f8DAAQA/f/8/wEAAQD//wAA/////wEAAAD+/wAAAAD9////BAD///v/AAAEAP//+////wMAAAD+//7/AQABAAAA/f8AAAIAAAD9/wIAAQD+////AgAAAAAA//////7/BAACAP3//P8CAAMAAAD8/wAAAQAAAP7/AQAAAP7///8CAAAA/v///wIA/v/9/wEAAwD+//3/AQABAP7/AAAAAP7///8BAAAA/v///wAAAAD///7///8AAAEA///8/wAAAwAAAP3///8BAP////8AAP////8BAAAA/v8BAAIA/v/+/wEAAQD///////8AAAAAAQABAP///f8AAAMAAAD+/wAAAAD//wEAAgD+//7/AQABAAAA////////AQABAP7///8BAAEA///9/wEAAgD9//7/AgABAP3//v8BAAEAAAD+//7/AQAAAP7///////7/AQAAAP////8BAAAA/////wAA//8AAAAAAAD+/wEAAQD///7/AgD//wAAAQD///7/AgABAP7//v8BAAEAAQD+//7/AgACAP7///8CAAEA//8AAAAAAQABAP7/AAADAAAA/f8CAAMA/v/9/wMAAgD///7/AQABAAEA/////wAAAwAAAP3/AAAFAAAA/P///wQAAAD//wAAAQAAAAEA/////wAAAgD+////AwABAP3/AAACAAAA/f8AAAEAAQD/////AQACAP3//v8CAAMA/f/8/wEABQD///v//f8FAAMA/P/6/wMABQD+//r/AQADAAAA//8AAP7///8CAAIA/P/+/wIAAQD//wAA////////AgAAAP7///8BAAAA/v8AAAMA/P/9/wQAAgD6////BgD///n/AQAEAP7//P8BAAIA///+/wAAAAD///7/AQAAAP7///8BAP///v8AAAEA/v8AAP////8AAAAA/v8AAP///////wEA/f///wIAAQD7//7/AgACAP3//f/+/wQAAQD8//z/AwABAP7//f8AAAAAAAD9/wAAAAD///3/AgAAAP3//f8AAAAAAQD9//z/AAAEAP7//P///wIA///+//3/AAAAAP///v///wAAAgD9//z///8CAP/////+////AAABAP3///8AAP////8BAP///v///wIA///+////AQAAAP///P///wIAAQD8//7/AgABAP3//////wAA///+////AQD///7/AAABAP///v///wEA/v/8/wAAAgD+//7/AQD///3///8BAP7//P/+/wIAAAD7//7/BAD+//r/AAADAPz//P8BAAAA/f////7///8BAP7//P8AAAAA///9////AAAAAP3///8BAP//+/8AAAEA/v/9/wEAAAAAAP3//v8BAAAA+////wMAAAD6/wEAAgD+//3/AgAAAP7///8DAP7//v8BAAIA/P8AAAMAAQD7////AwADAP7//v///wQAAQD///7/AgACAAAA/f8CAAMAAQD9/wEAAwAAAP3/AwADAP///v8CAAMAAQD9/wAAAgADAP////8CAAIA//8AAAEAAgD//wAAAQACAAEA/f/+/wQAAwD+//3/AwACAAAA//8AAAAAAQD//wAAAQAAAP//AQAAAP//AAACAP7//f8CAAQA/P/9/wQABAD7//3/BAADAPz//P8BAAUAAQD7//7/BAABAP7//v8AAAEAAQAAAP////8AAAIAAgD+//3/AgAEAP///P8BAAQAAQD+/wAAAAACAAEA/v8AAAMAAAD//wIAAgD//wAAAgABAAAAAQAAAAEAAQAAAAAAAgABAAAAAAABAAEAAAAAAAIAAAD+/wAABAACAP3///8DAAIA//8AAAIAAQAAAAAAAQACAAEAAAAAAAIAAwABAP//AQADAAIAAAD//wIABQAAAP//AwAEAAAAAQADAAEAAAADAAIAAgACAAEAAAAEAAQAAAD+/wQABgABAP3/BQAFAAAA//8FAAMAAQABAAQAAgADAAEAAgABAAUAAwAAAAAABQACAAAAAgAFAP//AAAEAAUA/////wEABQACAAAAAAAEAAMAAQD//wIAAgACAAEAAgABAAIAAQABAAEAAQABAAEAAQABAAEAAgABAAAAAAACAAEA//8AAAIAAQD//wEAAwAAAP3/AQAFAP7//P8CAAUA///+/wEAAwAAAP//AAACAAAAAAAAAAEAAQABAP////8CAAIA/v///wIAAwD+//7/AgABAP//AgABAP7///8EAAIA/P/+/wUAAwD7//7/BQABAPz/AQADAAAA//8BAP//AAAAAAEAAAAAAP7/AgABAP///P8DAAIA///8/wAAAgADAP3//f///wYAAAD8//z/AgACAAEA/P///wEAAwD9//7/AQACAP3/AAABAAEA/f8BAAAAAAD//wIA/////wIAAwD8////BAADAPz/AAACAAAA//8CAP7///8DAAMA/f///wIA///9/wMAAQD9//3/BAACAP7//P8AAAIAAAD9/wAAAQD/////AgD9//7/AAAAAP7/AAD///////8AAP7/AAD///7///8BAP////////7//v8DAAEA+//9/wQAAgD8//7/AgD+//7/AQABAP3///8BAP7///8CAP7//f8BAAIA/v///wEA/////wAA//8AAAEA///+/wAAAQAAAP///////wAAAQD///3/AAACAAAA/f/+/wMAAgD8//3/AwADAPv//v8EAAEA/P/+/wMAAgD9//7/AgABAP7/AAABAP////8CAAAA/f8AAAMA///9/wAAAgD+////AgD///7/AQAAAP///v8AAAAA/v///wIA///9/wEAAQD+////AgD///3/AQABAP////8AAAAA//8CAAEA/f///wIAAQAAAP////8AAAMAAQD+/wEAAgD//wEAAgAAAP//AwABAAAAAgACAAEAAgD//wAABAADAP7/AAACAAQAAgD+//3/BQAEAP3///8EAAAAAAABAAEA/v8CAAIAAgD+/wAABAAEAPv///8FAAQA/P///wEABAADAP3/+v8FAAYA/f/7/wUAAgD+////AwAAAAEA/////wEABAD+//7/AgACAP7/AQACAP///f8CAAIAAAD//wAAAQACAP////8BAAIAAAAAAAEAAQAAAAAAAAACAAEAAAABAAMAAgAAAP//AQACAAIAAAACAAEAAAACAAUAAAD8/wIABwD///3/BAAGAP3//v8EAAQA/v8BAAMAAQAAAAQAAgD/////BAADAAIA//8AAAQABAD+//7/BQAGAP7//v8EAAMA//8BAAQAAQD+/wIABQD///7/AgACAAEAAwD///7/AwAEAP7//v8DAAIA//8AAAAAAgABAAAA//8AAAEAAAD//wEAAAD//wAAAgAAAP7/AAACAP7//v8BAAIA/v/+/wEAAQD///7///8DAAAA+/8AAAQA///9/wAAAQD+////AQAAAP///////wEAAAD///7/AAABAAAA/f/+/wIAAgD7//7/AwAAAPz/AQAAAP3///8BAP3/AAABAPz/+/8DAAIA/f/8//////8BAP7//f/+/wAA/f8AAAAA/P/6/wEAAwD///n//v8BAAAA/P/9//7/AAD+//7//v////3///////7//P8AAP/////+/wAA/f/9////AgD9//3//v8AAP//AgD9//v//v8EAP7//v////7//f8FAAEA+P/8/wkAAAD3//3/BwD///z///8CAP7//////wAA/v8BAAAA/v/+/wMAAAD+//3/AQABAAAA/v8AAAAA/////wIA/v/+/wEAAAD9/wIAAAD9//7/AQD/////AAD///7/AAD//wAA/v/9/wAAAgD+//3/AAAAAP//AAD///3///8BAAAA/v/9/wAAAQD///////8AAP7/AAABAP///f8BAAIAAAD8/wIAAwD+//z/BAADAP///P8DAAIAAAD+/wEAAQACAP//AAAAAAMA/////wEABAD//wEAAAABAAAAAwD//wAAAgADAP7///8DAAQA/P/+/wQABgD9//3/AwAEAP////8AAAIAAQACAAAAAAABAAIAAQAAAAAAAgAAAAAAAAADAAIA/v/+/wQABAD+//3/AwACAP//AAADAAEA//8AAAMAAAD//wEAAwAAAAAAAQACAP//AgAAAP//AgAEAP7//f8CAAQA/v/+/wEAAwAAAAAAAAABAP7/AQADAAAA/P8CAAMAAAD+/wAAAQACAP7//v8BAAMA/v/+/wIAAgD9/wAAAgAAAP7/AAAAAAIA///9////BQAAAP3/AQADAP7///8AAAAAAAACAP3//f8DAAQA/P/9/wEAAgD+////AAD/////AgD///7/AAAAAP7/AQAAAP3///8EAP7/+/8CAAMA/f/8/wIAAQD9////AAD+/wAAAAD///7/AAAAAAAAAQD+//z/AgAEAP7/+v8CAAQA/v/9/wEAAAAAAAAAAAD9/wEAAgD+//v/AgAEAP7/+v8BAAMA///8////AQABAPz//v8BAAAA/P///wEA/v/9/wEA///9//3/AQAAAP3/+/8AAAIA/f/6/wAAAAD///7//v/9////AQD+//v///8AAP///v/+//3/AAABAP3/+/8BAAAA/f/9/////v////3///8AAP7//P///////v/8//7/AQABAPv//P8BAAAA+f///wEA/f/8/wIA///7//3/AQD8//3/AAD///r///8BAP//+v/+/wAA/v/8/wAAAAD9//z/AQD///7//f////7///8AAAAA/P/9/wAAAgD8//3/AQAAAP3//////wAA/v/+//7/AAD//////v/+//7/AQD///7//P///wEA///8/wAAAAD+//3/AQD///7//v8AAP//AAD+/////v8AAP//AAD+/wAAAAD/////AAD+/wAAAAABAP7/AAAAAP7///8DAP///f8CAAQA/P/9/wQAAgD9/wAAAgAAAAAAAgAAAP3/AAAEAAEA/f8CAAMA/f///wUAAAD6/wEABQD+//7/AwD///3/BAACAPz//v8EAAIA/////wAAAAACAAEAAAD//wEAAwAAAPz/AgAFAP//+/8CAAUAAgD8////AwAEAP7//v8CAAMA//8BAAAAAgAAAAAAAAAEAAAA/v8CAAUA/v///wIAAgD//wIAAQAAAAAABAABAP///v8DAAMAAQD//wIAAQABAAEAAwD///3/AgAHAAAA/P8AAAYAAgD9//7/BAADAAAA//8BAAIAAwD/////AgAEAP7///8EAAQA/v8AAAIAAgABAAIA/v8BAAQAAgD+/wEAAwABAP//AgACAAAA//8CAAIAAgD/////AQAEAAEA//8AAAIAAgACAP//AAACAAIAAAABAAEAAQABAAAAAAACAAEAAAABAAEAAQADAP///v8EAAQA/f8AAAQAAQD//wMAAgD//wIAAwD//wEABAACAP7/AQAFAAIA/v8BAAMAAwD//wAABAACAP//AQADAAEA//8DAAMA//8AAAMAAgAAAAAAAwACAAAAAAADAAMAAAD//wIAAwAAAAAAAwABAAAAAQADAAEAAAAAAAIABAAAAPz/AgAGAAEA/f8AAAIAAwABAP//AAAEAAIA/////wIAAwABAPz/AgAHAAAA/P8DAAMA//8BAAIA//8CAAIA//8CAAQA/v/+/wUABQD+//7/AwAEAAAA//8AAAMABAABAP7/AAAFAAMA/f///wUABAAAAAAAAQACAAMAAwD/////BAAFAP////8CAAQAAwAAAP7/AQAFAAMA/v/+/wIABQADAP7//f8EAAQAAQD//wEAAwACAP//AQAEAAEA/v8DAAMA//8BAAQAAAD//wMAAgD//wEAAgD//wAAAgACAAAAAAAAAAEAAQABAP7/AQADAAAA/v8CAAQAAAD8/wEABgACAPz/AAAEAAIA//8CAAEA//8AAAQAAgD+//7/BAAEAAAA/f8CAAMAAQD//wIAAgAAAP//AgACAAIAAAAAAAIAAwD//wAAAgABAP//AQACAAIAAAAAAAAAAgAAAAEAAQD///7/AwACAP///v8BAAIAAQD/////AgADAP7//f8CAAUA/v/7/wEABgAAAP3/AQACAP//AAACAAEA/v8AAAIAAwAAAP7/AQADAAAA//8CAAMA/v///wIAAwD///7/AQAEAAEA//8AAAEA//8CAAMAAAD+/wIAAgAAAAAAAQAAAAIAAgAAAP//AwADAP7///8EAAUA///+/wIABAACAP7//v8EAAUA///9/wUAAwD9/wEABAD+////BAADAPz/AQAFAAEA/P8BAAUAAQD8/wMABAD///z/BAADAP7//v8DAAEAAQABAAAA/v8CAAIA///8/wMAAwD///7/AgAAAAAAAAAAAP//AgD//wAAAAADAAAA///9/wUAAwD+//z/AwAEAAAA/P8BAAMAAwD8/wAAAgACAP//AAAAAAIA//8AAAAAAwD///7/AAADAAAA///+/wEAAgAAAPz/AAADAAAA/P8AAAIA/v/+/wEA/v/+/wIAAAD7////BAD///r/AAADAP7/+////wMA///8/wAAAgD///z///8CAP///P8AAAIA/v/9/wEAAgD8//z/AgABAP3//v8BAP///P8AAAMA/v/7////AwAAAP3//v//////AAD/////AAD+//3/AgACAPv//P8CAAAA/f///wAA////////AAAAAP7//v8CAAAA/f8AAAMA/v/8/wIAAgD9//7/BAACAPv//f8FAAMA+v/8/wUAAwD7//3/BAABAP3//v8DAAAA/P///wMA///+/wEAAQD9/wAAAgAAAP7/AAAAAAEAAQD///3/AgACAP7//f8DAAAA/v8BAAEA/f8BAAIA/v/9/wIAAQAAAAAA//8AAAEAAAD/////AAACAAAA/v8AAAAAAAAAAP///f8AAAIA///9//////8BAAEA/f/8/wIAAgD9//3/AQAAAP7//v8BAAAA/v/7/wAAAwD+//j/AQAEAPz/+P8BAAEA/f/7//////8AAP3//f///////P/+//3/AAD///3//f8BAPz/+////wEA/P/9//3/AAD///3/+f/+/wEAAAD6//v//v8DAP3/+v/7/wEA/v/9//r//v//////+v/+//3//v/9////+v/9//7/AAD5//7//v////r////9//7/+v////3////9//7/+f///////v/4/////v/+//v//v/8/wAA/P/8//3/AgD6//v///8CAPz//P/+/wEA/P/+////AAD7//7///////3/AAD8//7///8CAPz//P/+/wIA/f/+/wAAAQD7////AwABAPv//v8BAAMA//////3/AQADAAAA/P8CAAMA/v/8/wUAAwD9//7/BQAAAP7/AQACAAAAAQABAAEAAQAAAAEAAwABAP7/AwADAAAAAQACAP//AQADAAMAAQABAAAAAgACAAIA//8CAAQAAQD+/wMABAD+//3/BQADAP////8DAAIAAQD//wAAAQACAAEAAAAAAAEAAQACAAAA/v8AAAUAAgD8//7/BQACAP7///8CAAAA//8BAAIA////////AwAAAAAA/v8BAAAAAAAAAAIA/f///wEAAgD7/wAAAgACAPv///8AAAIA/v////z/AgABAAEA+f8AAAMAAgD7/wAAAAACAP7/AAD+//////8DAP3///8BAAMA+//+/wMAAgD7////AgADAP3///8BAAEA/P8CAAMA/f/7/wUAAwD+//z/AgACAAAA/f///wIAAQD8////AgABAPz///8AAAEAAAD///3/AQACAP7//P8BAAAA/f8AAAEA/P/9/wMAAQD7//3/AAAAAP/////+//3/AAACAP///P/8/wIAAwD+//3///8AAP//AgD///v//v8EAAMA/f/+/wEAAgAAAP//AQABAP7/AAACAAIA/v///wIAAgD//wAAAQAAAP//AQD//wEAAAD/////AgAAAP////8BAP//AAAAAAEA/v/+/wEAAwD9//z/AAADAP7//v/+////AAAAAP3//f8AAAEA/P///wAA///9/wAAAAD///3//v8AAAEA/f/9/wAAAQD+/wEA///+//7/AgABAP7//f8AAAIAAgD8//7/AQADAP3//f8DAAMA/P///wMAAgD9////AQADAP7/AAACAAQA/v/+/wIAAwAAAAEA//8BAAEABAABAAEA//8BAAQABQD9////BAAFAP//AQADAAQAAQAAAAAABAADAAAAAAAEAAIAAQABAAMAAQABAAIABAAAAAAAAQAEAAIAAQAAAAQAAgACAAAAAQABAAMAAQAAAAIAAgD//wIAAgAAAP//AwADAAAA//8BAAIAAQD/////AgACAP7//v8DAAAA/P8AAAMA///9/wIAAQD9////AQD///7/AgAAAP7//v8CAP3//v8CAAEA+/8CAAIA/v/7/wUAAAD7//7/BgD///7///8DAP7/AQAAAAIA//8CAP7/AQD+/wEA//8CAPz/AgADAAIA+v8BAAMAAwD4////AwADAPj/AQABAAIA+f8CAP3////9/wEA+/8BAP7/AAD5/wEA//////j/AAAAAAAA+P8AAAEA///5/wEA///+//v/AgD+//3//P8CAP3////8/wAA/P/+//7/AQD7//3//f8CAPz//P/7/wEAAAD9//j/AAABAP7/+P///////v/8/////P/9//7////9//3//P8BAP///P/6/wIAAAD7//r/AgAAAP7/+v8AAAIA///7/wAAAgD+//3/AwABAP3/AQADAAEAAAABAAAABAADAAAA//8EAAIAAgACAAMAAgAEAAMAAwACAAQAAQAFAAUABAAAAAUABgAEAAIABAADAAgABgACAAAACgAGAAMAAwAIAAQABgAEAAUAAwAIAAUABAADAAUABAAHAAQAAwADAAgABAAFAAQABQACAAcABwADAAAACAAGAAMAAgAGAAQABQACAAMAAwAIAAMAAQACAAgABAADAAAABgAEAAYAAAAEAAQABgABAAQAAwAEAAEABQADAAQAAAAFAAUABQD9/wUABQADAP//BwADAAEAAAAIAAEAAQAAAAYAAAAEAP//BQD//wMAAQAFAPz/AQACAAcA/f8BAP7/BQAAAAcA/P8BAAAABwD//wIA//8DAP//BQD//wQA/v8GAAEAAwD9/wYAAQACAP7/BAAAAAMA//8DAP7/BQD//wAAAgAHAPz/AAACAAYA//8CAAAABAABAAQAAAACAAIABAABAAMAAQADAAIABAACAAEAAgAFAAQAAwACAAIAAgAFAAQAAAABAAIAAwABAAMA//8BAP//AQABAAMA/f8AAAAAAwD+////AAADAPz/AgAAAAAA/v8DAP7/AQAAAAQA/f8AAP//BAD+////+/8FAAAA/v/8/wQA/v////3/AAD+/wMA/f/9//7/BAD9//7//P8CAAEA///8/wIAAgD+//z/BAAAAP7//f8EAAAAAQD8/wAAAAADAP//AQD+/wIA/v8CAP7/AQD7/wQA//////v/BQAAAP3//f8FAP///v/+/wQA/v/+//z/BQD///7//f8EAAEA///+/wIA//8BAP3/AwD+/wEA/P8BAP3/AQD5/wAA/f8BAPn/AAD9/wAA+f8DAPz//f/6/wMA/f////n/AgD7/wAA/f8BAPf/AQD+/wEA9v8BAP//BAD3/wIA/v8DAPv/AgD9/wMA/f8CAP3/BQD9/wEA//8GAP7/AQD//wQAAQACAP//AwAEAAQA/v8CAAMABgD+////AwAIAAAA//8DAAcAAQD+/wQABgADAAIAAQADAAQAAgACAAIAAQABAAQAAwAAAAEAAwABAAIABAACAP7/AwADAAQAAAAFAAAABwADAAcAAQAEAAIABwABAAMAAwAHAP//BAAEAAYA/f8GAAMABwAAAAYAAAAHAAAABwAAAAUA/v8GAAAABwD+/wEA/v8GAP///v/8/wMA+/8BAPz//v/6/wEA/P/+//r//v/8//7/9//+//z//v/3////+v////r/AAD3//z//f////X//P/9//7/9v/9//z////4////+v8AAPv/AAD6/wAA/P8CAPn/AAD7/wMA/P/+//n/AwD+//3/+P8DAP3//f/6/wIA/P/8//z/AQD8//z/+v8CAP3//f/6/wEA+//7//7/AwD4//n//v8FAPr/+f/6/wMA/f/7//r/AQD7//3//P////z//v/9//7//P////3////7/wEA/f/+//3/AQD9//7/AAD9//z//v8AAP7/+//+/wEAAAD8//z/AwAAAPz//P8CAAAA/f/8/wEAAAAAAP3/AAABAAEA/f8AAP//AwD///7//f8EAAIA/v/8/wQAAwD//wAABAACAAAAAwAGAP7///8BAAUAAQD+//7/AgAEAP//AAAAAAMAAQABAP//AgADAP3//f8AAAMA///+//z/AgAAAP3//P8CAP///f/+/wAA/P8AAP///f/8/wIA/v/8//3/AAAAAP///f/+/wEAAAD+//z/AQABAAAA/v/+/wAAAgD//wEAAAABAAEAAwD+////AQADAP////8AAAAA//8DAP/////+////AwD9//3//P8EAP///v/7/wEAAAD///7/AAD+/wQA/P////v/AgD7/wAA+f////z/AwD8//7//P8EAPz//v/9/wYA+f/+////BAD6/wEA//8CAP3/BAD9/wAA/v8DAPz/AAAAAAIA+/8BAAAAAAD7/wIA/f/9//z/AgD5//3/+P8BAPf/+//3////9//5//X//P/5//j/8//8//T/9//0//3/8P/5//b/+v/x//v/9P/3//T//P/x//j/9//7//L/9//6//3/8v/3//v//v/x//n//f/8//T/+//6//z/+P/8//v/+v/6//3/+//7//X//v/6//j/8//+//v/9//0//7/+P/0//f/AAD2//X/+f////f/9//6/wAA8//5//b//v/0//z/9P/7//L//f/z//j/8v/8//P/+f/x//n/8P/7//D/+f/x//v/8f/2//L//P/3//j/8v/9//b/+v/2//v/8v/+//n/9//x/wIA9v/5//P//f/2//v/9f/8//b////1//z/+P/+//f/AAD2//z/+f8BAPb//f/4/wAA9//+//r////5//7//P////n/AQD7//3/+v8FAPz/+//6/wMA/P/+//j/AQAAAAEA9/8BAAEAAQD9/wAAAwACAAUAAgADAAEABgAFAAYAAAADAAcACgD//wYABgAPAAEACwAFABAABAAQAAQAEgAFABEABAARAAgAEwAHABIACgAVAAcAFAAKABcABgAZAAkAGAAJABgABwAXAAkAFgAGABgABwAWAAgAHQAGABcACwAeAAgAGwAMACAABwAgAA0AIgAKACAACgAjAA0AHgAHAB0ADgAaAAcAFgAJABsABAAZAAYAGQADABwAAwAZAAQAFQACABgAAQASAAAAFQD+/xAAAQATAPv/DwADABAA+f8JAAIADQD6/woAAQANAPv/DAABAA4A/v8OAAMADQABAA0AAQAQAAUADgAEABEACAAOAAYADwALABEABwATAAsAFAAHABcADQAVAAoAGAASABUACgAVABMAGQALABcAEQAcABAAGQASABgAEgAWAA8AGQAQABYADgAWABEAEQAOAA0ADAAPAAoACwALAAsACQAGAAcACAAHAAQAAAADAAcAAgD7/wAABAD9//r//P/+//n/+f/4//r/9//5//X/8//1//f/8//y//H/9f/z//P/8//1//H/+P/w//X/9P/3//T/9v/y//b/9//3//L/+f/0//f/8P/4//P/9P/w//n/8//5/+3/9v/x//z/8P/3//D/+v/3//z/8f/8//P/AADz//n/8v8AAPX/+//w/wAA8f/9/+7////v//3/7P/9/+3////u//3/7P/+//L//f/t/wAA7v8AAPD/AADu//7/7//+//P////w/wEA8P8AAOv/AQDu/wAA5/8CAO3//P/u//7/7v/+//L/AgDw//v/9/8EAPP/+v/x/wMA8v/+//L/AQDy/wMA8v/9//T/AgDz////9v////L//v/5//3/9v8AAPj//P/+////9//9//3/AQD4////+P/9//n//f/1//v/9v/7//L/+v/v//r/7P/3/+z/+P/s//X/7v/y//D/9v/y//P/8f/2//P/8//u//X/7f/1/+r/8v/s//T/5P/v/+n/8v/o/+//6f/z/+3/9P/n//P/8P/3/+z/9P/x//v/8v/1//P//f/1//3/9P8DAPb////5/wQA+f8BAAEABQD7/wgAAgAJAPv/DQD//woAAgAQAAIACwALABIACQANAAkAFAAPAA8ABwAVABAADwAHABUADwATAA0AFwALABMADgAVAAoAEQANABEACgAQAA8ADAAIABEACAAOAAEACwAJAAsABwAIAAoACwAKAAoACwAJAA0ADAALAAgADwAHAA0ACQAQAAgADAAHABIACAAOAAQAFQAJABIABwAVAAgAGAAIABcABgAcAAkAHQAFAB8ACQAiAAYAIwAGACQACAAmAAQAIAAHACUAAwAcAAYAIwAHABkAAwAfAAcAGwAAAB4ACQAaAP//HQAGABUA//8bAAIAGAABABgA/v8WAAMAEAD8/xAAAwAIAPv/CwD//wgA+/8KAPz/CwD5/w0A+/8MAPn/CwD+/wQA+P8JAPn/AQD2/wUA9P8BAPj////y/wAA+P/3//T//v/2//b/9//+//X/+v/6////9f/8//r//P/2//j/+//5//n/9//8//H/+//0//z/9f/+/+7//P/4/wAA7//9//n/AwD4/wIA/P8IAP//BAAAAAsAAAAGAAIACwD+/wcAAgALAP3/CwD6/woA//8KAPj/CQAAAAsA+/8HAP3/CgABAAYA//8JAAMABgD8/wYAAgAEAPb/BwD9/wIA9P8EAPn/BgDy/wIA9f8FAPX/AgD7/wIA9/8FAPj/AQD7/wIA/v8CAAAABQABAAcAAAAHAAUACAAHAAcABgAKAAYABgABAAoAAAAHAAAABQAAAAYABAD//wEABQACAP3/+/8AAPj/+//0//n/9P/4/+7/9P/x//D/6//x//H/8v/t//D/7f/z/+z/6f/u//D/7f/r/+z/7f/l/+z/6f/r/+H/6v/l/+v/5P/i/+n/6f/q/+b/5v/o/+f/6//n/+b/6v/u/+z/5v/w/+z/8v/o//n/7P/3/+z/+P/r//f/7v/x/+r/8P/u//H/6P/4/+z/+f/v//v/8P/8//L/AwDx/wkA9/8MAPj/EwD8/xEA/v8ZAAEAFgADABQABQAXAAUAEwAHABcACQAYAAcAGwAPABoADQAcABAAGgAOABwADwAbAA8AHwASABcAEwAaABIAEgAUABMAEQASABEADQAPAA4ADgAKAAsADAAPAAMACQAIAAoAAAAIAAIABwD7/woA/v8FAP7/BAADAAUA/P8HAAAABQD3/wgA/f8FAPP/CAD1/woA9/8GAPj/CQD//wUAAQAHAAMABAAGAAsA//8GAAUACgD//wgAAAAJAP3/CQD8/wwAAQAFAAIACwAFAAEAAwAJAAcABAABAAcAAgAAAAMABAD9/wAABAAGAPr/AAACAP7///8BAAAA+//9/wEA/P/5//3/AQD4//r//f/9//r/+f/+//v/+//8//j//f/2//3/9v/8//b//P/2//r/9f/9//f//P/4/wEA+f/8//f/BAD7//v/+P8AAP3/+//7/wEA+/////z/AQD6////+/8CAPv/BAD7/wQA/v8CAP3/AwD9////+/8CAPz/+//6/wIA///4//r//v/+//j/+v/5////+//6//n//f/8//r/+v/9//z//P/7//z//f/+//v//v/7/wAA+v8AAP3/AAD7/////f/9//7//f////3//v8EAP7/BAD//wgAAgAIAP//DQD8/xAAAAANAAIACwAEAAYAAQAGAAEACAD+/wcAAAANAPv/CgABABIA/f8MAP7/FAD//xAA//8UAAMAFQABABMABgAXAAIADwAKABYA//8SAAcAFgACABcABgAOAAcAEQAKAAUADAAFAAcACAAFAAgACAAQAAYADQAPAA8ABAAQABAACgAKAAsADwADAAsAAgAOAAEACwD//w8A/v8MAAMACAABAAwACQADAAkACwAEAAgABwAIAP3/BwAJAAgAAQAJAAoACQAEAAgACAADAAYABgAAAAEAAgACAPr///8AAP3//P/7/wEA+v/9//n/BAD7//3/+f/+//3//f/5//z/+/8BAPn//v/7/wAA+//8///////9//j/AAD2////+f////b//v//////+v/9//n/BQD7////9f8FAPf/AgD1/wUA9/8HAPn/CQD2/wsA+v8MAPX/DgD4/wwA8/8RAPf/EAD3/xIA9/8SAPj/FwD0/xQA+/8bAPH/EwD7/xgA9v8YAPz/FgD+/x4A+v8YAP//HgD//xoABAAWAAcAHwAIABoACQAeAAsAHwAKABwACgAlAAgAHgAKABsADAAeAAoAFgAJABcADgAVAAwAEAAQABcACQARAA8ADgAPAAwAEQAIAA8ADAAOAAgADAALAAkABwAEAAUACgACAAMAAAAKAP7/AgD//woA+v8IAPn/CwD1/woA9/8IAPP/DAD1/wQA7f8OAPD/DgDs/xMA8v8RAO//CgDv/w0A6P8KAOn/CwDn/wkA6P8JAOL/CwDj/woA3/8KAOP/AgDb/wYA4f8AANn/AQDi//7/1/8BAN//AQDZ/wIA4P/9/97//P/f//r/4P/2/+H/9//g//X/4P/3/+D/9//j//L/4//z/+X/8f/n//X/4//1/+z/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7//1//L/8P/x/+//9v/v//j/6//5/+z/+//s//z/6f/9/+7/AADl/wEA8P8EAOT/BgDw/wkA5/8HAO//CwDt/wcA7/8LAPD/CADy/wwA8f8LAPb/DQD0/w0A+P8OAPv/DAD5/w4AAAAJAP3/CwAEAAkAAgAJAAcACgAIAAoACgALAA0ACwARAAoAEwAJABYACQAXAAkAGgAMABsACwAeAA0AHgAMACAACgAhAAkAJAAIACMABwAjAAsAIwAKACIADwAeAAsAJAAQABoACgAfAAoAGwAIABUABAAXAAgAEAADAA0ACAAJAAQABwAJAP//AgABAAgA9v/+//b/BADx//3/6//6/+f//f/j//L/3v/6/9z/8f/X//X/1f/w/9P/8P/S/+z/zP/u/9L/6v/I/+v/0f/p/8z/5//R/+j/0//m/9P/5//X/+n/2v/q/93/7P/j/+7/5P/x/+//8v/v//b/+v/6//z//P8EAAEABwAHABIABgASABMAIQAPAB4AGQArABsAKQAaADUAJgAxAB0APQAoADgAJQA+ACgAPQAuAD4AKQA+AC4AQAAoADkAKQA9ACYAMQAiADUAJgAnABoAKgAeABwAEgAfABMAEgALAA0ACQAHAAIA/P////v/+v/u//T/7v/w/+P/6P/e/+X/2v/c/9H/2v/S/9P/x//T/8r/zv/A/87/xf/N/8D/yv/A/87/xf/I/7//y//K/8v/xP/J/87/0P/K/87/1v/W/9f/1//f/9z/5v/d/+v/5//y/+j/9v/0/wEA9f8AAP7/EQACAA0ABAAbAAwAGgALACQAFAAkABcALAAbACsAIQAwACIAMQAoADQAJgAxACgANgAmAC4AJQAxACYAKwAjACgAIgAjAB8AIQAcABsAGwAWABcAEgASAAgAEAAHAAwA/P8JAPz/BQDw/wIA8P/7/+j/+v/k//T/4f/x/9v/8v/a/+3/1v/x/9b/8P/T/+z/1v/x/9T/6f/X/+z/2f/s/9v/6v/e//L/4v/z/+T/+f/s//n/8P/+//b//v8AAAMAAAAGAAwACgAOABIAFwATAB0AHgAkABoAKQAjADIAIQA0ACUAPQApADsAKgBEADQARAAtAEUAOABJAC4ARQA1AEgAKwBEADAAQwAmAD0ALQA7ACUAMwAkAC8AIAAoABoAIgASABkADgAUAAYABwD//wUA/f/2//f/9P/y/+b/8//m/+b/2P/r/9f/3f/O/+H/yP/Y/8f/2f+7/9j/vv/T/7j/1v+2/87/uP/T/7X/z/+3/9L/uP/Y/7r/1/+8/97/wv/h/8P/4//M/+f/0P/q/9X/6v/f//T/4v/y/+v//v/z//7/9v8IAAYACQAEABIAEgASABcAGAAbABoAKAAdACcAIAAwACMANQAlADYAKgA+ACcAPgAuAEMAKgBCAC4ARgAtAEIAKwBFAC4AQgAnAD8AKQA/ACIAOgAiADcAHgA0AB4ALQAcACoAGQAjABgAHgAVABoAEQARABAADgAIAAUACAAAAP//+v////P/+P/s//f/6v/1/+D/9f/f//L/1//z/9b/7v/R/+z/0P/r/8z/5v/K/+b/yf/l/8j/5//J/+T/yf/r/8n/4P/P/+v/zf/h/9P/6P/U/+X/2P/m/9z/6v/h/+f/5f/o/+v/7f/u/+b/9f/x//n/6v////L/BQD0/wgA8/8PAPr/EgD0/xgA+/8dAPX/HgD7/yQA+f8kAPz/KQABACoAAgApAAYALwAHACgACQAwAAkAKAAKAC0ACQAmAAwAJgALACQAEQAfAA4AIAAUABkAEwAXABUAEwAWABAAFQALABkACAAVAAQAGQD+/xIA/f8XAPf/EwD3/xEA7/8XAPP/DgDp/xgA7/8SAOf/FADs/xUA5v8QAOr/EADm/wsA6v8JAOn/BwDr/wUA7v8EAOv/AgDz/wQA8P8BAPT/AAD5//7/+P/7//7/+P/9//f/AgD0/wQA8/8GAPH/CQDt/woA7f8NAOv/EADr/w4A6/8RAOz/EADq/xMA6/8QAOn/EwDl/w4A6P8RAOT/CwDo/w8A6P8IAOn/CgDu/wYA7v8EAPP/AwD0////9v/8//r/+//6//f//P/4//3/8f////L/AwDt/wUA7/8GAOr/DQDr/wsA5/8SAOr/DgDm/xQA6f8PAOX/FwDq/w4A5/8VAOr/DQDq/xIA7f8PAO3/DwDw/xEA8f8MAPX/DQD5/wkA+f8FAP3/BgACAAAAAQADAAsA/P8GAP7/EAD7/xEA+P8SAPv/GAD1/xUA9/8cAPX/HADy/xsA8/8iAPD/GwDx/yIA7/8dAPH/HgDy/x8A8/8aAPb/HAD1/xcA+v8XAPf/FQD+/xAA+f8RAP7/CQD9/wsA/f8FAAMAAwADAP//BwD9/woA+v8HAPb/CwD2/wwA7/8LAPL/EgDr/wkA7P8RAOr/CQDp/wsA6P8KAOj/BwDm/w4A5f8IAOj/DwDj/wUA6/8JAOb/AQDs////6v///+v/+f/w//r/7P/4//X/9P/x//X/9f/x//n/8v/1//D////v//n/7/8BAOr//v/t/wIA5/8EAOr/AgDn/wgA6v8EAOj/CADu/wcA6f8IAPP/CQDs/wcA9P8MAPD/CADz/wsA9/8LAPb/CAD6/w4A/f8HAP//DgAFAAgABwANAAkACQANAAwADgAMAA8ACQATAA8AEQAIABgADwAUAAkAGgANABkACwAaAA0AHQAJABwACwAcAAoAHAAJABsACgAYAAgAFwAHABQACQARAAMAEAAHAA4AAQAKAAMACQAAAAUA/v8AAP7/AAD4//f//P/3//T/7//3/+//8//o//D/6f/v/+X/7f/k/+r/4v/p/9//6P/e/+X/2//k/9r/4//X/+D/2v/g/9b/4P/Z/97/1v/f/9r/3v/b/9//3//f/+D/3//j/+P/5v/h/+f/5v/r/+f/6//p/+7/7f/y/+7/9f/y//r/9v/8//j/AwD8/wYA/v8MAAMADQAIABIACQATAA8AFgASABgAEwAYABsAHAAYAB0AIAAeACAAIwAhAB8AJgAnACQAIAAnACYAKAAiACcAIAApACIAJwAZACcAHwAlABQAJgAaACAAEwAiABMAGQATAB8ADQASAA4AGQAIAAsABgASAAUABgAAAAgA/f8AAPz////2//r/+f/3//L/8f/2//H/8v/s//D/6v/y/+b/6P/k/+//4//n/9//6f/i/+j/2v/o/97/5//b/+r/2//n/9v/6v/c/+n/2//q/97/6//d/+v/3//t/+P/7P/j/+7/5//v/+f/8f/s//H/7P/0//H/9f/0//n/9v/5//n/+//9///////9/wMAAwAGAAAABQACAA8ABgAJAAMAEgAJAA8ABwARAAkAFgALABIACgAYAAsAFwANABcACgAbABEAFwALABsAEwAaABEAGAARABwAFwAWABEAHgAYABMAFAAdABgAEwASABoAGQATABAAFgAZABIAEwAUABYADgAVABEAFAANABQACwASAAwAEgADABIACwAPAP//DgAEAAoA/v8KAPv/BQD8/wgA9v8AAPb/BgD0//7/7v8AAPD//P/r//r/7f/4/+j/9P/o//X/5P/u/+b/8v/h/+3/4v/u/+L/6//e/+r/4//o/9v/6P/j/+b/3P/m/+T/5P/e/+P/4//k/+X/4P/i/+X/6v/h/+T/5//t/+T/6//p//D/6v/x/+z/9P/u//r/8f/3//P/AQD1//7/+P8GAPn/BQD5/wwAAQAKAP7/EgAHAA8ABwAWAAoAFwAOABoADQAZABAAIQARABoAEAAkABQAHQATACIAFAAgABQAIAAUAB8AFAAfABIAHQAPABsAEgAZAAoAGQARABIABgAXAA0ACAADABIABwADAAAACQD//////P////j/+v/3//X/9P/1//D/7v/x/+3/6P/r/+z/5P/m/+b/5v/e/+f/4f/j/9r/5//f/+L/1//l/97/4P/X/+b/3P/i/9n/5//c/+X/3//r/9z/6f/l//H/3//s/+r/9//l//X/8P/8/+z/AQD5//7/8/8KAAEABgD8/w8ACQARAAQAEgARABgADQAZABcAHAAXACEAGgAhACAAJQAhACUAJAAlACYAJgAqACUAJwAmAC4AJQAoACcALAAiAC0AJgAnAB8ALAAdACcAHQAmABQAJQAVACAADwAhAAsAGQAJABsAAwATAAEAEgD//w4A+f8HAPz/BgDy/wIA9f/8/+///f/w//L/7f/2/+3/7f/r/+3/6f/q/+n/5f/r/+X/6P/k//D/3//r/+L/8v/e/+//3v/z/+H/9f/e//j/4f/5/+D////i//7/4/8EAOb/AwDp/wcA6f8IAO3/DADu/wwA8v8QAPX/DgD3/xMA/P8TAP3/EgACABgABAASAAcAGgAJABMADgAZAA4AEQATABUAFAARABQAEAAYAA4AGAAOABgACgAcAAoAGAAGABoABgAbAAQAGAABABkAAAAZAPz/EwD9/xYA+P8RAPj/EAD0/xAA8v8JAPL/CwDs/wQA8v8FAOr////w/wEA7P/2/+3//v/u//D/6//5/+3/7f/q//H/7v/s/+v/7P/v/+n/7f/o//H/6P/v/+b/9P/p//D/5P/0/+r/9P/l//T/6//5/+f/9f/t//v/6v/6//H/+v/x/wEA8f/8//f/BQD3/wAA/P8FAP//BgD//wMABQAJAAQABAALAAYACgAIABAABgAPAAgAFAALABMACAAWAAwAGQAMABYACQAcAAwAGQAHABkACQAbAAYAFgAHABkABAAVAAcAFwAAABEABgAVAP7/DAACABEA/f8IAP//DAD8/wQA/v8GAPz/AAD7/wEA+v/7//n//P/4//n/9v/2//n/9f/4//H/+//x//j/7v/9/+7/+P/u//j/6//7/+3/9v/o////7//9/+b/AQDx/wUA6v8CAPH/CADw/wUA8/8JAPP/CAD4/wwA9/8KAP7/DQD7/wwAAgALAAEAEAAIAAkABgAUAAsADAAJABIADwAQAA8ADgAQAA8AFQAOAA8ACwAZAAoAEAAKABgACAATAAkAFgAHABUABgAVAAQAFAAEABIAAwAUAAAADwABABAA//8OAPr/CwD//woA+P8HAPz/BgD5/wEA+/8BAPj////5//r/9P/9//f/9f/1//f/9P/0//X/8v/z//P/9//w//T/8P/3/+//+P/w//r/7f/7//P//v/t//3/9f/+//D/AQD0////9v8DAPX/BQD8/wUA9/8JAP//CQD9/wsAAQANAAIADQAGABAAAwAMAAsAEQAFAAoADQARAAoACwAOAA8ACwANAA8ADQAMAAwAEQANAA4ACQANAA4AEQAHAAsACQAQAAkADAAAAA0ABwAKAPz/DQACAAMA/v8MAAEAAgD7/wYAAAAEAPn/AQD8/wIA9//+//r/AAD0//v/9v////T/+v/1//z/9f/8//b/+P/2//3/+v/4//f//f/+//v/+P/9//3//P/+/////f/+/wMAAQD/////BgAEAAQAAgALAAUACgAGABAABgAOAAkAEwALABEACQASAA4AEgALABQADQARAA4AFgAMABAADwAWAAwAEAAMABUADQAOAAoAEQALAA4ACQAKAAkADQAFAAEACAAHAAIA//8CAP//AgD9//3/+/8AAPf/+f/3//3/9P/2//L/+v/w//T/7//2/+r/8//r//P/6P/x/+j/7//n//L/5//t/+r/8P/p/+3/7P/v/+n/7//s//D/6v/w/+3/8P/t//L/8P/y//H/9P/1//X/9//2//f/+f/+//n/+//9/wMA+/8DAAAABAAAAAcAAgAGAAYACAAEAAoACAAJAAcADQAJAAwACwANAAkADwAPAA0ACgAOAA8ADgANAAsADAALAA8ACQAMAAgADAAHAA0ABQAKAAQACQADAAoAAwAGAAAACAD+/wQA/v8FAPn/AQD+/wMA9P/+//r////y//3/9v/7//L//P/0//f/8f/7//f/9f/y//f/+f/2//L/9v/5//X/8f/1//n/9f/z//L/+v/4//j/8P/7//j/+//z////9/////b/AgD3/wQA9/8FAPr/BgD7/wkA+/8IAP7/DQD8/wwAAAAOAAAAEwAEAA4AAwAVAAYAEAAGABQACQAUAAgAEwAKABQADQASAAoAEgAPABEADgARAAwAEAASABAADAARABIADQAPABAAEQAKABAADQAPAAcAEgALAA4ABAARAAYADwACAA0AAwAQAP7/CwADAA0A+/8MAAAACAD5/wkA/f8GAPj/BQD4/wQA9v8BAPT////z////8//7//D/+f/z//n/7v/0//L/9//t//D/7//0/+z/7f/u/+//6//t/+7/6v/s/+7/7//o/+r/6//y/+j/6v/p//T/6v/w/+n/9P/p//X/7P/0/+n/9//w//b/6f/4//P/+P/s//3/9v/4//H/AwD3//v/9/8FAPr////9/wcA/v8DAAAABwAEAAcABAAJAAcABwALAAwACQAIABAACwAMAAsAEwAKAA4ADAAVAAsAEQAMABYACgAUAAkAFAALABcABwASAAgAFgAEABEABwAUAAMAEAAEABAABAAOAAEADAACAAsA//8IAAAACAD+/wIA/f8HAP///f/7/wIA///6//v//f/9//j//P/4//3/9v/9//H//v/2//7/7v8AAPT//v/s/wAA8f///+3////u/wIA7v/+/+v/AwDw////6f8DAPL/AADr/wEA7/8CAO7/AQDw/wMA7v////T/AADw/wEA9P/9//P/AgD3//v/9P8BAPv//P/2/////f/8//r//f/+//v//v/9/wEA+f8AAPz/AwD4/wIA/P8FAPj/BAD9/wkA+f8DAP3/CwD7/wgA/f8JAPz/DgD//wcA/f8OAAEACwD9/wwAAgAMAP//CwACAA0AAAAIAAMADwADAAYAAwALAAQACgAEAAUAAwALAAQABAAFAAQAAQAGAAUAAAABAAQAAwD9//////8CAPv//v/+//7/9//+//v/+f/2//3/9v/2//b//P/z//T/9P/6//L/8v/w//f/8//z/+7/8//z//T/8P/y//D/8v/y//T/8f/v//L/9v/2//D/8v/3//r/8//1//n/+v/3//v//f/8//n//////wEA/P8DAAIAAwAAAAgABgAHAAUACgAJAAwADQANAAsADgAOABEAEAAQAA0AEwAUABIADQASABYAFAAMABIAFgASAA0AEQASABIADAANAA8AEQANAAoACwANAAsACAAHAAgABQAFAAQABAD+/wIA/P/+//r//P/1//n/9//4/+//9f/x//P/7f/w/+v/7//r/+3/5//r/+j/6v/l/+n/5P/n/+X/6P/i/+b/5//l/+P/6P/n/+X/5f/o/+r/6v/p/+j/7//t//D/7f/y//H/9//x//T/9//9//P/+f/9/wIA+v////7/BgADAAcAAAALAAgADAAHAA4ACgANAA4AFAALAA8AFAAWAAwAEwAVABUAEgAUABIAFgAXABUAEQAVABYAEwASABQAEwASABMAEAAQABAAEAAMAA8ADAALAAgADAAIAAgABQAIAAIABAADAAQA+////wAAAQD4//z/+f/7//f/+f/y//f/9f/2/+//9P/y//L/7//z//L/8P/u//H/8v/v//H/8P/w/+//8//x//P/8f/y//L/+f/x//X/8//7//T//P/2//z/9/8CAPn/AAD6/wMA/P8FAP3/BQD//wkAAQAIAAEACwAGAAsABAALAAgAEAAGAAsACgARAAkADQANAA8ACgAPAAwADAANAA4ACgAJAA8ACwAJAAgADQAHAAsAAwAIAAcACQAAAAgAAwAGAP//BgD+/wIA/v8EAPv//v/6/wIA9//7//b//P/2//v/8//1//T/+//y//L/8//1//H/8v/y//L/8v/x//L/8f/x/+7/8f/w//L/7//x//D/8//t//P/8f/3/+//9f/y//3/8P/3//T//v/1//z/9f////n//v/4/wUA+/8AAP7/BwD9/wYAAgAHAAIACwAEAAkABwAPAAcADgAKABIADAAQAAwAFgAQAA4ADwAaABAADwAUABgADwASABcAFAAQABIAFgATABIAEgAUABAAEwATABAACgAUABEADgAHABEACwAPAAYACQAIAA8AAwAFAAQADQACAAEA/f8JAP///v/5/wQA+//9//f//P/5//v/9f/6//f/9v/z//r/9v/y//H/9//2//H/8v/1//b/8f/0//P/9P/x//f/8v/0//H/+P/0//f/8P/6//f/+P/y//7/+P/9//T//v/8/wIA+P8AAP3/BAD9/wQA//8EAAEABwAEAAYAAwAHAAgADAAGAAYACwAOAAsACQAMAAwADwAOAA8ACgAQAA8AEQALABIADgARAAkAFQAMABAABgAVAAkADwAGABQABQAOAAUAEgADAAwAAQAOAAMACwD9/woA//8JAPv/BgD4/wUA/P8CAPP/AQD5//7/9f/8//T/+v/2//n/8v/3//X/9f/x//P/9f/z//H/8P/2//L/8//u//X/8f/1/+7/9//v//n/7//4//D/+//t//z/9P/9/+3//v/3/wAA8P8BAPj/AgD0/wMA+v8DAPj/BgD+/wUA/P8JAAAABQABAAsAAwAGAAQADQAHAAYABwAMAAkABwANAAkACAAIABIABgAJAAgAEwAEAAwABwAQAAQAEQACAA4ABgASAP//DgAFAA4AAQARAP//CwACABAA/f8LAP7/CwAAAAsA/P8JAP//BgD//wkA+/8DAAEABwD5/wEAAgADAPn/AQACAAAA/v8AAAAA/v8BAP7/AAD+/wMA/f8CAPz/BAD8/wUA/f8FAP3/BwD9/wcA/P8JAP3/CAD//w0A//8GAP//DgABAAsA//8KAAQADQACAAkAAwANAAYACwADAAwABwAKAAcACgAHAAoACQAIAAkACQAHAAUADAAKAAcAAQALAAoACgD//woABgAKAAAACQACAAkAAQAJAP//CQABAAgA/f8GAAAACAAAAAQA/f8IAAIAAQD9/wcAAQD//wEABwD///7/AwAFAP///f8EAAQAAAD8/wQAAQAFAP7/AgD//wYA/f8EAP7/BQD+/wYA/f8EAP3/BwD8/wUA/v8GAPz/BQD//wQA+/8FAAAABAD6/wMAAQADAPr/AQACAAEA/P8BAAEA///+//7/AAAAAAAA+///////AgD6/wAA/P8BAPr/AQD5/wEA+/8CAPf/AQD6/wIA9v8BAPn/AgD2/wMA+f8CAPb/AgD4/wMA9v8BAPn/BAD2/wEA+/8BAPj/AwD7/wAA+v8DAPz/AQD8/wMA/f////7/BQD/////AAACAAIAAwACAP//AgAEAAQAAAAEAAIABQACAAYAAQAHAAEABwACAAcAAAAJAAQABwD//wkAAgAJAAIACAD+/woAAwAHAAEABwD+/wgABQAFAPz/BQADAAQA//8EAAAAAQAAAAQAAAD//wAAAgD//wAAAAD+/wAA/v/+//v/AwD///v/+f8FAP3/+//5/wQA+//8//v/AgD5/////P8DAPf//v/+/wQA+P/9//z/BAD8/wAA+v8CAP//AAD7/wMA/v////7/BAD9/wEA/v8BAAEAAwD/////AAADAAIAAQAAAAEAAwAEAAQA//8BAAMABwACAAMAAAAHAAQABQAAAAQAAgAIAAMAAgD//woAAwABAAEACQD//wIABAAIAPz/AwADAAcA//8EAP//BAABAAQA/P8DAAIAAgD9/wMA/v8AAAAAAQD5////AQD+//v////9//7//P/9//v//v/9//r/+//8//v/+//8//j/+f/6//7/+P/3//f//v/5//j/9f/7//r/+//1//r/+v/8//b/+v/4//3/9//6//n//v/2//z/+v/8//X//f/6//7/9//7//j/AAD5//z/+f/+//n////8//7/+v////7//f/8/wIA/f/7//3/BQD///3//f8BAAIAAAD/////AQACAAMA//8CAAMAAgD+/wYAAwAAAP7/BwAEAAEA/v8GAAQAAQD9/wcABAAAAP3/CAACAAEA//8FAP//AwD//wIAAAAEAPz/AAAAAAQA/f/+//z/AwAAAPz/+v////7//f/7//z//P/9//v//P/8//r/+f/9//z/9v/5//z/+v/2//n/+//5//f/+v/4//b/9//8//r/9f/0//r/+//3//P/+f/8//f/9v/4//r/+P/4//j/+P/4//z/+f/6//X/+v/8//7/9//4//r/AAD7//v/9//+//3/AAD3//z//v8DAPn//f/9/wIA/P/+//v/AQD+/wAA/P8CAPz//////wMA/P8AAAAAAQD//wEA/P/9/wIABAD6//z/AwADAP7//P/+/wEAAQD+//7//P//////AAD7//7//f8BAP3//P/6/wIA///7//r/AQD///7/+f/8//7/AAD6//v///////r//v////v/+////wEA+//8//7/AwD9//r//f8FAP3/+//9/wYA/v////z/BAD+/wQA/P8CAP//BQD9/wMA/v8GAP7/BQD8/wUAAQAGAPv/BAABAAcA/P8EAP//BQD//wQA/P8EAAAABAD8/wQA//8CAP7/AwD9/wMA/v////3/AwD+//z//f8BAP3//f/9////+//8/////f/7//7//P/6//z//v/9//r/+v/8/wAA+//4//z////4//v//v/+//n/+//7/wAA/f/7//n/AAD///7//P/+//z/AQAAAP7//v8DAP////8BAAMA/v8AAAMABAABAAIABAADAAUABQAEAAMABwAHAAUABgAKAAQABQALAAwAAgAGAAwACwAGAAkABwAJAAsACgAEAAkACwAJAAQACwAKAAYABAAMAAkABgACAAkABwAHAAMABgAEAAMAAwAHAAAAAAADAAMA/v8AAAEA///+/wAA/f/9/////v/5//z/AAD6//j//P/8//j/+f/7//n/+P/6//n/+f/2//b/+v/8//b/9P/4//3/+P/1//j/+v/6//r/+v/4//r//v/8//n/+v/9/////v/7//v/AAACAP///f8CAAIAAQAAAAUAAwAEAAIABgAGAAcAAgAHAAkACQACAAcACwAMAAQABwALAAwABwALAAkACQAIAA4ACgALAAgACwAKAA0ACAAKAAgADQAJAAoABwAKAAgACQAHAAkABQAGAAcACAADAAQABgAHAAIABAADAAIAAwADAAAAAAADAAEA/v/9/wAA///+//z////8//v/+/////r/+//6//z/+P/9//n/+f/5//7/9//7//z/+//1/////f/6//f//v/7////+//7//r/AgD///z/+/8DAAAA/v8AAAQAAAAAAAIABAADAAMAAgAEAAgABgAAAAQACAAHAAUABgAGAAYACAAGAAcACAAIAAUACQAJAAoABgAHAAcACwAGAAgACAAJAAQACAAIAAcAAwAHAAUACQAEAAMABAAHAAEABQADAAIAAQAGAAIAAAD//wMAAAADAAAA/P///wMA/v/7/wAAAQD6//z/AgD///r/+/////3//f/9//z/+f8BAP//+v/6/wAA/P/+//3//P/6/wQAAAD6//n/AwAAAP//+v8AAAIAAgD8/wEAAQACAP//AgAAAAUAAwABAAAABgACAAMABAAGAAEABAAGAAcAAwACAAYACgAEAAIABQAKAAgAAwACAAkACwAEAAIACQAIAAMABgALAAUAAQAHAAoABgADAAcABgAFAAUABgAFAAUABgAFAAMAAwAGAAcAAgD//wUACAAEAP//AgAFAAgA///+/wMACAD/////AwAFAP//BQADAAEA/f8GAAIAAgD+/wMA/f8GAAIAAgD6/wQAAgAEAPv/AgAAAAQA/P8EAP//AQD+/wcA/f/+/wAABwD9/wEAAAADAP//BQAAAP//AQAHAP///v8EAAcA/v/+/wMABwACAP//AgAFAAQAAAAFAAUAAQABAAgABQADAAEABQAFAAcAAwAEAAMABwAGAAcAAgAGAAYACAAEAAcABQAGAAYACAAEAAMABgAKAAUAAQAFAAkABQABAAUABgAFAAIABAADAAUAAgADAAAABAADAAIA/v8FAAMAAAD7/wUAAgAAAPr/AwD//wEA+f8AAP3/AgD4/////f8AAPX/AAD///3/8v8AAAAA/v/x//7//v/+//T//v/7//7/9v/9//r////4//v/+v8AAPr//P/6/wAA+//8//z/AAD8//7//v8AAP7/AAD+/wAAAQABAAAAAAABAAMAAQACAAEAAgAFAAIAAQADAAkAAwAAAAUACgACAAIABQAHAAQABQAFAAUABQAFAAUABgAEAAQABQAEAAQABQAEAAAABQAFAAMA//8EAAIAAgD//wIA/v8EAAAA/v/8/wUA/v/8//z/AwD6//7//f////j//v/9////+P/7//r/AAD5//v/9//9//v//P/1//z/+//7//f//f/6//n/9//+//z/+v/4//z//f/8//n/+//9//3/+//9//3/+//9/wAA/f/6////AwD///r///8CAAAA/f///wEAAgACAP////8DAAEAAAACAAIAAAACAAMAAQABAAMAAgD//wIABAABAP//AwACAP//AQAFAAAA/v8CAAMA/////wAAAgD+//7//f8EAP7/+f/8/wUA/f/5//3/AQD9//z/+v/+//z//P/6//7/+v/7//3//f/4//r//P/9//n/+//9//z/+P/8//3/+v/5//3/+//6//3//f/7//3//f/6//3////+//r//f8AAAAA/P////3//v8BAAIA+//9/wIABgD9//7/AAAHAAAA/////wQAAQADAP//AgADAAMA/f8BAAQAAwD9/wIAAwABAP7/AgACAP///f8BAAMA///7//3/BAABAPr/+/8CAP7//P/6//3/+v8AAPz/+f/3/wAA+//5//f//P/6//z/9v/5//r/+//1//v/+f/4//T//P/2//b/9v/6//X/+P/2//n/9v/4//b/+P/2//f/9//6//b/9//4//r/+P/3//b/+P/5//n/+f/4//j/+f/6//v/+v/2//j//P/+//j/+P/6/wAA/P/5//j/AAD+//z/9//7/wAAAwD4//f///8EAPv//P/8/wAA/v8AAPz/AgAAAP3//P8EAAAA///9/wIA//8AAAAAAwD9////AQAEAP7///8AAAEA/v8AAAEA///8/wEAAgD9//z/AQD+//3//v8AAP7//f/8///////7//n//P8AAP3/+P/6/////P/4//r//v/7//j/+//8//r/+f/5//v/+//5//j/+//7//j/+P/7//n/+P/7//n/9//6//3/+P/2//n//f/5//b/+P/+//r/9v/4////+f/3//n//f/6//r/+f/6//n//f/6//v/+f/9//v/+//6/wEA+v/6//z/AgD5//3//f/+//r/AgD+//7/+f8BAP/////6/wMA//////z/BAD/////+/8DAAEAAQD8/wIAAAABAP7/AwD+/wEAAgAEAPv/AAAEAAMA/P8BAAIAAQAAAAIA//8BAAEAAAD//wQAAgD+//7/AwACAP///v/+/wMAAQD8//z/AwABAPv//f8CAAAA/v/+//3//v8BAP///P/+//7//v////7//f/+//7//P/+/wEA/P/9////AAD8//3///8BAPz//f/+/wMA/P/+////AgD8//////8EAPz////+/wIA//8CAPv//f8CAAYA+v/8/wEABwD9//7//f8FAAEA///7/wEAAQACAPz//v///wMA///8//z/AgABAP3/+/8AAP7//v///wAA+//+/wEA/v/8/////f/8////AQD6//v/AQD///v//f/+//z//f////z/+//+/////P/7//7/AAD7//3////9//v/AAD///r//P8BAP7//f/8////AAAAAPr///8DAAIA+v8AAAMAAQD8/wMAAQABAAAABAD//wEABAAEAP7/AwADAAUAAgAEAAAABAAEAAQAAgAGAAEABAAEAAcAAQAEAAQABgABAAYABAAFAAAAAwAFAAYAAAACAAMABQACAAMAAQACAAIAAgD//wQAAwD///7/AwADAP7//P8CAAMA/f/9/wIAAAD8////AgD9//7/AgD///v///8CAP7/+v8AAAMA///7/wAAAwD///r/AQAEAAAA+/8BAAMAAgD//wEA//8EAAMAAwD+/wUABAAEAAAABwAEAAQAAQAJAAQABQACAAcABgAGAAEACQAIAAcAAAAKAAkABwACAAkABwAJAAMACQAHAAgAAwAJAAcABgAEAAkABAAFAAYABwADAAUABAAHAAMAAwAEAAgAAgABAAMABgACAAMAAgADAAEABAABAAAAAgACAP//AAACAAAA/v///wEA///+//3/AAAAAP///P/+/wAA///8//7///////7/AAD8//7///8BAP7//v/8/wEAAQD///v/AQD//wAA//8CAP7/AQABAAIA/P8CAAQAAgD8/wIABQAEAP7/AwADAAQAAgADAAEABQAEAAMAAQAGAAQAAgADAAcAAwABAAMACAAEAAIAAQAEAAQABgABAAEAAgAFAAMABQAAAP//AwAHAP////8CAAQAAAACAAEAAAABAAIA/v8CAAIA/v/9/wUAAQD8//7/AwAAAAAA/f///wEAAwD+//3///8DAAEA///9/wMAAwAAAP//AwABAAAAAgAGAAAAAAAEAAYAAAACAAUABgACAAQABAAGAAQABQACAAcABwAFAAIABwAHAAgABQAFAAQACgAIAAUAAwAJAAgABwADAAcACAAHAAMACAAHAAYAAwAGAAUABwAEAAUAAwAFAAMABgAEAAMAAQAEAAYABAD//wEABAAFAAIA//8BAAQABAAAAP//AQADAAAA//8AAAQA/////wIAAwD9/wAAAAABAP//AQAAAAAA/f8BAAEAAwD9//7/AQAFAP3//f8BAAYA/////wAABAACAAEA/f8BAAUABAD+/wEABAAEAAEAAQAEAAQAAQACAAYAAwAAAAMACAACAAEABAAIAAEAAwADAAYAAQAFAAQABAABAAcABAAEAAAABgAEAAQAAQAGAAUABAAAAAYABQAEAP//BQAEAAQAAQAFAAEAAwADAAQAAAADAAQABAAAAAIABQAFAP//AAAGAAQAAQACAAIAAgAGAAIA//8DAAUAAQACAAIAAQABAAQAAgABAAAAAgAEAAMA//8BAAMAAgABAAMAAgD//wIABgABAP3/AwAFAAAA/v8FAAIAAAD//wQAAgACAP//AQABAAQA//8BAAAAAwD//wMAAAACAP//BAD+/wEAAAAEAP//AQD9/wUAAgAAAPv/BQACAP///v8FAP//AAABAAMA/f8BAAIAAwD9/wAAAwAEAP////8AAAUAAQD+////BQAEAP3///8GAAQA/f8AAAUAAgAAAAMAAQD//wIABAD/////AgADAAIAAQD//wAAAgAFAAEA/f8AAAUAAgD+/wEAAgAAAAAAAgABAAEAAAABAAAAAQD//wMAAQD///7/AwACAAAA//8CAAAAAgAAAAAA//8DAAEA///+/wQAAQD///3/BAAAAP3///8EAP3//v8CAAMA+////wMAAwA=", KA = se, De = ne, IA = 5, Pe = 7e-4, MA = 0.018, pA = 0.012, aA = 6e-3, AA = 0.985, oA = 0.95, BA = 4, ae = 90, oe = 48, iA = null, Be = 8, ge = 2, R = /* @__PURE__ */ new Map(), O = /* @__PURE__ */ new Map(), J = [], sA = 0, mA = 0.16;
function H(A, e, t, i) {
  return {
    key: A,
    start: e - mA,
    end: t - mA,
    trim: i
  };
}
var ve = {
  lift: H("lift", 0.178, 0.325, 2.65),
  micro: [
    H("micro-a", 0.185, 0.205, 2.9),
    H("micro-b", 0.282, 0.322, 2.8),
    H("micro-c", 0.407, 0.44, 2.75),
    H("micro-d", 0.483, 0.565, 2.65),
    H("micro-e", 0.603, 0.698, 2.55),
    H("micro-f", 0.724, 0.92, 2.45)
  ],
  body: [
    H("body-a", 0.94, 1.126, 0.64),
    H("body-b", 1.352, 1.446, 0.7),
    H("body-c", 1.558, 1.708, 0.68)
  ],
  accent: [H("accent-a", 1.222, 1.292, 0.58), H("accent-b", 1.574, 1.715, 0.62)],
  finish: H("finish", 1.73, 1.795, 0.72)
};
function M(A, e, t) {
  return Math.min(t, Math.max(e, A));
}
function zA(A, e, t) {
  const i = M((t - A) / (e - A), 0, 1);
  return i * i * (3 - 2 * i);
}
function T(A, e) {
  return A + Math.random() * (e - A);
}
function Qe(A) {
  const e = Array.from({ length: A }, (t, i) => i);
  for (let t = e.length - 1; t > 0; t -= 1) {
    const i = Math.floor(Math.random() * (t + 1));
    [e[t], e[i]] = [e[i], e[t]];
  }
  return e;
}
function xA(A) {
  return 10 ** (A / 20);
}
function eA(A) {
  return 2 ** (T(-A, A) / 12);
}
function HA() {
  return M(-Math.log(Math.max(1e-3, 1 - Math.random())), 0.55, 1.8);
}
function FA() {
  return typeof performance > "u" ? Date.now() : performance.now();
}
function tA() {
  if (iA) return iA;
  if (typeof window > "u") return null;
  const A = window.AudioContext ?? window.webkitAudioContext;
  if (!A) return null;
  try {
    iA = new A({ latencyHint: "interactive" });
  } catch {
    return null;
  }
  return iA;
}
function W() {
  return new DOMException("Audio load was evicted.", "AbortError");
}
function cA() {
  for (let A = J.length - 1; A >= 0; A -= 1) {
    const e = J[A];
    e.load.invalidated && (J.splice(A, 1), e.encoded = null, e.reject(W()));
  }
  for (; sA < ge && J.length > 0; ) {
    const A = J.shift();
    if (!A) return;
    if (A.load.invalidated) {
      A.encoded = null, A.reject(W());
      continue;
    }
    const e = A.encoded;
    if (A.encoded = null, !e) {
      A.reject(W());
      continue;
    }
    sA += 1;
    let t;
    try {
      t = A.context.decodeAudioData(e);
    } catch (i) {
      sA -= 1, A.reject(i);
      continue;
    }
    t.then((i) => {
      if (A.load.invalidated) {
        A.reject(W());
        return;
      }
      A.resolve(i);
    }, (i) => A.reject(i)).finally(() => {
      sA -= 1, cA();
    });
  }
}
function fe(A, e, t) {
  return t.invalidated ? Promise.reject(W()) : new Promise((i, r) => {
    J.push({
      context: A,
      encoded: e,
      load: t,
      resolve: i,
      reject: r
    }), cA();
  });
}
function he(A) {
  A.invalidated || (A.invalidated = !0, A.settled || A.controller.abort(), cA());
}
function Ee() {
  for (; O.size > Be; ) {
    const A = O.keys().next().value;
    if (typeof A != "string") return;
    O.delete(A);
    const e = R.get(A);
    !e || e.pinned || e.references > 0 || (R.delete(A), he(e.load));
  }
}
function LA(A, e) {
  let t = R.get(A);
  if (!t) {
    const w = {
      controller: new AbortController(),
      invalidated: !1,
      settled: !1
    }, n = fetch(A, { signal: w.controller.signal }).then((D) => {
      if (!D.ok) throw new Error(`Peel audio request failed with ${D.status}.`);
      return D.arrayBuffer();
    }).then((D) => {
      if (w.invalidated) throw W();
      return fe(e, D, w);
    }).finally(() => {
      w.settled = !0;
    });
    t = {
      promise: n,
      references: 0,
      pinned: A === KA || A === De,
      load: w
    }, R.set(A, t);
    const s = t;
    n.catch(() => {
      R.get(A) === s && (R.delete(A), O.delete(A));
    });
  }
  t.references += 1, O.delete(A);
  const i = t;
  let r = !1;
  return {
    src: A,
    promise: i.promise,
    release: () => {
      r || (r = !0, R.get(A) === i && (i.references = Math.max(0, i.references - 1), !(i.references > 0 || i.pinned) && (O.delete(A), O.set(A, !0), Ee())));
    }
  };
}
function b(A, e, t, i, r = 1) {
  return {
    key: A,
    start: e * t,
    end: e * i,
    trim: r
  };
}
function ce(A) {
  return {
    lift: b("lift", A, 0.02, 0.18, 1.2),
    micro: [
      b("micro-a", A, 0.12, 0.32, 1.05),
      b("micro-b", A, 0.28, 0.48, 1),
      b("micro-c", A, 0.44, 0.62, 0.95)
    ],
    body: [
      b("body-a", A, 0.32, 0.56, 0.9),
      b("body-b", A, 0.52, 0.76, 0.86),
      b("body-c", A, 0.7, 0.88, 0.82)
    ],
    accent: [b("accent", A, 0.58, 0.78, 0.82)],
    finish: b("finish", A, 0.8, 0.98, 0.9)
  };
}
var le = class {
  constructor() {
    this.enabled = !1, this.src = "", this.volume = 0.7, this.useBuiltInProfile = !1, this.buffer = null, this.bufferLease = null, this.reappearBuffer = null, this.reappearBufferLease = null, this.profile = null, this.loadRevision = 0, this.masterGain = null, this.compressor = null, this.activeVoices = /* @__PURE__ */ new Set(), this.gestureActive = !1, this.lastProgress = 0, this.lastUpdateTime = 0, this.smoothedVelocity = 0, this.smoothedAcceleration = 0, this.forwardTravel = 0, this.backwardTravel = 0, this.nextForwardSpacing = 6e-3, this.nextBackwardSpacing = 0.025, this.liftArmed = !0, this.finishArmed = !0, this.fullyDetached = !1, this.lastAccentTime = -1 / 0, this.holdTimer = null, this.panWalk = 0, this.lastSliceKey = "", this.sliceBags = {
      micro: [],
      body: [],
      accent: []
    }, this.destroyed = !1;
  }
  configure(A) {
    if (this.destroyed) return;
    const e = A.src.trim(), t = !!A.useBuiltInProfile, i = e !== this.src, r = t !== this.useBuiltInProfile;
    if (i && (this.bufferLease?.release(), this.bufferLease = null), this.enabled = A.enabled && !!e, this.src = e, this.volume = M(A.volume, 0, 1), this.useBuiltInProfile = t, this.masterGain && this.masterGain.gain.setTargetAtTime(this.volume, this.masterGain.context.currentTime, 0.012), (i || r) && (this.reset(0), this.buffer = null, this.profile = null, this.loadRevision += 1), !this.enabled) {
      this.reset(this.lastProgress);
      return;
    }
    this.buffer || this.preload(), this.reappearBuffer || this.preloadReappear();
  }
  unlock() {
    if (!this.enabled || this.destroyed) return;
    const A = tA();
    A && (A.state === "suspended" && A.resume().catch(() => {
    }), this.buffer || this.preload(), this.reappearBuffer || this.preloadReappear());
  }
  begin(A, e = FA()) {
    this.clearHoldTimer(), this.gestureActive = !0, this.lastProgress = M(A, 0, 1), this.lastUpdateTime = e, this.smoothedVelocity = 0, this.smoothedAcceleration = 0, this.forwardTravel = 0, this.backwardTravel = 0, this.nextForwardSpacing = T(4e-3, 8e-3), this.nextBackwardSpacing = T(0.018, 0.032), this.lastAccentTime = -1 / 0, this.panWalk = 0, this.stopVoices(/* @__PURE__ */ new Set(["texture", "reattach"]), 0.012), this.lastProgress <= aA && (this.liftArmed = !0), this.lastProgress < oA ? (this.fullyDetached = !1, this.finishArmed = !0) : this.lastProgress >= AA && (this.fullyDetached = !0, this.finishArmed = !1);
  }
  update(A, e = FA(), t = 0) {
    const i = M(A, 0, 1);
    if (!this.gestureActive) {
      this.begin(i, e);
      return;
    }
    const r = this.lastProgress, w = Math.max((e - this.lastUpdateTime) / 1e3, 0), n = i - r;
    if (this.lastProgress = i, this.lastUpdateTime = e, i <= aA && (this.liftArmed = !0), i < oA && (this.fullyDetached = !1, this.finishArmed = !0), Math.abs(n) < Pe) {
      const Q = Math.exp(-Math.min(w, 0.12) / 0.045);
      this.smoothedVelocity *= Q, this.smoothedAcceleration *= Q;
      return;
    }
    this.armHoldSilence();
    const s = M(w || 1 / 60, 1 / 240, 0.25);
    w > 0.14 && (this.smoothedVelocity = 0, this.smoothedAcceleration = 0);
    const D = n / s, P = this.smoothedVelocity, a = 1 - Math.exp(-s / 0.045);
    this.smoothedVelocity += (D - this.smoothedVelocity) * a;
    const o = (this.smoothedVelocity - P) / s, v = this.smoothedAcceleration, l = 1 - Math.exp(-s / 0.075);
    this.smoothedAcceleration += (o - this.smoothedAcceleration) * l;
    const h = Math.abs(D) * 0.52 + Math.abs(this.smoothedVelocity) * 0.48, c = M(Math.log1p(8 * h) / Math.log(13), 0, 1);
    this.panWalk = M(this.panWalk + T(-0.018, 0.018), -0.05, 0.05);
    const B = M(t * 0.08 + this.panWalk, -0.12, 0.12);
    if (this.fullyDetached && i >= oA) {
      this.forwardTravel = 0, this.backwardTravel = 0, this.stopVoices(/* @__PURE__ */ new Set(["texture", "reattach"]), 0.01);
      return;
    }
    if (n > 0 && h >= MA) {
      if (this.stopVoices(/* @__PURE__ */ new Set(["reattach"]), 0.012), this.liftArmed && r <= pA && i >= pA && (this.playLift(c, B), this.liftArmed = !1), this.finishArmed && r < AA && i >= AA) {
        this.playFinish(c, B), this.finishArmed = !1, this.fullyDetached = !0, this.forwardTravel = 0, this.backwardTravel = 0;
        return;
      }
      if (!this.fullyDetached) {
        this.forwardTravel += n;
        const Q = M(h / (6 + 44 * c ** 0.75), 32e-4, 0.035);
        let f = 0;
        for (; this.forwardTravel >= this.nextForwardSpacing && f < 2; ) {
          const C = zA(8e-3, 0.035, i) * (1 - 0.28 * zA(0.86, 0.98, i));
          this.playTexture(c, C, B), this.forwardTravel -= this.nextForwardSpacing, this.nextForwardSpacing = Q * HA(), f += 1;
        }
        f === 2 && this.forwardTravel >= this.nextForwardSpacing && (this.forwardTravel = 0);
      }
      if (v <= BA && this.smoothedAcceleration > BA && c > 0.2 && e - this.lastAccentTime >= ae && i < AA) {
        const Q = M((this.smoothedAcceleration - BA) / 8, 0, 1);
        this.playAccent(c, Q, B), this.lastAccentTime = e;
      }
      this.backwardTravel = 0;
      return;
    }
    if (n < 0 && h >= MA) {
      this.stopVoices(/* @__PURE__ */ new Set(["texture"]), 0.014), this.backwardTravel += -n;
      const Q = M(h / (2 + 12 * c ** 0.8), 8e-3, 0.07);
      let f = 0;
      for (; this.backwardTravel >= this.nextBackwardSpacing && f < 1; )
        this.playReattach(c, B), this.backwardTravel -= this.nextBackwardSpacing, this.nextBackwardSpacing = Q * HA(), f += 1;
      f && this.backwardTravel >= this.nextBackwardSpacing && (this.backwardTravel = 0), this.forwardTravel = 0;
    }
  }
  end(A) {
    this.clearHoldTimer(), this.gestureActive = !1, this.lastProgress = M(A, 0, 1), this.smoothedVelocity = 0, this.smoothedAcceleration = 0, this.forwardTravel = 0, this.backwardTravel = 0, this.stopVoices(/* @__PURE__ */ new Set(["texture", "reattach"]), 0.016);
  }
  playReappear() {
    if (!this.enabled || this.destroyed) return;
    const A = tA(), e = this.reappearBuffer;
    if (!A || !e || this.activeVoices.size >= IA) {
      e || this.preloadReappear();
      return;
    }
    const t = A.currentTime + 2e-3, i = e.duration, r = A.createBufferSource(), w = A.createGain(), n = 0.82, s = Math.min(4e-3, i * 0.12), D = Math.min(0.025, i * 0.2);
    r.buffer = e, w.gain.setValueAtTime(0, t), w.gain.linearRampToValueAtTime(n, t + s), w.gain.setValueAtTime(n, Math.max(t + s, t + i - D)), w.gain.linearRampToValueAtTime(0, t + i), r.connect(w), w.connect(this.ensureOutput(A));
    const P = [r, w], a = {
      source: r,
      gain: w,
      nodes: P,
      kind: "reappear"
    };
    this.activeVoices.add(a), r.addEventListener("ended", () => {
      this.activeVoices.delete(a);
      for (const o of P) o.disconnect();
    }, { once: !0 }), r.start(t);
  }
  reset(A = 0) {
    this.clearHoldTimer(), this.gestureActive = !1, this.lastProgress = M(A, 0, 1), this.lastUpdateTime = 0, this.smoothedVelocity = 0, this.smoothedAcceleration = 0, this.forwardTravel = 0, this.backwardTravel = 0, this.liftArmed = this.lastProgress <= aA, this.fullyDetached = this.lastProgress >= AA, this.finishArmed = !this.fullyDetached, this.lastAccentTime = -1 / 0, this.stopVoices(void 0, 0.012);
  }
  stop() {
    this.clearHoldTimer(), this.gestureActive = !1, this.stopVoices(void 0, 0.012);
  }
  destroy() {
    this.destroyed || (this.destroyed = !0, this.loadRevision += 1, this.stop(), this.masterGain?.disconnect(), this.compressor?.disconnect(), this.masterGain = null, this.compressor = null, this.buffer = null, this.bufferLease?.release(), this.bufferLease = null, this.reappearBuffer = null, this.reappearBufferLease?.release(), this.reappearBufferLease = null, this.src = "", this.profile = null);
  }
  preload() {
    const A = tA();
    if (!A || !this.enabled || !this.src || this.destroyed) return;
    (!this.bufferLease || this.bufferLease.src !== this.src) && (this.bufferLease?.release(), this.bufferLease = LA(this.src, A));
    const e = this.bufferLease, t = ++this.loadRevision;
    e.promise.then((i) => {
      this.destroyed || t !== this.loadRevision || (this.buffer = i, this.profile = this.useBuiltInProfile ? ve : ce(i.duration), this.sliceBags = {
        micro: [],
        body: [],
        accent: []
      });
    }).catch(() => {
      this.bufferLease === e && (e.release(), this.bufferLease = null);
    });
  }
  preloadReappear() {
    const A = tA();
    if (!A || !this.enabled || this.destroyed) return;
    this.reappearBufferLease ?? (this.reappearBufferLease = LA("data:audio/wav;base64,UklGRpD2AABXQVZFZm10IBAAAAABAAIAgLsAAADuAgAEABAAZGF0YWz2AAD///3//v///wAA+//+/wEAAAD7//7//v//////AAD8//3/AAABAPv//P8AAAIA+//8/wEAAgD7//z///8CAP7//P/9/wMA/v/8////AgD9//7///8AAP7/AAD9//7/AAACAP7//f/+/wIAAAD+//3///8BAAIA/f/9/wAAAgD+//7/AQAAAP7/AAAAAP7//v8CAAAA/P///wEAAQD+//3///8CAAIA/P/8/wMAAwD9//v/AgAEAP7//P8AAAIAAgD///3///8DAAIA/v///wIAAgAAAAEAAQAAAP//AwAEAP////8FAAIA//8BAAQAAQABAAIAAgACAAMAAAABAAMAAwABAAIAAgACAAEAAwACAAEAAQAEAAMA//8BAAYAAgD//wIAAwABAAEAAwACAAAAAQACAAIAAQACAAEAAAACAAQAAQD+/wEABAACAP3/AAAHAAIA+////wcABAD+//3/AQAFAAMA/v/+/wIAAgAAAAEAAQABAP7/AAAEAAEA/f8BAAMAAAD+/wMAAgD9////BQABAP7/AAADAP//AAACAAAA/v8CAAIAAAD//wIAAQAAAP//AgAAAP//AAAEAAEA/v///wMAAgD///3/AgAEAAEA/P8AAAQAAgD9////AwACAP7/AAACAAEAAAAAAAAAAQAAAP//AQABAP//AQAEAP7//f8DAAIA/P8AAAMAAAD+/wMAAAD+/wIAAwD9////AwADAP////8AAAMAAgAAAP//AwABAAAAAgADAP7///8DAAUA///+/wIABAABAAEA//8CAAQAAQD+/wMABQAAAP//BAACAAAAAgADAAEAAgACAAIAAQACAAMAAgAAAAEAAwADAAIAAQAAAAMABQAAAP7/BQAGAP3///8IAAQA+/8BAAgAAQD9/wQABQAAAP//AwAEAAAAAQABAAEAAwADAP//AQADAAEAAAADAAAA//8DAAQA/v8AAAQAAgD9/wIAAwABAP//AQABAAIAAQABAAAAAgABAAEAAQACAAEAAAAAAAQAAgD//wEAAwACAAEAAQABAAIAAwACAP//AQAEAAMAAAADAAIAAQABAAMAAgADAAIAAQAAAAMABAACAP//AQADAAMAAQACAAEAAAACAAUAAgD+/wAABgADAP7///8GAAUA/v/+/wYABgD///3/AwAGAAMA//8BAAMABAADAAEAAAADAAQAAwAAAAMABAADAAEABAAEAAMAAAAEAAYABAD+/wMACAAGAP7/AwAGAAYAAQACAAQABgACAAIABAAGAAEAAwAFAAYAAgACAAMABwAEAAIAAAAFAAYAAwABAAUABQAEAAEABAAEAAUAAgACAAQABwABAAIABgAGAP//AgAGAAYAAgABAAEABwAGAAAA//8IAAUAAAABAAQABAAEAAEAAgAEAAQAAAADAAMAAgADAAUAAAABAAYAAwD+/wMABAACAAEABAACAAAAAwAEAP//AAAGAAQA/f///wgABAD8/wEABQABAAEAAwABAP7/BAAGAP///f8EAAYAAAD+/wIAAgACAAMAAQD+/wIABAABAP7/AAADAAMA///+/wIABAD/////AgABAP7/AQACAAAA/v8BAAIAAAD+/wIAAQD+//7/AwACAP///v8CAAEA///+/wIAAQD///7/AgACAAAA/P8BAAMAAAD8/wIAAwD///3/AwABAP////8CAAEAAAD//wIAAgABAP7/AQACAAIA/////wAAAwABAAEA//8AAAEABAD/////AQAAAP//BAACAP3///8FAAEA/v8AAAIAAQABAAAAAAABAAIAAAD//wAAAgAAAAAAAAAAAAEAAQAAAP//AAABAP//AAACAAAA/v8AAAEAAQAAAP7/AQACAAAA/v8AAAIAAAD+////AgABAP3/AAADAP7//P8DAAMA/P/9/wQAAQD8/wAAAwD+//3/AgADAP3//f8CAAIA///+////AAABAAEA/v/9/wEAAwAAAPz///8CAAEA/f/9/wIAAwD+//z///8FAAEA+//9/wQAAgD9//3/AwAAAP3/AAACAP7/AAABAAAA/P8BAAIA/v/9/wIAAgD///7/AgAAAP//AQABAP7/AQADAAAA/f8CAAIAAQABAP////8EAAIA/v8BAAQAAAD//wQAAQD//wIAAwABAAEAAQACAAIAAgABAAMAAQABAAIAAwAAAAIAAwAEAAAAAAAEAAUA//8AAAMABQABAAEAAQADAAIAAQABAAQAAgACAAAAAgADAAIA/v8CAAQAAgD//wMAAgAAAP//BQACAP//AAACAAIAAwAAAP//AAAEAAEA/////wMAAgD/////BAABAP//AAADAP//AAACAAIA/v8BAAEAAQABAAIA//8AAAAAAgACAAAA/P8CAAMAAAD//wIAAAD//wAABAAAAP7///8DAAAAAAAAAAAA//8BAAIAAQD9/wAAAwAAAPv/AQAFAP7//P8CAAIA///+////AQABAP7///8BAAAA/v8AAAEA///+/wAAAwD///z/AAACAP////////7///8DAP///f///wEA//////7/AAAAAP///f8AAAAA/v/+/wIA/v/8/wAAAwD8//v/AQADAPz//f8AAAAA/v/////////+//7///8AAP3///8AAP7//f8AAAAA/v/9//7/AAABAP7//f///wEAAAD9//7/AAD+//7/AQAAAPv///8CAP7//P///wAA///+//7///8AAP///f/+/wAA///9//7/AAD////////9////AQD///z//v8AAP7/AAAAAPz//P8BAAIA/P/6/wAAAQD+//v//v8BAP///P/9////AAD8//z///8AAP3//P///wIA/P/6//7/AQD8//z//v////z//v/9/////f/8//z/AQD+//r/+v8BAP7//P/7/////v/9//r///////v/+f8AAP///P/6//3//v////n//P/+////+//8//z//v/+//z/+f/+/////v/8//3/+//9//7////6//v//f8AAPz/+//7/wAA/v/8//v////8//z//f////z//f/9/wAA/P/7//z/AQD///z//P8AAP7//v/8//7//v8AAP7//P/9/wIA///7//z/AgD///7//f///////v/9/wAA//////7///8AAAEA/f/9/wEAAAD8/wAAAQD///3/AQAAAP///f/+/wEAAQD8////AgD+//3/BAAAAPr///8EAP3//f8BAAAA/v//////AAABAP///f///wIAAQD8//7/AQAAAP////8AAAAAAAD+////AgAAAP3///8CAAAA/v8AAAAA//8AAAAA/////wEA///+/wEAAAD///////8BAAAA/v///wAAAAAAAAAA/v///wEA//////////8BAAAA/f///wIA/////wAAAAD//wEAAQD///7/AAABAAIA///9////BAACAP7//v8BAAEAAgD///3///8FAAMA/f/7/wMABgAAAPr/AQAEAAAA/v8DAAEA/P8BAAQA/v/+/wMAAQD9/wAAAgD/////AQD/////AQACAP///f8AAAMAAAD9/wAAAwAAAP7///8AAAIAAgD9//3/AwACAP3/AAACAP///v8CAAEA/////wEA//8CAAEA/f///wUAAAD9/wAABAD/////AQABAP//AQABAAEA//8AAAAAAgD/////AQABAP//AQAAAP////8EAP///P8BAAYA///7/wAABgD///z/AQAEAP7//v8CAAIA/v8AAAAA//8BAAMA/v/9/wEABAD///7///8BAAAAAgD///7/AQADAP7//v8AAAMAAAD///7/AwABAP7///8CAP//AAABAAAA/v8CAAAA/////wIA/////wAAAQAAAAAA/f8BAAMA///7/wIAAgD+//3/AgABAAAA/v//////AgAAAP///f8AAAIAAgD9//3/AQADAP7//v8BAAEA/v8BAAEAAAD//wEAAAD//wAAAQD//wAAAQAAAP//AgAAAP7/AAACAAAAAAAAAAAAAQABAP//AAACAAAA//8CAAEAAAAAAAAAAQABAAIA///+/wIABAD+//3/AgADAAAA//8AAAIAAQAAAP7/AQADAP///f8DAAMA/v/9/wQAAQD+/wAAAgD/////AgACAP3/AAADAAEA/v8AAAEAAQD//wAAAQACAP///v8CAAMA/f///wMAAAD+/wMAAgD9////AwABAP///f8BAAMAAQD8////AgABAP//AAD//wAA//8BAAEA/v/8/wMAAwD9//3/AwD///7//v8BAP//AAD+//7/AAACAPz//v8AAAAA/P8BAAAA/v/7/wEAAAD+//3////9/wAA//////v///8BAP//+v/+////AAD9//7//P/////////7////AAD+//r/AAAAAP7/+//+////AgD9//v///8DAPz//P8AAAEA/P8AAP///f/+/wIA///+//7/AQD+/wAA////////AAD//wIA///+////AwAAAP////8BAP//AQAAAAAA//8BAAIAAQD+/wAAAQACAP//AQABAP////8EAAIA/P/9/wYAAwD9//7/AwACAAAA/v8AAAEAAgAAAAAA//8BAAIAAQD+/wAAAgAAAP7/AgACAP///v8BAAEAAAAAAAEA/////wEAAQD//wAA/////wIAAQD//wAAAQD+/wAAAwAAAP3/AAABAAIAAAD/////AwABAP////8BAP//AQABAAAA//8DAAAAAQAAAAAA/v8CAAEAAgAAAAAA/v8FAAIA/f/+/wYAAQD+////BQAAAP//AAAFAP////8CAAMA/f8DAAIAAAD//wQAAAAAAAEAAgD+/wIAAQABAP//AgAAAAIAAAACAP//AAAAAAMAAAAAAP//AgAAAAIA//8AAAAAAwAAAP///v8DAAAAAAAAAAIA/v/+/wEABAD+//3///8EAAEA/v/+/wMAAQD/////AgD//wEAAQABAP//AQABAAIA/v///wMABQD9//7/AwAFAP7//P8CAAYAAAD9/wEAAwD//wIAAgD+////BQACAP7/AAADAAEAAgAAAAAAAgACAP//AgADAAEA//8DAAMAAAD//wIAAgADAAAAAQADAAMA//8BAAIAAgAAAAIAAQADAAEAAAABAAQA//8AAAQABAD9/wAAAwACAP//AgABAAAAAQAEAAAA/v///wIAAgACAP3//v8CAAQAAAD+////AQABAAIA///9//7/BAADAP7//f8BAAIAAgD+//7/AQADAP///v8BAAIAAAD//wAAAgAAAP//AgACAP3///8EAAIA/v///wEAAgACAAAA/v8BAAQAAAD9/wIABAD+//3/BAAEAP////8AAAEAAgACAP7///8DAAIA//8AAAAAAQACAAEA/f8CAAQA///+/wIAAgABAAAAAAABAAIA//8BAAQAAQD9/wIABAAAAPz/AgAFAAAA/f8DAAQA/v///wUAAQD9/wEABgD///3/AwAEAP3///8GAAIA+/8CAAUAAQD+/wEAAAACAAEA/////wUAAgD9//7/BgADAPv//P8HAAQA/f/9/wQAAQABAAEAAAD+/wIAAgACAP7/AAADAAMAAAAAAAAAAgAAAAIAAQABAP//AQADAAIA/f8AAAIAAwAAAAAAAAAAAAEAAwD///7/AQAEAAAA/f8BAAMAAAD//wAAAQABAAEA//8AAAMAAAD+/wEAAgD//wEAAgD/////AwABAAAAAQAAAP//BAADAPz//v8GAAQA/v/9/wMAAwD/////AgACAAAAAAADAAEA/////wEAAgABAAAAAAAAAAIAAAABAAEA/v8AAAMAAAD9/wEAAgD+////AgAAAP////8BAAAA//8BAP///f8BAAIA/v/9/wIAAQD+/wAAAQD9////AgAAAPz/AAACAAAA/v///wAAAAABAAAA/P8AAAMAAQD8//7/AgABAP//AAD9////AwADAPz//P8DAAMA/v/+/wAAAgABAP///v8BAAIA///9/wIAAgD+////AgAAAP//AQAAAAAAAgAAAP7/AAABAAEAAgD///z/BAAGAP3/+v8EAAUA/f/+/wMAAAD+/wEAAgD///7/AQABAP///v8AAAAA//8AAAEA/f/+/wEAAQD8//3/AgACAPz//f8CAAEA/P///wAA/v/8/wIAAQD8//z/AQAAAP7//f8AAP///v/+/wAA/f/8////AwD9//r//v8DAP//+//9/wEAAAD9//3/AAD///3//v8AAP///f/8////AAD+//3///8AAP7//f/+///////9//3///////7////+//z///8CAP//+//+/wEA/v/+/////f/+/wIAAAD7//7/AwAAAPz//f8BAAEA/v/+/wAAAQD///7///8CAAAA/f///wIAAQD/////AAD//wEAAQD///3/AQADAAEA/v///wAABAABAP3//v8FAAIA/f8AAAQAAAD+/wAAAwACAP///v8DAAMAAAD//wEAAQABAAAA/v8BAAUA///6/wQACAD8//n/BgAGAPr//P8GAAMA/f///wIAAQAAAP//AAAAAAAAAAABAP7//v8BAAIA///9////AgAAAP7//v8BAAAA//8BAP///v8BAAEA/v///wEA/////wEAAAD+/wAAAAAAAAAA/v/+/wIAAwD9//v/AgADAP3//f8CAAEA/v8AAAEA/v/+/wIAAAD9////BAABAP3///8CAAAAAAD//wEAAAD//wAAAwAAAP7/AQADAP//AAAAAAEAAAAAAAEAAwD/////AgADAP7/AAABAAEAAAACAAEAAQAAAAAAAQADAP////8BAAIAAAABAAEAAQAAAAEAAQAAAP//AgADAP///v8DAAIA/v8AAAIAAAAAAAIAAgD//wAAAgACAAAA/v8BAAQAAAD9/wIABQD///7/AwACAP7///8DAAEA//8BAAEAAAACAAEA/v8AAAMA//8AAAIA///+/wMAAQD//wAAAQAAAAIAAQD+//7/AwAEAP///P8DAAUA///8/wEAAwACAP///v8BAAUAAAD8/wAABQAAAP7/AgACAP7/AAACAAEA/v///wIAAwAAAP7/AQABAAAAAQD///7/AgAEAAAA/f///wIAAgD///3/AAACAAAA//8BAAEA/v///wEAAAAAAAAA/v/+/wMAAgD9//7/AgABAP7///8AAP//AAAAAAAAAAD+//7/AwABAPv//v8DAP7//v8BAP///P8BAAIA/f/8/wEAAQD9//3/AQD///3///8BAPz//v8AAP7//f8AAP///v/+/wAA/v///////v///wEA/P/9/wEAAwD8//v/AAAEAP///P/9/wMAAQD8//z/BAABAPz///8EAP///P8BAAMA/v8AAAIAAAD//wIAAgD///7/AgADAAEA//8AAAMAAgD+/wAABAACAP3/AQAGAAEA/v8BAAIAAQACAAEAAAACAAIA//8BAAMAAQD//wIAAwABAP//AQACAAIAAAABAAEAAgACAAEA//8CAAMAAQD+/wIAAwAAAP//AwABAAAAAQABAAAAAwABAP//AAAFAAAA/f8BAAUAAAD+/wEABQAAAP7///8EAAIA//8AAAIA//8CAAIA///9/wMAAwABAP//AQAAAAIAAAAAAAAAAgAAAAAAAAACAAAAAAD//wMAAAD//wEAAwD+//7/AQACAP//AAAAAAEAAAD//wAAAgD+//7/AQACAP/////+/wAAAwAAAPr///8FAAIA+v/+/wQAAgD8//7/AwABAPz/AQADAP///v8CAAIA/////wIAAAD//wIAAwD/////AwADAP7/AQADAAAA//8CAAUAAAD8/wIABgABAP3/AgAFAAAA//8EAAMA//8AAAMAAwAAAAEAAwACAAEAAgABAAAAAgAFAAAA//8EAAQAAQAAAAEAAgAFAAMA/v8CAAcAAwD+/wEABQAEAAEAAQACAAMAAgACAAIAAgAAAAQABQABAP//AwADAAAAAQAEAAEAAgACAAIAAAACAAMAAQD//wMAAgABAAAAAgACAAIAAAAAAAIAAwD//wAAAQACAAAAAQABAAEAAAABAAEAAQD//wAAAQADAAMA/v/9/wMABQD+//z/AwAEAP////8CAAIAAAD/////AgACAAAA//8AAAEAAgABAP///v8BAAEAAQABAP///v8CAAMA///9/wEAAgABAAAA/v///wIAAQD+////AQAAAP//AAAAAAAA//8AAAAA/v/+/wIAAgD8//3/BAACAPz//f8CAAEA/f///wIAAAD9/wAAAgD+//z/AQACAPz//v8DAAAA/P/+/wEAAAD9////AAAAAP////8AAP7//v8BAP///////////v8BAAAA/f/9/wIAAgD+//z/AAACAAAA+/8BAAQA/f/6/wQABAD8//v/AgABAAEAAAD9//3/BQACAPz//f8EAAEA///+/wEAAAAAAAAAAQD+/wEAAAAAAP7/AgAAAP3//v8FAP///P///wMA///////////+/wIAAAD+//3/AQAAAAAA/P///////////wAA/v///wAA///+/wEA///8//7/AgAAAP3//v8BAAEA/f/+/wEA///9////AgD+//v/AgADAPv/+/8DAAIA/P/9/wEA/////wAA/v/9/wAAAAD////////+////AAABAP3//P8AAAMA///7////AAD+////AAD+//3/AAABAP7//P8BAAMA/P/8/wIAAgD9//7//////wIAAAD7////BAAAAPz/AAABAP7/AAABAP7///8CAP///f8BAAIA/v///wEAAQAAAAEA/v///wIAAgD/////AAACAAEAAAD+/wEAAgABAP7/AAACAAMA/v///wIABAD/////AAADAAEAAQD+/wIAAwADAP3///8DAAUA/f///wIABAD//wEAAQACAP//AgABAAIA/v8CAAEAAgD//wMAAQAAAP//BAABAAAA/v8DAAEAAQD+/wAAAwACAPv/AQAEAAAA+/8CAAIA/v///wIA/f///wEAAAD9/wEAAgD///v/AQACAP7/+/8AAAIAAAD9/wAA/v/9/wAAAwD8//v/AgADAPv//v8AAP7//v8CAP///f/+/wEA//////3//v///wEA///+//z/AAABAP///P/+/wAAAQD+//3//f8CAAEA/P/7/wIAAgD9//z/AAAAAP7//v////7/AAD///3//v8AAAAA/v/+//3///8BAP7//P///wAAAAD9//3///////3///////7//f8AAP7//v////7/+////wEA///8//7///8BAP7//P/9/wEA///9//7/AAD+/////v////7/AAD+//3///8CAP3//P8AAAIA/v/+/wAAAAD+/wAA/v///wEAAAD9////AgACAPz//v8BAAEA///+/wAAAgD+////AQACAP7//f8CAAMA////////AAAAAAIA///+/wAAAwD///7/AgADAP3//v8CAAIA/v///wEAAQD+/wAAAAABAP7//////wEA//8AAP/////+/wAA//8AAP7//////wIA/f/9/wAAAgD8//3/AAABAP3////+/wAA/v8AAP7//v/9/wEA///+//z///8BAAIA+//7/wEABQD7//n/AAAEAP7//f/+/wAA//8BAP7//f/+/wIAAQD///z///8CAAEA/f8AAAIAAAD8/wEAAwD///3/AwADAP7//v8DAAIAAAD+/wAAAgADAP////8BAAMAAAD//wEAAgD/////AgADAP//AAAAAAAAAQABAP7///8BAAIAAAD/////AQAAAP7///8CAAAA/f///wMA/v/8/wEAAgD+//3/AAACAP///f///wIA///9/wEAAQD9////AQD/////AQD///7/AAABAP7//v8BAAEA/f/9/wEAAwD9//z/AgACAP3//v8BAP///f8BAAEA/v/+/wEAAgD+//z/AAACAAAA/P/+/wEAAQD+//7//////wAAAAD+////AQD///3/AAAAAP7//v8AAP///v8AAAAA/f/9/wAAAQD9//7/AAD+//3/AQAAAPz//f8BAAEA/f/7/wAAAgD///v//v8BAAAA/f/8/wAAAwD+//v///8CAP7//v/+////AQD///3///8CAP///P8AAAIAAAD8//3/AwADAPv/+/8EAAQA+//8/wQAAQD7/wAAAwD+//7/AQAAAP//AQD///7/AAACAAAA//8AAAEAAAD/////AgABAP7//v8EAAIA/f///wQAAAD+/wEAAgD+/wEAAQABAAAA//8AAAMA/////wEAAQD+/wMAAgD9//3/BQACAP7//v8EAAEA///+/wQAAQD+//7/BAABAAAA/v8CAAEAAgD//wEAAAABAP//AwD//wAAAAAEAAAAAAD+/wUAAgD///v/BgAFAP7//P8FAAEAAQABAAIA/f8EAAIAAAD//wMA//8CAAEAAAD//wQA///+/wEABQD+//7/AQADAP7///8AAAAA//8CAAAA/v/+/wIAAAD+//7/AgD///7///8AAP////////////8AAP///f/+/wAAAQD///z///8CAAAA+//+/wQA///7////AgAAAP7///////7/AAABAAAA/v///wEAAQD9//7/AgABAP3/AAACAAAAAAABAP7///8CAAIA//8AAAEAAQAAAAEA//8AAAEAAgAAAP//AAAEAAEA/f///wUAAQD+/wAAAgABAAEAAAAAAAEAAwAAAP7/AAADAAEA/v///wIAAQABAAAA/////wIAAQD+/wAAAQAAAAEAAAD//wAAAgAAAP7/AQABAP//AAAAAAEAAQD/////AQACAP////8BAAIAAAD+/wAABAACAP7///8CAAEAAQABAP//AAAEAAIAAAAAAAMAAgAAAAEAAwABAAAAAgADAAEAAgADAAAA//8EAAUAAAD+/wMABQABAAAAAgACAAIAAgACAAEAAAABAAMAAgD//wIAAwABAP7/AAACAAIA/v8AAAIAAgD+/wAAAQAAAP//AQAAAAEAAAABAP//AAAAAAEAAAABAP7/AAACAAEA/f8BAAEA/////wQA///8/wEABAD//wAAAAAAAAAAAgAAAAEAAQD/////BQADAP3//f8EAAQA///+/wMAAwABAP//AQADAAIA/v8BAAQAAQD+/wMABAD///7/BAADAAAAAAADAAAAAAABAAMAAAD//wEABQAAAP3/AgAGAP///f8BAAQAAQAAAP7/AgACAAAA//8DAAEA/v8AAAUAAQD9////BQABAP7/AAABAAEAAwD///7/AQAEAP///v8BAAIA/////wIAAgD9/wAABAAAAP3/AQAEAAAA/v8AAAMAAQD+/wAAAwAAAAAAAQAAAAEAAQD+////BAABAPv/AQAFAP///P8DAAIA/v///wMAAAD//wAAAgAAAP////8BAAAA/////wEAAAAAAP////8AAAAA//8AAP///////wAA//8BAP////8BAAAA/f8AAAEAAQD+//7///8DAAEA/v/+/wAAAgACAPz//f8EAAQA+//+/wUAAwD9////AQACAAEAAQD//wIAAgACAAEAAgD//wEABAADAP//AgADAAQAAQACAAIABAABAAIAAwAEAAAABAAFAAQA//8DAAYABQD+/wMABgAGAAEAAgACAAgABQABAAEACAADAAIABQAGAAAABgAGAAMAAQAHAAQAAwADAAUAAwAGAAMAAgADAAgABAABAAEABwAFAAEAAQAIAAUAAAACAAYAAgACAAMABQACAAMABAAEAAIAAgADAAUAAQACAAQAAwABAAMABAADAAIAAwACAAMAAwADAAMAAgAAAAQABQABAAAABQADAAIAAwAFAAAAAAAEAAYAAQAAAAMABQAAAAQABQD+//7/CAAGAP7///8FAAIAAgAEAAEA//8DAAMAAQAAAAIAAgACAAEAAAACAAMAAQD+/wAAAwADAAAA/v8BAAMAAQABAP//AAABAAIA//8AAAIAAQD9/wEAAwAAAP3/AgACAP///v8CAAEA///+/wEAAgABAP7///8AAAMAAQD9//z/AgAEAAEA/P/9/wMABgD8//v/AwAFAPv//P8EAAQA/f8AAAAAAAAAAAIA/v/+/wMAAgD6/wEABgAAAPn/AgAFAP///P8BAAAAAgABAP///v8DAAEA/v///wMA/////wIAAwD9////AgACAP7/AAACAAEA/v8BAAEAAAD//wEAAQABAAEA/v///wQA///+/wEAAQD+/wEAAgD+//3/AgAAAAAA////////AQAAAP///f8AAAEAAAD9/wAA/////wAAAAD8/wEAAAD9//3/AgD+//7/AAD+//v/AgAAAPz/+/8BAP///v/9////+//+///////8//7//v////z//f/9/wEA/f/7//3/AgD9//r//v8CAPv//f/+/////P/+//3//v/8/////f/+//3//v/7///////8//n/AwD9//n/+/8DAPv/+//9//7//P8AAPr//f/9//7/+v/+//3//v/7//7/+/////z//f/6/////v/9//n////+//7/+v/+//3//v/8//7//f8AAPv//P/+/wEA/P/7//3/AQD///7/+v/+/wAA///8//3///8AAP7//f/8/wEAAAD8//z/AAAAAP3//f8AAAAA/v/9////AgD+//v///8DAAEA/P/8/wIAAQD///7/AAAAAAAA//8BAP/////+/wEAAQD/////AQD//wAAAAABAP7/AAAAAAEAAAAAAP7/AgACAAAA/P8BAAIAAwD+//7/AAAEAAAA/v///wMA/v///wIAAgD9/wAAAAACAP//AAD//wEAAAACAP//AAD//wQAAAD+////BAAAAAEA//8BAAAAAwD//wAAAQADAP3/AgACAAEA/f8CAAIAAgD9/wEAAgADAPz///8DAAUA/P/+/wIABQD9////AQADAP7/AAD//wIAAAABAP7/AQAAAAIA/v8AAP//AAD//wIA//8AAP//AQD+////AAABAP3/AQACAP7//P8EAAEA+//+/wQA///+/wIAAAD8/wEAAgABAP3//v8BAAQAAAD8//7/AwABAP//AAABAP//AAACAAAA/P/+/wMAAgD+////AQABAP//AAD/////AAAAAAEAAQD+/wAAAgD///3/AgAAAP7/AQACAP////8AAAAAAQABAPz//v8DAAIA/f/+/wIAAQD+/wAAAQD///3/AgACAP3//v8CAAEA/f///wEAAAD+////AAABAP7//f8AAAIA/v/+/////////wIA///8//7/AwAAAP3//f8BAAAA///9/wAAAAAAAPz///8CAAEA/P/+/wAAAAD//wEA/v/+////AgD///7//f8AAAEAAQD+//7//v8BAAAA///9/wEAAAD+//7/AQAAAP///f///wAAAQD8//7/AAAAAP3//v8AAAAA/f////7/AAD///7//v8AAP7//f/+/wIA/f/8/wAAAgD9//z/AAABAPv//f8BAAEA+//8/wEAAQD8//3//v/////////8//7/AQD+//v/AAAAAPz//f8CAP//+//9/wIAAAD9//3///8CAAAA+////wQA///6/wIABAD8//z/BAAAAP3/AAADAP///////wEAAgABAPz/AAADAAEA/v8BAAEAAQABAAAA//8CAAAA//8BAAIA/v8BAAQA///8/wQABAD9//7/AwABAP7/AQACAP7/AAADAAAA/f8BAAMA/////wEAAAAAAAEA///+/wIABAD9//3/AwADAP3//f8BAAMAAAD9////BAAAAPv/AAAEAP//+/8AAAMAAAD+//7/AAABAP///v/+/wAAAgAAAPz//v8EAAIA+//8/wIAAwD+//z/AAABAAAA/////////v8BAAEA/v/9////AQAAAP3///8AAP////8BAP///P///wEA//////////////////8BAAAA/P///wMAAAD9//7/AAABAAAA//8AAAEA/v/9/wIAAgD+//3/AQAEAAAA/v8AAAAA//8BAAMAAAD8/wAABQADAPv//f8FAAQA/P///wQAAgD9////AgACAP7//v8DAAQA/f/9/wIABAD+//3/AQAEAAAA/v///wMAAQAAAP//AgABAP//AAACAP7/AQADAAAA/f8CAAMA///+/wIAAAAAAAEAAgD+/wAAAgABAP//AgAAAAAAAAABAAEAAgD+//7/AwAEAPz//v8DAAIA/v8AAAAAAAABAAIA/////wAAAwAAAAAA/v8BAAIAAQD//wEAAAABAAEAAQD9/wIAAgD/////AwD//wAAAgADAP3/AAABAAMAAQABAP//AwABAAIA//8DAAIAAAD//wUAAwAAAP//BQAAAAAAAgAFAAAA//8AAAUAAQABAAIAAgD+/wQABAABAP7/AwABAAIABAADAP3/AQADAAMAAAABAAEAAgABAAEAAQABAP//AgADAAAA//8DAAIA/v///wQAAwAAAP7/AQAEAAMA/f///wMAAwABAAAA//8AAAQAAwD8//7/BAAFAP///v8CAAMAAAABAAAAAgACAAEAAAADAAEAAQABAAIAAAACAAMAAQAAAAIAAgABAAAAAgACAP//AQADAAEAAAABAAEAAgADAAAA//8EAAMA/f///wYAAgD9/wAABQACAP//AAACAAEAAgAAAAAAAQADAAAAAAACAAIA//8CAAIA//8AAAQAAgD//wAAAwABAAEA//8AAAMAAQD//wMAAgD+////BAABAP3/AAAEAAIA/v/+/wMAAgD+//7/AgAAAAAAAQABAP3/AAADAAAA/P8BAAIAAAD9/wIAAgD///7/AwABAP///f8DAAEA/////wIAAAACAAAAAQD+/wEAAgACAP7/AgABAAEA//8CAAAAAgABAAAAAAAGAP///f8CAAUA/v///wQABAD8/wIAAwAAAP//BAAAAP7/AgAFAP7/AAAAAAIAAQABAP//AgAAAP//AgADAPz/AQADAAAA/P8DAAMA/f/9/wQAAQD+//7/AwABAP7//v8BAAAAAAAAAAEA/v/+/wIAAwD9//3/AQACAP//AAAAAP7/AAACAP////8AAAAAAAABAAAA/v8BAAEA//8BAAIA//8AAAIAAAD+/wIAAgD+//7/BQAEAPz//P8GAAUA/P/8/wUAAwD+/wAAAwD//wAAAwADAP3/AAAEAAIA/f8BAAMAAQD9/wIAAwAAAP7/AwACAP///v8BAAAAAQAAAP///v8DAAEA///+/wEAAAAAAP7/AAD//wAA//8AAP7/AAABAAAA+////wIAAQD9//7//f8BAAMA///5/wAABAD///z/AAD///3/AAADAPz//P8CAAEA/f///wAA/v/+/wIA///+////AAD//wAA//8AAP////8AAAIA///9/wAAAwD+//3/AQABAP7///8BAAAA//8BAP7//v8CAAEA/P/+/wMAAgD8//7/AwABAPv//v8DAP///P8AAAEA//////7//v8BAAAA/f/+////AQAAAP3//P8BAAIA/v/9/wAA//////7/AQD+//z/AAAEAP//+//9/wIAAQD///7/AAD/////AgABAPz//v8DAAIAAAD/////AQADAAEA/f///wQAAgAAAP//AAACAAIAAQAAAP//AAADAAQA/////wIAAgD//wEAAgABAAAAAAACAAMAAAD+/wIAAgD+////BAAAAP3/AQADAP7/AAAAAP//AAABAP3///8EAAAA+v8CAAQA/f/8/wMAAQD8//7/BAD///v/AAAEAP7//v8BAAAA/f8BAAAA/f/+/wIAAAD+//3/AgACAP3/+/8CAAMA/f/8/wMAAgD9////AwAAAP3/AAADAP7//v8BAAIAAAD/////AgABAP///f8BAAMAAQD8////BQADAP3///8BAAAAAgADAP3//v8FAAMA/P8BAAUA/v/8/wYABQD7//v/BgAGAP3/+/8CAAMAAQD+////AAADAAAA/f8AAAMA///+/wAAAgAAAAAA/////wAAAAD//wEAAAD+////AwAAAPz///8DAAAA/v8AAAEAAQAAAP7/AAADAAIA/v/+/wIAAwAAAP//AQABAAAAAQABAAAAAgAAAP//AgACAP//AAABAAEAAQABAAAAAgAAAP//AwABAP7/AQACAAAAAAABAP//AQACAP///v8BAAMA///9////AQABAAAA/v/+/wEAAwD///3///8BAAIA///8/wAAAQAAAAAAAAD9/wAABQD///j/AgAFAP3/+/8DAAIA/v/+/wAAAAACAP7//f8BAAMA/v/+/wIAAAD8/wIABAD9//v/AgAEAP///P8BAAEA/////wEAAAD+/wEAAgD/////AAABAAAA//8AAAEAAAAAAAAA///+/wIAAgD9//z/AgADAP//+v///wQAAgD6//z/AwACAPr//v8DAP//+/8BAAIA/v/6/wAAAgD+//n///8BAP7/+/8CAP7/+//+/wAA/P/9//7/AAD9//3//f8AAP//+//7/wIAAQD8//n/AAACAPz/+v8AAAEA/f/8/wAA///9//7/AAD+//z/AAACAP7//P///wEA///+//7///8BAAAA/f/+/wIAAgD9//v/AgAEAP7/+/8AAAUAAQD6////BQAAAPr///8FAAAA/P///wIAAQD+//3///8BAAAA/////wAA/////////v/+/wIAAAD7//7/AgD///3//f///wAAAAD9//7/AAD///3//v/9/wAAAQD8//r/AgADAPz/+f8AAAIA///7//7///8AAP///v/9/wAA///+////AgD8//z/AgABAPv///8BAAAA/f8AAAEAAAD9//7/AgACAPz///8CAAEA/f8AAAAAAAABAAIA/v///wAAAgAAAP///v8CAAEAAQD///////8CAAAA/v///wIAAAAAAP7///8CAAIA+////wQAAQD7/wEAAgD+//7/BAD///z/AAADAP///f///wAAAAD///7/AAD/////////////AAD+//7/AQAAAPz/AAABAPz//v8DAP7/+/8AAAMA/v/9////AAAAAP///f/+/wEAAQD9////AQAAAP3/AAABAP///v8BAP////8AAAIA/////wAAAQD//wEAAAAAAP//AgABAAAA//8CAAEAAAD//wEAAQABAAAAAQAAAAEAAgAAAP7/AQADAAAA/v8BAAIAAgD//wAAAgAAAAAAAwABAP7/AQAEAP///v8CAAIA//8AAAIAAQAAAAEAAQAAAP//AgACAP//AAACAAAAAAAAAAIAAAD//wAABAACAP3//v8FAAIA/v/9/wIABAABAP7/AQACAAIA//8AAAAAAgAAAAAAAgADAP////8AAAIAAQAAAP7/AQADAAMA///+////BgAEAPv//P8GAAUA/v/9/wMAAgACAAEAAAD//wMAAgAAAAAAAwABAAEAAQABAAEAAgAAAP//AwADAP////8CAAIAAAAAAAEAAQABAAEAAQABAAAAAAADAAIA/////wMAAwAAAP//AgACAAAA//8DAAIAAAAAAAIAAgABAAAAAQAAAAIAAgAAAAAABAADAP3//v8GAAUA/f/9/wUABAD/////AgADAAEA//8BAAMAAgD/////AwADAAAA//8CAAQAAAD+/wEAAwAAAP//AAACAAIAAAD+/wEABAAAAPz/AQAEAP///v8DAAEA//8AAAEAAQACAP///v8BAAMA//8AAAEAAgD/////AAADAAEA/f/+/wQAAgD+//3/AQADAAEA/P///wQAAwD7//z/AgAEAP7/+/8AAAUA///8/wAAAwD+//3///8BAP/////+/wAA////////AQD8//7/AQABAPz//v8AAP///v8BAP3//v8AAAAA/P8BAAAA/f/8/wEAAAD+//z/AAAAAP///v8BAPz//v8CAAAA+/8AAP///f///wQA/P/7/wAAAwD8//3///8BAPz///8AAP///P/+////AgD9//z//v8EAP3/+////wMA/v/9//7/AQD+/wAA//////z/AQACAAAA+/8AAAEAAQAAAP7//P8DAAIA///9/wEA//8BAAEAAAD+/wAAAAADAAEA/P/+/wUAAQD+/wAAAwAAAP7/AQACAAAA/////wIAAgAAAAAAAAAAAAAAAgABAAAAAAACAAIAAQD9/wEABAABAP7/AwADAAEA//8CAAEAAwAAAAIAAwADAP//AQACAAUA/////wQABQD+/wEABAADAP7/AwADAAIAAAADAAEAAgACAAMAAAABAAIABQD/////AwAFAP7/AAAEAAMA//8DAAIAAAD//wMAAQABAAEAAwAAAAEAAgADAP7/AQADAAIA//8BAAIAAgD//wEAAgADAP//AgACAAIA//8BAAIABAD//wAAAwAFAP7//v8DAAUA//8AAAAAAwADAAIA/v8AAAIABAACAAAA/v8EAAMAAQABAAMA//8CAAUAAgD9/wEABQAEAP7/AQAEAAIA//8DAAMA/v///wYAAwD+////BAADAAEAAAABAAEAAwABAAEAAQACAAEAAgABAAEAAQACAAAAAQACAAEA//8AAAIAAgD//wAAAQACAAAA//8AAAIAAQD///7/AgADAP///f8BAAMAAAD8/wAABAABAPz/AAAEAAAA/f8AAAEAAAD+/wAAAwABAP3///8DAAEA/f///wEAAQAAAP////8CAAEA/v///wIAAAD+/wEAAQD+/wEAAgD+//3/AgADAP7//f8BAAMAAQD9//7/AQABAAAA/////wAAAQAAAAAA/v///wAAAAD//wAAAAD/////AQD///////8AAAAAAAD//wAA/v/+/wAAAwD///3///8CAAEAAAD9//7/AAADAAEA/f/+/wIA//8BAAIAAAD8/wAABAABAP3///8BAAMAAAD//wEAAAD//wMAAQD9////BQAAAP3/AQADAP///v8BAAMA//8AAAIAAQD//wIAAQD+////BAABAP//AQADAP//AQABAAEA//8BAAEAAgAAAAAAAQADAP//AAAAAAEAAQADAP7///8EAAMA/P8BAAMAAAD+/wQAAAD//wMAAwD7/wEABAD///7/AwAAAAAAAgABAP3/AgABAP7/AAADAP7//v8DAAIA/f///wIAAQD//wEA//8AAAEAAAAAAAAA//8BAAIA///+/wMAAgD+////AgABAP7/AAACAAIA/v8AAAMAAQD+////AgACAP7/AAABAAEAAAAAAP//AQACAP///v8CAAEA/////wAA//8CAAEA/f///wMAAAD9////AgD/////AQAAAP7///8CAP///P8AAAIA/v/9/wEAAgD+//7//v8AAAEA///9////////////AQD///3///8CAAAA/f/9/wEAAAD+////AQAAAP7//v8BAAAA///+////AQAAAP7/AAACAP///f8CAAMA/v/9/wEAAwAAAP7/AAADAAAA/f8BAAMA/v/+/wIAAwD/////AAABAAEA///+/wMAAQD9/wAABQD///3/AgADAP3/AQADAP7//f8FAAMA/P/9/wUAAgD9//7/AwACAAAA/v8BAAEAAAD//wAAAAAAAAAAAQD/////AQACAP3//f8DAAQA/f/8/wEAAQD//wAA/////wEAAAD+/wAAAAD9////BAD///v/AAAEAP//+////wMAAAD+//7/AQABAAAA/f8AAAIAAAD9/wIAAQD+////AgAAAAAA//////7/BAACAP3//P8CAAMAAAD8/wAAAQAAAP7/AQAAAP7///8CAAAA/v///wIA/v/9/wEAAwD+//3/AQABAP7/AAAAAP7///8BAAAA/v///wAAAAD///7///8AAAEA///8/wAAAwAAAP3///8BAP////8AAP////8BAAAA/v8BAAIA/v/+/wEAAQD///////8AAAAAAQABAP///f8AAAMAAAD+/wAAAAD//wEAAgD+//7/AQABAAAA////////AQABAP7///8BAAEA///9/wEAAgD9//7/AgABAP3//v8BAAEAAAD+//7/AQAAAP7///////7/AQAAAP////8BAAAA/////wAA//8AAAAAAAD+/wEAAQD///7/AgD//wAAAQD///7/AgABAP7//v8BAAEAAQD+//7/AgACAP7///8CAAEA//8AAAAAAQABAP7/AAADAAAA/f8CAAMA/v/9/wMAAgD///7/AQABAAEA/////wAAAwAAAP3/AAAFAAAA/P///wQAAAD//wAAAQAAAAEA/////wAAAgD+////AwABAP3/AAACAAAA/f8AAAEAAQD/////AQACAP3//v8CAAMA/f/8/wEABQD///v//f8FAAMA/P/6/wMABQD+//r/AQADAAAA//8AAP7///8CAAIA/P/+/wIAAQD//wAA////////AgAAAP7///8BAAAA/v8AAAMA/P/9/wQAAgD6////BgD///n/AQAEAP7//P8BAAIA///+/wAAAAD///7/AQAAAP7///8BAP///v8AAAEA/v8AAP////8AAAAA/v8AAP///////wEA/f///wIAAQD7//7/AgACAP3//f/+/wQAAQD8//z/AwABAP7//f8AAAAAAAD9/wAAAAD///3/AgAAAP3//f8AAAAAAQD9//z/AAAEAP7//P///wIA///+//3/AAAAAP///v///wAAAgD9//z///8CAP/////+////AAABAP3///8AAP////8BAP///v///wIA///+////AQAAAP///P///wIAAQD8//7/AgABAP3//////wAA///+////AQD///7/AAABAP///v///wEA/v/8/wAAAgD+//7/AQD///3///8BAP7//P/+/wIAAAD7//7/BAD+//r/AAADAPz//P8BAAAA/f////7///8BAP7//P8AAAAA///9////AAAAAP3///8BAP//+/8AAAEA/v/9/wEAAAAAAP3//v8BAAAA+////wMAAAD6/wEAAgD+//3/AgAAAP7///8DAP7//v8BAAIA/P8AAAMAAQD7////AwADAP7//v///wQAAQD///7/AgACAAAA/f8CAAMAAQD9/wEAAwAAAP3/AwADAP///v8CAAMAAQD9/wAAAgADAP////8CAAIA//8AAAEAAgD//wAAAQACAAEA/f/+/wQAAwD+//3/AwACAAAA//8AAAAAAQD//wAAAQAAAP//AQAAAP//AAACAP7//f8CAAQA/P/9/wQABAD7//3/BAADAPz//P8BAAUAAQD7//7/BAABAP7//v8AAAEAAQAAAP////8AAAIAAgD+//3/AgAEAP///P8BAAQAAQD+/wAAAAACAAEA/v8AAAMAAAD//wIAAgD//wAAAgABAAAAAQAAAAEAAQAAAAAAAgABAAAAAAABAAEAAAAAAAIAAAD+/wAABAACAP3///8DAAIA//8AAAIAAQAAAAAAAQACAAEAAAAAAAIAAwABAP//AQADAAIAAAD//wIABQAAAP//AwAEAAAAAQADAAEAAAADAAIAAgACAAEAAAAEAAQAAAD+/wQABgABAP3/BQAFAAAA//8FAAMAAQABAAQAAgADAAEAAgABAAUAAwAAAAAABQACAAAAAgAFAP//AAAEAAUA/////wEABQACAAAAAAAEAAMAAQD//wIAAgACAAEAAgABAAIAAQABAAEAAQABAAEAAQABAAEAAgABAAAAAAACAAEA//8AAAIAAQD//wEAAwAAAP3/AQAFAP7//P8CAAUA///+/wEAAwAAAP//AAACAAAAAAAAAAEAAQABAP////8CAAIA/v///wIAAwD+//7/AgABAP//AgABAP7///8EAAIA/P/+/wUAAwD7//7/BQABAPz/AQADAAAA//8BAP//AAAAAAEAAAAAAP7/AgABAP///P8DAAIA///8/wAAAgADAP3//f///wYAAAD8//z/AgACAAEA/P///wEAAwD9//7/AQACAP3/AAABAAEA/f8BAAAAAAD//wIA/////wIAAwD8////BAADAPz/AAACAAAA//8CAP7///8DAAMA/f///wIA///9/wMAAQD9//3/BAACAP7//P8AAAIAAAD9/wAAAQD/////AgD9//7/AAAAAP7/AAD///////8AAP7/AAD///7///8BAP////////7//v8DAAEA+//9/wQAAgD8//7/AgD+//7/AQABAP3///8BAP7///8CAP7//f8BAAIA/v///wEA/////wAA//8AAAEA///+/wAAAQAAAP///////wAAAQD///3/AAACAAAA/f/+/wMAAgD8//3/AwADAPv//v8EAAEA/P/+/wMAAgD9//7/AgABAP7/AAABAP////8CAAAA/f8AAAMA///9/wAAAgD+////AgD///7/AQAAAP///v8AAAAA/v///wIA///9/wEAAQD+////AgD///3/AQABAP////8AAAAA//8CAAEA/f///wIAAQAAAP////8AAAMAAQD+/wEAAgD//wEAAgAAAP//AwABAAAAAgACAAEAAgD//wAABAADAP7/AAACAAQAAgD+//3/BQAEAP3///8EAAAAAAABAAEA/v8CAAIAAgD+/wAABAAEAPv///8FAAQA/P///wEABAADAP3/+v8FAAYA/f/7/wUAAgD+////AwAAAAEA/////wEABAD+//7/AgACAP7/AQACAP///f8CAAIAAAD//wAAAQACAP////8BAAIAAAAAAAEAAQAAAAAAAAACAAEAAAABAAMAAgAAAP//AQACAAIAAAACAAEAAAACAAUAAAD8/wIABwD///3/BAAGAP3//v8EAAQA/v8BAAMAAQAAAAQAAgD/////BAADAAIA//8AAAQABAD+//7/BQAGAP7//v8EAAMA//8BAAQAAQD+/wIABQD///7/AgACAAEAAwD///7/AwAEAP7//v8DAAIA//8AAAAAAgABAAAA//8AAAEAAAD//wEAAAD//wAAAgAAAP7/AAACAP7//v8BAAIA/v/+/wEAAQD///7///8DAAAA+/8AAAQA///9/wAAAQD+////AQAAAP///////wEAAAD///7/AAABAAAA/f/+/wIAAgD7//7/AwAAAPz/AQAAAP3///8BAP3/AAABAPz/+/8DAAIA/f/8//////8BAP7//f/+/wAA/f8AAAAA/P/6/wEAAwD///n//v8BAAAA/P/9//7/AAD+//7//v////3///////7//P8AAP/////+/wAA/f/9////AgD9//3//v8AAP//AgD9//v//v8EAP7//v////7//f8FAAEA+P/8/wkAAAD3//3/BwD///z///8CAP7//////wAA/v8BAAAA/v/+/wMAAAD+//3/AQABAAAA/v8AAAAA/////wIA/v/+/wEAAAD9/wIAAAD9//7/AQD/////AAD///7/AAD//wAA/v/9/wAAAgD+//3/AAAAAP//AAD///3///8BAAAA/v/9/wAAAQD///////8AAP7/AAABAP///f8BAAIAAAD8/wIAAwD+//z/BAADAP///P8DAAIAAAD+/wEAAQACAP//AAAAAAMA/////wEABAD//wEAAAABAAAAAwD//wAAAgADAP7///8DAAQA/P/+/wQABgD9//3/AwAEAP////8AAAIAAQACAAAAAAABAAIAAQAAAAAAAgAAAAAAAAADAAIA/v/+/wQABAD+//3/AwACAP//AAADAAEA//8AAAMAAAD//wEAAwAAAAAAAQACAP//AgAAAP//AgAEAP7//f8CAAQA/v/+/wEAAwAAAAAAAAABAP7/AQADAAAA/P8CAAMAAAD+/wAAAQACAP7//v8BAAMA/v/+/wIAAgD9/wAAAgAAAP7/AAAAAAIA///9////BQAAAP3/AQADAP7///8AAAAAAAACAP3//f8DAAQA/P/9/wEAAgD+////AAD/////AgD///7/AAAAAP7/AQAAAP3///8EAP7/+/8CAAMA/f/8/wIAAQD9////AAD+/wAAAAD///7/AAAAAAAAAQD+//z/AgAEAP7/+v8CAAQA/v/9/wEAAAAAAAAAAAD9/wEAAgD+//v/AgAEAP7/+v8BAAMA///8////AQABAPz//v8BAAAA/P///wEA/v/9/wEA///9//3/AQAAAP3/+/8AAAIA/f/6/wAAAAD///7//v/9////AQD+//v///8AAP///v/+//3/AAABAP3/+/8BAAAA/f/9/////v////3///8AAP7//P///////v/8//7/AQABAPv//P8BAAAA+f///wEA/f/8/wIA///7//3/AQD8//3/AAD///r///8BAP//+v/+/wAA/v/8/wAAAAD9//z/AQD///7//f////7///8AAAAA/P/9/wAAAgD8//3/AQAAAP3//////wAA/v/+//7/AAD//////v/+//7/AQD///7//P///wEA///8/wAAAAD+//3/AQD///7//v8AAP//AAD+/////v8AAP//AAD+/wAAAAD/////AAD+/wAAAAABAP7/AAAAAP7///8DAP///f8CAAQA/P/9/wQAAgD9/wAAAgAAAAAAAgAAAP3/AAAEAAEA/f8CAAMA/f///wUAAAD6/wEABQD+//7/AwD///3/BAACAPz//v8EAAIA/////wAAAAACAAEAAAD//wEAAwAAAPz/AgAFAP//+/8CAAUAAgD8////AwAEAP7//v8CAAMA//8BAAAAAgAAAAAAAAAEAAAA/v8CAAUA/v///wIAAgD//wIAAQAAAAAABAABAP///v8DAAMAAQD//wIAAQABAAEAAwD///3/AgAHAAAA/P8AAAYAAgD9//7/BAADAAAA//8BAAIAAwD/////AgAEAP7///8EAAQA/v8AAAIAAgABAAIA/v8BAAQAAgD+/wEAAwABAP//AgACAAAA//8CAAIAAgD/////AQAEAAEA//8AAAIAAgACAP//AAACAAIAAAABAAEAAQABAAAAAAACAAEAAAABAAEAAQADAP///v8EAAQA/f8AAAQAAQD//wMAAgD//wIAAwD//wEABAACAP7/AQAFAAIA/v8BAAMAAwD//wAABAACAP//AQADAAEA//8DAAMA//8AAAMAAgAAAAAAAwACAAAAAAADAAMAAAD//wIAAwAAAAAAAwABAAAAAQADAAEAAAAAAAIABAAAAPz/AgAGAAEA/f8AAAIAAwABAP//AAAEAAIA/////wIAAwABAPz/AgAHAAAA/P8DAAMA//8BAAIA//8CAAIA//8CAAQA/v/+/wUABQD+//7/AwAEAAAA//8AAAMABAABAP7/AAAFAAMA/f///wUABAAAAAAAAQACAAMAAwD/////BAAFAP////8CAAQAAwAAAP7/AQAFAAMA/v/+/wIABQADAP7//f8EAAQAAQD//wEAAwACAP//AQAEAAEA/v8DAAMA//8BAAQAAAD//wMAAgD//wEAAgD//wAAAgACAAAAAAAAAAEAAQABAP7/AQADAAAA/v8CAAQAAAD8/wEABgACAPz/AAAEAAIA//8CAAEA//8AAAQAAgD+//7/BAAEAAAA/f8CAAMAAQD//wIAAgAAAP//AgACAAIAAAAAAAIAAwD//wAAAgABAP//AQACAAIAAAAAAAAAAgAAAAEAAQD///7/AwACAP///v8BAAIAAQD/////AgADAP7//f8CAAUA/v/7/wEABgAAAP3/AQACAP//AAACAAEA/v8AAAIAAwAAAP7/AQADAAAA//8CAAMA/v///wIAAwD///7/AQAEAAEA//8AAAEA//8CAAMAAAD+/wIAAgAAAAAAAQAAAAIAAgAAAP//AwADAP7///8EAAUA///+/wIABAACAP7//v8EAAUA///9/wUAAwD9/wEABAD+////BAADAPz/AQAFAAEA/P8BAAUAAQD8/wMABAD///z/BAADAP7//v8DAAEAAQABAAAA/v8CAAIA///8/wMAAwD///7/AgAAAAAAAAAAAP//AgD//wAAAAADAAAA///9/wUAAwD+//z/AwAEAAAA/P8BAAMAAwD8/wAAAgACAP//AAAAAAIA//8AAAAAAwD///7/AAADAAAA///+/wEAAgAAAPz/AAADAAAA/P8AAAIA/v/+/wEA/v/+/wIAAAD7////BAD///r/AAADAP7/+////wMA///8/wAAAgD///z///8CAP///P8AAAIA/v/9/wEAAgD8//z/AgABAP3//v8BAP///P8AAAMA/v/7////AwAAAP3//v//////AAD/////AAD+//3/AgACAPv//P8CAAAA/f///wAA////////AAAAAP7//v8CAAAA/f8AAAMA/v/8/wIAAgD9//7/BAACAPv//f8FAAMA+v/8/wUAAwD7//3/BAABAP3//v8DAAAA/P///wMA///+/wEAAQD9/wAAAgAAAP7/AAAAAAEAAQD///3/AgACAP7//f8DAAAA/v8BAAEA/f8BAAIA/v/9/wIAAQAAAAAA//8AAAEAAAD/////AAACAAAA/v8AAAAAAAAAAP///f8AAAIA///9//////8BAAEA/f/8/wIAAgD9//3/AQAAAP7//v8BAAAA/v/7/wAAAwD+//j/AQAEAPz/+P8BAAEA/f/7//////8AAP3//f///////P/+//3/AAD///3//f8BAPz/+////wEA/P/9//3/AAD///3/+f/+/wEAAAD6//v//v8DAP3/+v/7/wEA/v/9//r//v//////+v/+//3//v/9////+v/9//7/AAD5//7//v////r////9//7/+v////3////9//7/+f///////v/4/////v/+//v//v/8/wAA/P/8//3/AgD6//v///8CAPz//P/+/wEA/P/+////AAD7//7///////3/AAD8//7///8CAPz//P/+/wIA/f/+/wAAAQD7////AwABAPv//v8BAAMA//////3/AQADAAAA/P8CAAMA/v/8/wUAAwD9//7/BQAAAP7/AQACAAAAAQABAAEAAQAAAAEAAwABAP7/AwADAAAAAQACAP//AQADAAMAAQABAAAAAgACAAIA//8CAAQAAQD+/wMABAD+//3/BQADAP////8DAAIAAQD//wAAAQACAAEAAAAAAAEAAQACAAAA/v8AAAUAAgD8//7/BQACAP7///8CAAAA//8BAAIA////////AwAAAAAA/v8BAAAAAAAAAAIA/f///wEAAgD7/wAAAgACAPv///8AAAIA/v////z/AgABAAEA+f8AAAMAAgD7/wAAAAACAP7/AAD+//////8DAP3///8BAAMA+//+/wMAAgD7////AgADAP3///8BAAEA/P8CAAMA/f/7/wUAAwD+//z/AgACAAAA/f///wIAAQD8////AgABAPz///8AAAEAAAD///3/AQACAP7//P8BAAAA/f8AAAEA/P/9/wMAAQD7//3/AAAAAP/////+//3/AAACAP///P/8/wIAAwD+//3///8AAP//AgD///v//v8EAAMA/f/+/wEAAgAAAP//AQABAP7/AAACAAIA/v///wIAAgD//wAAAQAAAP//AQD//wEAAAD/////AgAAAP////8BAP//AAAAAAEA/v/+/wEAAwD9//z/AAADAP7//v/+////AAAAAP3//f8AAAEA/P///wAA///9/wAAAAD///3//v8AAAEA/f/9/wAAAQD+/wEA///+//7/AgABAP7//f8AAAIAAgD8//7/AQADAP3//f8DAAMA/P///wMAAgD9////AQADAP7/AAACAAQA/v/+/wIAAwAAAAEA//8BAAEABAABAAEA//8BAAQABQD9////BAAFAP//AQADAAQAAQAAAAAABAADAAAAAAAEAAIAAQABAAMAAQABAAIABAAAAAAAAQAEAAIAAQAAAAQAAgACAAAAAQABAAMAAQAAAAIAAgD//wIAAgAAAP//AwADAAAA//8BAAIAAQD/////AgACAP7//v8DAAAA/P8AAAMA///9/wIAAQD9////AQD///7/AgAAAP7//v8CAP3//v8CAAEA+/8CAAIA/v/7/wUAAAD7//7/BgD///7///8DAP7/AQAAAAIA//8CAP7/AQD+/wEA//8CAPz/AgADAAIA+v8BAAMAAwD4////AwADAPj/AQABAAIA+f8CAP3////9/wEA+/8BAP7/AAD5/wEA//////j/AAAAAAAA+P8AAAEA///5/wEA///+//v/AgD+//3//P8CAP3////8/wAA/P/+//7/AQD7//3//f8CAPz//P/7/wEAAAD9//j/AAABAP7/+P///////v/8/////P/9//7////9//3//P8BAP///P/6/wIAAAD7//r/AgAAAP7/+v8AAAIA///7/wAAAgD+//3/AwABAP3/AQADAAEAAAABAAAABAADAAAA//8EAAIAAgACAAMAAgAEAAMAAwACAAQAAQAFAAUABAAAAAUABgAEAAIABAADAAgABgACAAAACgAGAAMAAwAIAAQABgAEAAUAAwAIAAUABAADAAUABAAHAAQAAwADAAgABAAFAAQABQACAAcABwADAAAACAAGAAMAAgAGAAQABQACAAMAAwAIAAMAAQACAAgABAADAAAABgAEAAYAAAAEAAQABgABAAQAAwAEAAEABQADAAQAAAAFAAUABQD9/wUABQADAP//BwADAAEAAAAIAAEAAQAAAAYAAAAEAP//BQD//wMAAQAFAPz/AQACAAcA/f8BAP7/BQAAAAcA/P8BAAAABwD//wIA//8DAP//BQD//wQA/v8GAAEAAwD9/wYAAQACAP7/BAAAAAMA//8DAP7/BQD//wAAAgAHAPz/AAACAAYA//8CAAAABAABAAQAAAACAAIABAABAAMAAQADAAIABAACAAEAAgAFAAQAAwACAAIAAgAFAAQAAAABAAIAAwABAAMA//8BAP//AQABAAMA/f8AAAAAAwD+////AAADAPz/AgAAAAAA/v8DAP7/AQAAAAQA/f8AAP//BAD+////+/8FAAAA/v/8/wQA/v////3/AAD+/wMA/f/9//7/BAD9//7//P8CAAEA///8/wIAAgD+//z/BAAAAP7//f8EAAAAAQD8/wAAAAADAP//AQD+/wIA/v8CAP7/AQD7/wQA//////v/BQAAAP3//f8FAP///v/+/wQA/v/+//z/BQD///7//f8EAAEA///+/wIA//8BAP3/AwD+/wEA/P8BAP3/AQD5/wAA/f8BAPn/AAD9/wAA+f8DAPz//f/6/wMA/f////n/AgD7/wAA/f8BAPf/AQD+/wEA9v8BAP//BAD3/wIA/v8DAPv/AgD9/wMA/f8CAP3/BQD9/wEA//8GAP7/AQD//wQAAQACAP//AwAEAAQA/v8CAAMABgD+////AwAIAAAA//8DAAcAAQD+/wQABgADAAIAAQADAAQAAgACAAIAAQABAAQAAwAAAAEAAwABAAIABAACAP7/AwADAAQAAAAFAAAABwADAAcAAQAEAAIABwABAAMAAwAHAP//BAAEAAYA/f8GAAMABwAAAAYAAAAHAAAABwAAAAUA/v8GAAAABwD+/wEA/v8GAP///v/8/wMA+/8BAPz//v/6/wEA/P/+//r//v/8//7/9//+//z//v/3////+v////r/AAD3//z//f////X//P/9//7/9v/9//z////4////+v8AAPv/AAD6/wAA/P8CAPn/AAD7/wMA/P/+//n/AwD+//3/+P8DAP3//f/6/wIA/P/8//z/AQD8//z/+v8CAP3//f/6/wEA+//7//7/AwD4//n//v8FAPr/+f/6/wMA/f/7//r/AQD7//3//P////z//v/9//7//P////3////7/wEA/f/+//3/AQD9//7/AAD9//z//v8AAP7/+//+/wEAAAD8//z/AwAAAPz//P8CAAAA/f/8/wEAAAAAAP3/AAABAAEA/f8AAP//AwD///7//f8EAAIA/v/8/wQAAwD//wAABAACAAAAAwAGAP7///8BAAUAAQD+//7/AgAEAP//AAAAAAMAAQABAP//AgADAP3//f8AAAMA///+//z/AgAAAP3//P8CAP///f/+/wAA/P8AAP///f/8/wIA/v/8//3/AAAAAP///f/+/wEAAAD+//z/AQABAAAA/v/+/wAAAgD//wEAAAABAAEAAwD+////AQADAP////8AAAAA//8DAP/////+////AwD9//3//P8EAP///v/7/wEAAAD///7/AAD+/wQA/P////v/AgD7/wAA+f////z/AwD8//7//P8EAPz//v/9/wYA+f/+////BAD6/wEA//8CAP3/BAD9/wAA/v8DAPz/AAAAAAIA+/8BAAAAAAD7/wIA/f/9//z/AgD5//3/+P8BAPf/+//3////9//5//X//P/5//j/8//8//T/9//0//3/8P/5//b/+v/x//v/9P/3//T//P/x//j/9//7//L/9//6//3/8v/3//v//v/x//n//f/8//T/+//6//z/+P/8//v/+v/6//3/+//7//X//v/6//j/8//+//v/9//0//7/+P/0//f/AAD2//X/+f////f/9//6/wAA8//5//b//v/0//z/9P/7//L//f/z//j/8v/8//P/+f/x//n/8P/7//D/+f/x//v/8f/2//L//P/3//j/8v/9//b/+v/2//v/8v/+//n/9//x/wIA9v/5//P//f/2//v/9f/8//b////1//z/+P/+//f/AAD2//z/+f8BAPb//f/4/wAA9//+//r////5//7//P////n/AQD7//3/+v8FAPz/+//6/wMA/P/+//j/AQAAAAEA9/8BAAEAAQD9/wAAAwACAAUAAgADAAEABgAFAAYAAAADAAcACgD//wYABgAPAAEACwAFABAABAAQAAQAEgAFABEABAARAAgAEwAHABIACgAVAAcAFAAKABcABgAZAAkAGAAJABgABwAXAAkAFgAGABgABwAWAAgAHQAGABcACwAeAAgAGwAMACAABwAgAA0AIgAKACAACgAjAA0AHgAHAB0ADgAaAAcAFgAJABsABAAZAAYAGQADABwAAwAZAAQAFQACABgAAQASAAAAFQD+/xAAAQATAPv/DwADABAA+f8JAAIADQD6/woAAQANAPv/DAABAA4A/v8OAAMADQABAA0AAQAQAAUADgAEABEACAAOAAYADwALABEABwATAAsAFAAHABcADQAVAAoAGAASABUACgAVABMAGQALABcAEQAcABAAGQASABgAEgAWAA8AGQAQABYADgAWABEAEQAOAA0ADAAPAAoACwALAAsACQAGAAcACAAHAAQAAAADAAcAAgD7/wAABAD9//r//P/+//n/+f/4//r/9//5//X/8//1//f/8//y//H/9f/z//P/8//1//H/+P/w//X/9P/3//T/9v/y//b/9//3//L/+f/0//f/8P/4//P/9P/w//n/8//5/+3/9v/x//z/8P/3//D/+v/3//z/8f/8//P/AADz//n/8v8AAPX/+//w/wAA8f/9/+7////v//3/7P/9/+3////u//3/7P/+//L//f/t/wAA7v8AAPD/AADu//7/7//+//P////w/wEA8P8AAOv/AQDu/wAA5/8CAO3//P/u//7/7v/+//L/AgDw//v/9/8EAPP/+v/x/wMA8v/+//L/AQDy/wMA8v/9//T/AgDz////9v////L//v/5//3/9v8AAPj//P/+////9//9//3/AQD4////+P/9//n//f/1//v/9v/7//L/+v/v//r/7P/3/+z/+P/s//X/7v/y//D/9v/y//P/8f/2//P/8//u//X/7f/1/+r/8v/s//T/5P/v/+n/8v/o/+//6f/z/+3/9P/n//P/8P/3/+z/9P/x//v/8v/1//P//f/1//3/9P8DAPb////5/wQA+f8BAAEABQD7/wgAAgAJAPv/DQD//woAAgAQAAIACwALABIACQANAAkAFAAPAA8ABwAVABAADwAHABUADwATAA0AFwALABMADgAVAAoAEQANABEACgAQAA8ADAAIABEACAAOAAEACwAJAAsABwAIAAoACwAKAAoACwAJAA0ADAALAAgADwAHAA0ACQAQAAgADAAHABIACAAOAAQAFQAJABIABwAVAAgAGAAIABcABgAcAAkAHQAFAB8ACQAiAAYAIwAGACQACAAmAAQAIAAHACUAAwAcAAYAIwAHABkAAwAfAAcAGwAAAB4ACQAaAP//HQAGABUA//8bAAIAGAABABgA/v8WAAMAEAD8/xAAAwAIAPv/CwD//wgA+/8KAPz/CwD5/w0A+/8MAPn/CwD+/wQA+P8JAPn/AQD2/wUA9P8BAPj////y/wAA+P/3//T//v/2//b/9//+//X/+v/6////9f/8//r//P/2//j/+//5//n/9//8//H/+//0//z/9f/+/+7//P/4/wAA7//9//n/AwD4/wIA/P8IAP//BAAAAAsAAAAGAAIACwD+/wcAAgALAP3/CwD6/woA//8KAPj/CQAAAAsA+/8HAP3/CgABAAYA//8JAAMABgD8/wYAAgAEAPb/BwD9/wIA9P8EAPn/BgDy/wIA9f8FAPX/AgD7/wIA9/8FAPj/AQD7/wIA/v8CAAAABQABAAcAAAAHAAUACAAHAAcABgAKAAYABgABAAoAAAAHAAAABQAAAAYABAD//wEABQACAP3/+/8AAPj/+//0//n/9P/4/+7/9P/x//D/6//x//H/8v/t//D/7f/z/+z/6f/u//D/7f/r/+z/7f/l/+z/6f/r/+H/6v/l/+v/5P/i/+n/6f/q/+b/5v/o/+f/6//n/+b/6v/u/+z/5v/w/+z/8v/o//n/7P/3/+z/+P/r//f/7v/x/+r/8P/u//H/6P/4/+z/+f/v//v/8P/8//L/AwDx/wkA9/8MAPj/EwD8/xEA/v8ZAAEAFgADABQABQAXAAUAEwAHABcACQAYAAcAGwAPABoADQAcABAAGgAOABwADwAbAA8AHwASABcAEwAaABIAEgAUABMAEQASABEADQAPAA4ADgAKAAsADAAPAAMACQAIAAoAAAAIAAIABwD7/woA/v8FAP7/BAADAAUA/P8HAAAABQD3/wgA/f8FAPP/CAD1/woA9/8GAPj/CQD//wUAAQAHAAMABAAGAAsA//8GAAUACgD//wgAAAAJAP3/CQD8/wwAAQAFAAIACwAFAAEAAwAJAAcABAABAAcAAgAAAAMABAD9/wAABAAGAPr/AAACAP7///8BAAAA+//9/wEA/P/5//3/AQD4//r//f/9//r/+f/+//v/+//8//j//f/2//3/9v/8//b//P/2//r/9f/9//f//P/4/wEA+f/8//f/BAD7//v/+P8AAP3/+//7/wEA+/////z/AQD6////+/8CAPv/BAD7/wQA/v8CAP3/AwD9////+/8CAPz/+//6/wIA///4//r//v/+//j/+v/5////+//6//n//f/8//r/+v/9//z//P/7//z//f/+//v//v/7/wAA+v8AAP3/AAD7/////f/9//7//f////3//v8EAP7/BAD//wgAAgAIAP//DQD8/xAAAAANAAIACwAEAAYAAQAGAAEACAD+/wcAAAANAPv/CgABABIA/f8MAP7/FAD//xAA//8UAAMAFQABABMABgAXAAIADwAKABYA//8SAAcAFgACABcABgAOAAcAEQAKAAUADAAFAAcACAAFAAgACAAQAAYADQAPAA8ABAAQABAACgAKAAsADwADAAsAAgAOAAEACwD//w8A/v8MAAMACAABAAwACQADAAkACwAEAAgABwAIAP3/BwAJAAgAAQAJAAoACQAEAAgACAADAAYABgAAAAEAAgACAPr///8AAP3//P/7/wEA+v/9//n/BAD7//3/+f/+//3//f/5//z/+/8BAPn//v/7/wAA+//8///////9//j/AAD2////+f////b//v//////+v/9//n/BQD7////9f8FAPf/AgD1/wUA9/8HAPn/CQD2/wsA+v8MAPX/DgD4/wwA8/8RAPf/EAD3/xIA9/8SAPj/FwD0/xQA+/8bAPH/EwD7/xgA9v8YAPz/FgD+/x4A+v8YAP//HgD//xoABAAWAAcAHwAIABoACQAeAAsAHwAKABwACgAlAAgAHgAKABsADAAeAAoAFgAJABcADgAVAAwAEAAQABcACQARAA8ADgAPAAwAEQAIAA8ADAAOAAgADAALAAkABwAEAAUACgACAAMAAAAKAP7/AgD//woA+v8IAPn/CwD1/woA9/8IAPP/DAD1/wQA7f8OAPD/DgDs/xMA8v8RAO//CgDv/w0A6P8KAOn/CwDn/wkA6P8JAOL/CwDj/woA3/8KAOP/AgDb/wYA4f8AANn/AQDi//7/1/8BAN//AQDZ/wIA4P/9/97//P/f//r/4P/2/+H/9//g//X/4P/3/+D/9//j//L/4//z/+X/8f/n//X/4//1/+z/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7//1//L/8P/x/+//9v/v//j/6//5/+z/+//s//z/6f/9/+7/AADl/wEA8P8EAOT/BgDw/wkA5/8HAO//CwDt/wcA7/8LAPD/CADy/wwA8f8LAPb/DQD0/w0A+P8OAPv/DAD5/w4AAAAJAP3/CwAEAAkAAgAJAAcACgAIAAoACgALAA0ACwARAAoAEwAJABYACQAXAAkAGgAMABsACwAeAA0AHgAMACAACgAhAAkAJAAIACMABwAjAAsAIwAKACIADwAeAAsAJAAQABoACgAfAAoAGwAIABUABAAXAAgAEAADAA0ACAAJAAQABwAJAP//AgABAAgA9v/+//b/BADx//3/6//6/+f//f/j//L/3v/6/9z/8f/X//X/1f/w/9P/8P/S/+z/zP/u/9L/6v/I/+v/0f/p/8z/5//R/+j/0//m/9P/5//X/+n/2v/q/93/7P/j/+7/5P/x/+//8v/v//b/+v/6//z//P8EAAEABwAHABIABgASABMAIQAPAB4AGQArABsAKQAaADUAJgAxAB0APQAoADgAJQA+ACgAPQAuAD4AKQA+AC4AQAAoADkAKQA9ACYAMQAiADUAJgAnABoAKgAeABwAEgAfABMAEgALAA0ACQAHAAIA/P////v/+v/u//T/7v/w/+P/6P/e/+X/2v/c/9H/2v/S/9P/x//T/8r/zv/A/87/xf/N/8D/yv/A/87/xf/I/7//y//K/8v/xP/J/87/0P/K/87/1v/W/9f/1//f/9z/5v/d/+v/5//y/+j/9v/0/wEA9f8AAP7/EQACAA0ABAAbAAwAGgALACQAFAAkABcALAAbACsAIQAwACIAMQAoADQAJgAxACgANgAmAC4AJQAxACYAKwAjACgAIgAjAB8AIQAcABsAGwAWABcAEgASAAgAEAAHAAwA/P8JAPz/BQDw/wIA8P/7/+j/+v/k//T/4f/x/9v/8v/a/+3/1v/x/9b/8P/T/+z/1v/x/9T/6f/X/+z/2f/s/9v/6v/e//L/4v/z/+T/+f/s//n/8P/+//b//v8AAAMAAAAGAAwACgAOABIAFwATAB0AHgAkABoAKQAjADIAIQA0ACUAPQApADsAKgBEADQARAAtAEUAOABJAC4ARQA1AEgAKwBEADAAQwAmAD0ALQA7ACUAMwAkAC8AIAAoABoAIgASABkADgAUAAYABwD//wUA/f/2//f/9P/y/+b/8//m/+b/2P/r/9f/3f/O/+H/yP/Y/8f/2f+7/9j/vv/T/7j/1v+2/87/uP/T/7X/z/+3/9L/uP/Y/7r/1/+8/97/wv/h/8P/4//M/+f/0P/q/9X/6v/f//T/4v/y/+v//v/z//7/9v8IAAYACQAEABIAEgASABcAGAAbABoAKAAdACcAIAAwACMANQAlADYAKgA+ACcAPgAuAEMAKgBCAC4ARgAtAEIAKwBFAC4AQgAnAD8AKQA/ACIAOgAiADcAHgA0AB4ALQAcACoAGQAjABgAHgAVABoAEQARABAADgAIAAUACAAAAP//+v////P/+P/s//f/6v/1/+D/9f/f//L/1//z/9b/7v/R/+z/0P/r/8z/5v/K/+b/yf/l/8j/5//J/+T/yf/r/8n/4P/P/+v/zf/h/9P/6P/U/+X/2P/m/9z/6v/h/+f/5f/o/+v/7f/u/+b/9f/x//n/6v////L/BQD0/wgA8/8PAPr/EgD0/xgA+/8dAPX/HgD7/yQA+f8kAPz/KQABACoAAgApAAYALwAHACgACQAwAAkAKAAKAC0ACQAmAAwAJgALACQAEQAfAA4AIAAUABkAEwAXABUAEwAWABAAFQALABkACAAVAAQAGQD+/xIA/f8XAPf/EwD3/xEA7/8XAPP/DgDp/xgA7/8SAOf/FADs/xUA5v8QAOr/EADm/wsA6v8JAOn/BwDr/wUA7v8EAOv/AgDz/wQA8P8BAPT/AAD5//7/+P/7//7/+P/9//f/AgD0/wQA8/8GAPH/CQDt/woA7f8NAOv/EADr/w4A6/8RAOz/EADq/xMA6/8QAOn/EwDl/w4A6P8RAOT/CwDo/w8A6P8IAOn/CgDu/wYA7v8EAPP/AwD0////9v/8//r/+//6//f//P/4//3/8f////L/AwDt/wUA7/8GAOr/DQDr/wsA5/8SAOr/DgDm/xQA6f8PAOX/FwDq/w4A5/8VAOr/DQDq/xIA7f8PAO3/DwDw/xEA8f8MAPX/DQD5/wkA+f8FAP3/BgACAAAAAQADAAsA/P8GAP7/EAD7/xEA+P8SAPv/GAD1/xUA9/8cAPX/HADy/xsA8/8iAPD/GwDx/yIA7/8dAPH/HgDy/x8A8/8aAPb/HAD1/xcA+v8XAPf/FQD+/xAA+f8RAP7/CQD9/wsA/f8FAAMAAwADAP//BwD9/woA+v8HAPb/CwD2/wwA7/8LAPL/EgDr/wkA7P8RAOr/CQDp/wsA6P8KAOj/BwDm/w4A5f8IAOj/DwDj/wUA6/8JAOb/AQDs////6v///+v/+f/w//r/7P/4//X/9P/x//X/9f/x//n/8v/1//D////v//n/7/8BAOr//v/t/wIA5/8EAOr/AgDn/wgA6v8EAOj/CADu/wcA6f8IAPP/CQDs/wcA9P8MAPD/CADz/wsA9/8LAPb/CAD6/w4A/f8HAP//DgAFAAgABwANAAkACQANAAwADgAMAA8ACQATAA8AEQAIABgADwAUAAkAGgANABkACwAaAA0AHQAJABwACwAcAAoAHAAJABsACgAYAAgAFwAHABQACQARAAMAEAAHAA4AAQAKAAMACQAAAAUA/v8AAP7/AAD4//f//P/3//T/7//3/+//8//o//D/6f/v/+X/7f/k/+r/4v/p/9//6P/e/+X/2//k/9r/4//X/+D/2v/g/9b/4P/Z/97/1v/f/9r/3v/b/9//3//f/+D/3//j/+P/5v/h/+f/5v/r/+f/6//p/+7/7f/y/+7/9f/y//r/9v/8//j/AwD8/wYA/v8MAAMADQAIABIACQATAA8AFgASABgAEwAYABsAHAAYAB0AIAAeACAAIwAhAB8AJgAnACQAIAAnACYAKAAiACcAIAApACIAJwAZACcAHwAlABQAJgAaACAAEwAiABMAGQATAB8ADQASAA4AGQAIAAsABgASAAUABgAAAAgA/f8AAPz////2//r/+f/3//L/8f/2//H/8v/s//D/6v/y/+b/6P/k/+//4//n/9//6f/i/+j/2v/o/97/5//b/+r/2//n/9v/6v/c/+n/2//q/97/6//d/+v/3//t/+P/7P/j/+7/5//v/+f/8f/s//H/7P/0//H/9f/0//n/9v/5//n/+//9///////9/wMAAwAGAAAABQACAA8ABgAJAAMAEgAJAA8ABwARAAkAFgALABIACgAYAAsAFwANABcACgAbABEAFwALABsAEwAaABEAGAARABwAFwAWABEAHgAYABMAFAAdABgAEwASABoAGQATABAAFgAZABIAEwAUABYADgAVABEAFAANABQACwASAAwAEgADABIACwAPAP//DgAEAAoA/v8KAPv/BQD8/wgA9v8AAPb/BgD0//7/7v8AAPD//P/r//r/7f/4/+j/9P/o//X/5P/u/+b/8v/h/+3/4v/u/+L/6//e/+r/4//o/9v/6P/j/+b/3P/m/+T/5P/e/+P/4//k/+X/4P/i/+X/6v/h/+T/5//t/+T/6//p//D/6v/x/+z/9P/u//r/8f/3//P/AQD1//7/+P8GAPn/BQD5/wwAAQAKAP7/EgAHAA8ABwAWAAoAFwAOABoADQAZABAAIQARABoAEAAkABQAHQATACIAFAAgABQAIAAUAB8AFAAfABIAHQAPABsAEgAZAAoAGQARABIABgAXAA0ACAADABIABwADAAAACQD//////P////j/+v/3//X/9P/1//D/7v/x/+3/6P/r/+z/5P/m/+b/5v/e/+f/4f/j/9r/5//f/+L/1//l/97/4P/X/+b/3P/i/9n/5//c/+X/3//r/9z/6f/l//H/3//s/+r/9//l//X/8P/8/+z/AQD5//7/8/8KAAEABgD8/w8ACQARAAQAEgARABgADQAZABcAHAAXACEAGgAhACAAJQAhACUAJAAlACYAJgAqACUAJwAmAC4AJQAoACcALAAiAC0AJgAnAB8ALAAdACcAHQAmABQAJQAVACAADwAhAAsAGQAJABsAAwATAAEAEgD//w4A+f8HAPz/BgDy/wIA9f/8/+///f/w//L/7f/2/+3/7f/r/+3/6f/q/+n/5f/r/+X/6P/k//D/3//r/+L/8v/e/+//3v/z/+H/9f/e//j/4f/5/+D////i//7/4/8EAOb/AwDp/wcA6f8IAO3/DADu/wwA8v8QAPX/DgD3/xMA/P8TAP3/EgACABgABAASAAcAGgAJABMADgAZAA4AEQATABUAFAARABQAEAAYAA4AGAAOABgACgAcAAoAGAAGABoABgAbAAQAGAABABkAAAAZAPz/EwD9/xYA+P8RAPj/EAD0/xAA8v8JAPL/CwDs/wQA8v8FAOr////w/wEA7P/2/+3//v/u//D/6//5/+3/7f/q//H/7v/s/+v/7P/v/+n/7f/o//H/6P/v/+b/9P/p//D/5P/0/+r/9P/l//T/6//5/+f/9f/t//v/6v/6//H/+v/x/wEA8f/8//f/BQD3/wAA/P8FAP//BgD//wMABQAJAAQABAALAAYACgAIABAABgAPAAgAFAALABMACAAWAAwAGQAMABYACQAcAAwAGQAHABkACQAbAAYAFgAHABkABAAVAAcAFwAAABEABgAVAP7/DAACABEA/f8IAP//DAD8/wQA/v8GAPz/AAD7/wEA+v/7//n//P/4//n/9v/2//n/9f/4//H/+//x//j/7v/9/+7/+P/u//j/6//7/+3/9v/o////7//9/+b/AQDx/wUA6v8CAPH/CADw/wUA8/8JAPP/CAD4/wwA9/8KAP7/DQD7/wwAAgALAAEAEAAIAAkABgAUAAsADAAJABIADwAQAA8ADgAQAA8AFQAOAA8ACwAZAAoAEAAKABgACAATAAkAFgAHABUABgAVAAQAFAAEABIAAwAUAAAADwABABAA//8OAPr/CwD//woA+P8HAPz/BgD5/wEA+/8BAPj////5//r/9P/9//f/9f/1//f/9P/0//X/8v/z//P/9//w//T/8P/3/+//+P/w//r/7f/7//P//v/t//3/9f/+//D/AQD0////9v8DAPX/BQD8/wUA9/8JAP//CQD9/wsAAQANAAIADQAGABAAAwAMAAsAEQAFAAoADQARAAoACwAOAA8ACwANAA8ADQAMAAwAEQANAA4ACQANAA4AEQAHAAsACQAQAAkADAAAAA0ABwAKAPz/DQACAAMA/v8MAAEAAgD7/wYAAAAEAPn/AQD8/wIA9//+//r/AAD0//v/9v////T/+v/1//z/9f/8//b/+P/2//3/+v/4//f//f/+//v/+P/9//3//P/+/////f/+/wMAAQD/////BgAEAAQAAgALAAUACgAGABAABgAOAAkAEwALABEACQASAA4AEgALABQADQARAA4AFgAMABAADwAWAAwAEAAMABUADQAOAAoAEQALAA4ACQAKAAkADQAFAAEACAAHAAIA//8CAP//AgD9//3/+/8AAPf/+f/3//3/9P/2//L/+v/w//T/7//2/+r/8//r//P/6P/x/+j/7//n//L/5//t/+r/8P/p/+3/7P/v/+n/7//s//D/6v/w/+3/8P/t//L/8P/y//H/9P/1//X/9//2//f/+f/+//n/+//9/wMA+/8DAAAABAAAAAcAAgAGAAYACAAEAAoACAAJAAcADQAJAAwACwANAAkADwAPAA0ACgAOAA8ADgANAAsADAALAA8ACQAMAAgADAAHAA0ABQAKAAQACQADAAoAAwAGAAAACAD+/wQA/v8FAPn/AQD+/wMA9P/+//r////y//3/9v/7//L//P/0//f/8f/7//f/9f/y//f/+f/2//L/9v/5//X/8f/1//n/9f/z//L/+v/4//j/8P/7//j/+//z////9/////b/AgD3/wQA9/8FAPr/BgD7/wkA+/8IAP7/DQD8/wwAAAAOAAAAEwAEAA4AAwAVAAYAEAAGABQACQAUAAgAEwAKABQADQASAAoAEgAPABEADgARAAwAEAASABAADAARABIADQAPABAAEQAKABAADQAPAAcAEgALAA4ABAARAAYADwACAA0AAwAQAP7/CwADAA0A+/8MAAAACAD5/wkA/f8GAPj/BQD4/wQA9v8BAPT////z////8//7//D/+f/z//n/7v/0//L/9//t//D/7//0/+z/7f/u/+//6//t/+7/6v/s/+7/7//o/+r/6//y/+j/6v/p//T/6v/w/+n/9P/p//X/7P/0/+n/9//w//b/6f/4//P/+P/s//3/9v/4//H/AwD3//v/9/8FAPr////9/wcA/v8DAAAABwAEAAcABAAJAAcABwALAAwACQAIABAACwAMAAsAEwAKAA4ADAAVAAsAEQAMABYACgAUAAkAFAALABcABwASAAgAFgAEABEABwAUAAMAEAAEABAABAAOAAEADAACAAsA//8IAAAACAD+/wIA/f8HAP///f/7/wIA///6//v//f/9//j//P/4//3/9v/9//H//v/2//7/7v8AAPT//v/s/wAA8f///+3////u/wIA7v/+/+v/AwDw////6f8DAPL/AADr/wEA7/8CAO7/AQDw/wMA7v////T/AADw/wEA9P/9//P/AgD3//v/9P8BAPv//P/2/////f/8//r//f/+//v//v/9/wEA+f8AAPz/AwD4/wIA/P8FAPj/BAD9/wkA+f8DAP3/CwD7/wgA/f8JAPz/DgD//wcA/f8OAAEACwD9/wwAAgAMAP//CwACAA0AAAAIAAMADwADAAYAAwALAAQACgAEAAUAAwALAAQABAAFAAQAAQAGAAUAAAABAAQAAwD9//////8CAPv//v/+//7/9//+//v/+f/2//3/9v/2//b//P/z//T/9P/6//L/8v/w//f/8//z/+7/8//z//T/8P/y//D/8v/y//T/8f/v//L/9v/2//D/8v/3//r/8//1//n/+v/3//v//f/8//n//////wEA/P8DAAIAAwAAAAgABgAHAAUACgAJAAwADQANAAsADgAOABEAEAAQAA0AEwAUABIADQASABYAFAAMABIAFgASAA0AEQASABIADAANAA8AEQANAAoACwANAAsACAAHAAgABQAFAAQABAD+/wIA/P/+//r//P/1//n/9//4/+//9f/x//P/7f/w/+v/7//r/+3/5//r/+j/6v/l/+n/5P/n/+X/6P/i/+b/5//l/+P/6P/n/+X/5f/o/+r/6v/p/+j/7//t//D/7f/y//H/9//x//T/9//9//P/+f/9/wIA+v////7/BgADAAcAAAALAAgADAAHAA4ACgANAA4AFAALAA8AFAAWAAwAEwAVABUAEgAUABIAFgAXABUAEQAVABYAEwASABQAEwASABMAEAAQABAAEAAMAA8ADAALAAgADAAIAAgABQAIAAIABAADAAQA+////wAAAQD4//z/+f/7//f/+f/y//f/9f/2/+//9P/y//L/7//z//L/8P/u//H/8v/v//H/8P/w/+//8//x//P/8f/y//L/+f/x//X/8//7//T//P/2//z/9/8CAPn/AAD6/wMA/P8FAP3/BQD//wkAAQAIAAEACwAGAAsABAALAAgAEAAGAAsACgARAAkADQANAA8ACgAPAAwADAANAA4ACgAJAA8ACwAJAAgADQAHAAsAAwAIAAcACQAAAAgAAwAGAP//BgD+/wIA/v8EAPv//v/6/wIA9//7//b//P/2//v/8//1//T/+//y//L/8//1//H/8v/y//L/8v/x//L/8f/x/+7/8f/w//L/7//x//D/8//t//P/8f/3/+//9f/y//3/8P/3//T//v/1//z/9f////n//v/4/wUA+/8AAP7/BwD9/wYAAgAHAAIACwAEAAkABwAPAAcADgAKABIADAAQAAwAFgAQAA4ADwAaABAADwAUABgADwASABcAFAAQABIAFgATABIAEgAUABAAEwATABAACgAUABEADgAHABEACwAPAAYACQAIAA8AAwAFAAQADQACAAEA/f8JAP///v/5/wQA+//9//f//P/5//v/9f/6//f/9v/z//r/9v/y//H/9//2//H/8v/1//b/8f/0//P/9P/x//f/8v/0//H/+P/0//f/8P/6//f/+P/y//7/+P/9//T//v/8/wIA+P8AAP3/BAD9/wQA//8EAAEABwAEAAYAAwAHAAgADAAGAAYACwAOAAsACQAMAAwADwAOAA8ACgAQAA8AEQALABIADgARAAkAFQAMABAABgAVAAkADwAGABQABQAOAAUAEgADAAwAAQAOAAMACwD9/woA//8JAPv/BgD4/wUA/P8CAPP/AQD5//7/9f/8//T/+v/2//n/8v/3//X/9f/x//P/9f/z//H/8P/2//L/8//u//X/8f/1/+7/9//v//n/7//4//D/+//t//z/9P/9/+3//v/3/wAA8P8BAPj/AgD0/wMA+v8DAPj/BgD+/wUA/P8JAAAABQABAAsAAwAGAAQADQAHAAYABwAMAAkABwANAAkACAAIABIABgAJAAgAEwAEAAwABwAQAAQAEQACAA4ABgASAP//DgAFAA4AAQARAP//CwACABAA/f8LAP7/CwAAAAsA/P8JAP//BgD//wkA+/8DAAEABwD5/wEAAgADAPn/AQACAAAA/v8AAAAA/v8BAP7/AAD+/wMA/f8CAPz/BAD8/wUA/f8FAP3/BwD9/wcA/P8JAP3/CAD//w0A//8GAP//DgABAAsA//8KAAQADQACAAkAAwANAAYACwADAAwABwAKAAcACgAHAAoACQAIAAkACQAHAAUADAAKAAcAAQALAAoACgD//woABgAKAAAACQACAAkAAQAJAP//CQABAAgA/f8GAAAACAAAAAQA/f8IAAIAAQD9/wcAAQD//wEABwD///7/AwAFAP///f8EAAQAAAD8/wQAAQAFAP7/AgD//wYA/f8EAP7/BQD+/wYA/f8EAP3/BwD8/wUA/v8GAPz/BQD//wQA+/8FAAAABAD6/wMAAQADAPr/AQACAAEA/P8BAAEA///+//7/AAAAAAAA+///////AgD6/wAA/P8BAPr/AQD5/wEA+/8CAPf/AQD6/wIA9v8BAPn/AgD2/wMA+f8CAPb/AgD4/wMA9v8BAPn/BAD2/wEA+/8BAPj/AwD7/wAA+v8DAPz/AQD8/wMA/f////7/BQD/////AAACAAIAAwACAP//AgAEAAQAAAAEAAIABQACAAYAAQAHAAEABwACAAcAAAAJAAQABwD//wkAAgAJAAIACAD+/woAAwAHAAEABwD+/wgABQAFAPz/BQADAAQA//8EAAAAAQAAAAQAAAD//wAAAgD//wAAAAD+/wAA/v/+//v/AwD///v/+f8FAP3/+//5/wQA+//8//v/AgD5/////P8DAPf//v/+/wQA+P/9//z/BAD8/wAA+v8CAP//AAD7/wMA/v////7/BAD9/wEA/v8BAAEAAwD/////AAADAAIAAQAAAAEAAwAEAAQA//8BAAMABwACAAMAAAAHAAQABQAAAAQAAgAIAAMAAgD//woAAwABAAEACQD//wIABAAIAPz/AwADAAcA//8EAP//BAABAAQA/P8DAAIAAgD9/wMA/v8AAAAAAQD5////AQD+//v////9//7//P/9//v//v/9//r/+//8//v/+//8//j/+f/6//7/+P/3//f//v/5//j/9f/7//r/+//1//r/+v/8//b/+v/4//3/9//6//n//v/2//z/+v/8//X//f/6//7/9//7//j/AAD5//z/+f/+//n////8//7/+v////7//f/8/wIA/f/7//3/BQD///3//f8BAAIAAAD/////AQACAAMA//8CAAMAAgD+/wYAAwAAAP7/BwAEAAEA/v8GAAQAAQD9/wcABAAAAP3/CAACAAEA//8FAP//AwD//wIAAAAEAPz/AAAAAAQA/f/+//z/AwAAAPz/+v////7//f/7//z//P/9//v//P/8//r/+f/9//z/9v/5//z/+v/2//n/+//5//f/+v/4//b/9//8//r/9f/0//r/+//3//P/+f/8//f/9v/4//r/+P/4//j/+P/4//z/+f/6//X/+v/8//7/9//4//r/AAD7//v/9//+//3/AAD3//z//v8DAPn//f/9/wIA/P/+//v/AQD+/wAA/P8CAPz//////wMA/P8AAAAAAQD//wEA/P/9/wIABAD6//z/AwADAP7//P/+/wEAAQD+//7//P//////AAD7//7//f8BAP3//P/6/wIA///7//r/AQD///7/+f/8//7/AAD6//v///////r//v////v/+////wEA+//8//7/AwD9//r//f8FAP3/+//9/wYA/v////z/BAD+/wQA/P8CAP//BQD9/wMA/v8GAP7/BQD8/wUAAQAGAPv/BAABAAcA/P8EAP//BQD//wQA/P8EAAAABAD8/wQA//8CAP7/AwD9/wMA/v////3/AwD+//z//f8BAP3//f/9////+//8/////f/7//7//P/6//z//v/9//r/+v/8/wAA+//4//z////4//v//v/+//n/+//7/wAA/f/7//n/AAD///7//P/+//z/AQAAAP7//v8DAP////8BAAMA/v8AAAMABAABAAIABAADAAUABQAEAAMABwAHAAUABgAKAAQABQALAAwAAgAGAAwACwAGAAkABwAJAAsACgAEAAkACwAJAAQACwAKAAYABAAMAAkABgACAAkABwAHAAMABgAEAAMAAwAHAAAAAAADAAMA/v8AAAEA///+/wAA/f/9/////v/5//z/AAD6//j//P/8//j/+f/7//n/+P/6//n/+f/2//b/+v/8//b/9P/4//3/+P/1//j/+v/6//r/+v/4//r//v/8//n/+v/9/////v/7//v/AAACAP///f8CAAIAAQAAAAUAAwAEAAIABgAGAAcAAgAHAAkACQACAAcACwAMAAQABwALAAwABwALAAkACQAIAA4ACgALAAgACwAKAA0ACAAKAAgADQAJAAoABwAKAAgACQAHAAkABQAGAAcACAADAAQABgAHAAIABAADAAIAAwADAAAAAAADAAEA/v/9/wAA///+//z////8//v/+/////r/+//6//z/+P/9//n/+f/5//7/9//7//z/+//1/////f/6//f//v/7////+//7//r/AgD///z/+/8DAAAA/v8AAAQAAAAAAAIABAADAAMAAgAEAAgABgAAAAQACAAHAAUABgAGAAYACAAGAAcACAAIAAUACQAJAAoABgAHAAcACwAGAAgACAAJAAQACAAIAAcAAwAHAAUACQAEAAMABAAHAAEABQADAAIAAQAGAAIAAAD//wMAAAADAAAA/P///wMA/v/7/wAAAQD6//z/AgD///r/+/////3//f/9//z/+f8BAP//+v/6/wAA/P/+//3//P/6/wQAAAD6//n/AwAAAP//+v8AAAIAAgD8/wEAAQACAP//AgAAAAUAAwABAAAABgACAAMABAAGAAEABAAGAAcAAwACAAYACgAEAAIABQAKAAgAAwACAAkACwAEAAIACQAIAAMABgALAAUAAQAHAAoABgADAAcABgAFAAUABgAFAAUABgAFAAMAAwAGAAcAAgD//wUACAAEAP//AgAFAAgA///+/wMACAD/////AwAFAP//BQADAAEA/f8GAAIAAgD+/wMA/f8GAAIAAgD6/wQAAgAEAPv/AgAAAAQA/P8EAP//AQD+/wcA/f/+/wAABwD9/wEAAAADAP//BQAAAP//AQAHAP///v8EAAcA/v/+/wMABwACAP//AgAFAAQAAAAFAAUAAQABAAgABQADAAEABQAFAAcAAwAEAAMABwAGAAcAAgAGAAYACAAEAAcABQAGAAYACAAEAAMABgAKAAUAAQAFAAkABQABAAUABgAFAAIABAADAAUAAgADAAAABAADAAIA/v8FAAMAAAD7/wUAAgAAAPr/AwD//wEA+f8AAP3/AgD4/////f8AAPX/AAD///3/8v8AAAAA/v/x//7//v/+//T//v/7//7/9v/9//r////4//v/+v8AAPr//P/6/wAA+//8//z/AAD8//7//v8AAP7/AAD+/wAAAQABAAAAAAABAAMAAQACAAEAAgAFAAIAAQADAAkAAwAAAAUACgACAAIABQAHAAQABQAFAAUABQAFAAUABgAEAAQABQAEAAQABQAEAAAABQAFAAMA//8EAAIAAgD//wIA/v8EAAAA/v/8/wUA/v/8//z/AwD6//7//f////j//v/9////+P/7//r/AAD5//v/9//9//v//P/1//z/+//7//f//f/6//n/9//+//z/+v/4//z//f/8//n/+//9//3/+//9//3/+//9/wAA/f/6////AwD///r///8CAAAA/f///wEAAgACAP////8DAAEAAAACAAIAAAACAAMAAQABAAMAAgD//wIABAABAP//AwACAP//AQAFAAAA/v8CAAMA/////wAAAgD+//7//f8EAP7/+f/8/wUA/f/5//3/AQD9//z/+v/+//z//P/6//7/+v/7//3//f/4//r//P/9//n/+//9//z/+P/8//3/+v/5//3/+//6//3//f/7//3//f/6//3////+//r//f8AAAAA/P////3//v8BAAIA+//9/wIABgD9//7/AAAHAAAA/////wQAAQADAP//AgADAAMA/f8BAAQAAwD9/wIAAwABAP7/AgACAP///f8BAAMA///7//3/BAABAPr/+/8CAP7//P/6//3/+v8AAPz/+f/3/wAA+//5//f//P/6//z/9v/5//r/+//1//v/+f/4//T//P/2//b/9v/6//X/+P/2//n/9v/4//b/+P/2//f/9//6//b/9//4//r/+P/3//b/+P/5//n/+f/4//j/+f/6//v/+v/2//j//P/+//j/+P/6/wAA/P/5//j/AAD+//z/9//7/wAAAwD4//f///8EAPv//P/8/wAA/v8AAPz/AgAAAP3//P8EAAAA///9/wIA//8AAAAAAwD9////AQAEAP7///8AAAEA/v8AAAEA///8/wEAAgD9//z/AQD+//3//v8AAP7//f/8///////7//n//P8AAP3/+P/6/////P/4//r//v/7//j/+//8//r/+f/5//v/+//5//j/+//7//j/+P/7//n/+P/7//n/9//6//3/+P/2//n//f/5//b/+P/+//r/9v/4////+f/3//n//f/6//r/+f/6//n//f/6//v/+f/9//v/+//6/wEA+v/6//z/AgD5//3//f/+//r/AgD+//7/+f8BAP/////6/wMA//////z/BAD/////+/8DAAEAAQD8/wIAAAABAP7/AwD+/wEAAgAEAPv/AAAEAAMA/P8BAAIAAQAAAAIA//8BAAEAAAD//wQAAgD+//7/AwACAP///v/+/wMAAQD8//z/AwABAPv//f8CAAAA/v/+//3//v8BAP///P/+//7//v////7//f/+//7//P/+/wEA/P/9////AAD8//3///8BAPz//f/+/wMA/P/+////AgD8//////8EAPz////+/wIA//8CAPv//f8CAAYA+v/8/wEABwD9//7//f8FAAEA///7/wEAAQACAPz//v///wMA///8//z/AgABAP3/+/8AAP7//v///wAA+//+/wEA/v/8/////f/8////AQD6//v/AQD///v//f/+//z//f////z/+//+/////P/7//7/AAD7//3////9//v/AAD///r//P8BAP7//f/8////AAAAAPr///8DAAIA+v8AAAMAAQD8/wMAAQABAAAABAD//wEABAAEAP7/AwADAAUAAgAEAAAABAAEAAQAAgAGAAEABAAEAAcAAQAEAAQABgABAAYABAAFAAAAAwAFAAYAAAACAAMABQACAAMAAQACAAIAAgD//wQAAwD///7/AwADAP7//P8CAAMA/f/9/wIAAAD8////AgD9//7/AgD///v///8CAP7/+v8AAAMA///7/wAAAwD///r/AQAEAAAA+/8BAAMAAgD//wEA//8EAAMAAwD+/wUABAAEAAAABwAEAAQAAQAJAAQABQACAAcABgAGAAEACQAIAAcAAAAKAAkABwACAAkABwAJAAMACQAHAAgAAwAJAAcABgAEAAkABAAFAAYABwADAAUABAAHAAMAAwAEAAgAAgABAAMABgACAAMAAgADAAEABAABAAAAAgACAP//AAACAAAA/v///wEA///+//3/AAAAAP///P/+/wAA///8//7///////7/AAD8//7///8BAP7//v/8/wEAAQD///v/AQD//wAA//8CAP7/AQABAAIA/P8CAAQAAgD8/wIABQAEAP7/AwADAAQAAgADAAEABQAEAAMAAQAGAAQAAgADAAcAAwABAAMACAAEAAIAAQAEAAQABgABAAEAAgAFAAMABQAAAP//AwAHAP////8CAAQAAAACAAEAAAABAAIA/v8CAAIA/v/9/wUAAQD8//7/AwAAAAAA/f///wEAAwD+//3///8DAAEA///9/wMAAwAAAP//AwABAAAAAgAGAAAAAAAEAAYAAAACAAUABgACAAQABAAGAAQABQACAAcABwAFAAIABwAHAAgABQAFAAQACgAIAAUAAwAJAAgABwADAAcACAAHAAMACAAHAAYAAwAGAAUABwAEAAUAAwAFAAMABgAEAAMAAQAEAAYABAD//wEABAAFAAIA//8BAAQABAAAAP//AQADAAAA//8AAAQA/////wIAAwD9/wAAAAABAP//AQAAAAAA/f8BAAEAAwD9//7/AQAFAP3//f8BAAYA/////wAABAACAAEA/f8BAAUABAD+/wEABAAEAAEAAQAEAAQAAQACAAYAAwAAAAMACAACAAEABAAIAAEAAwADAAYAAQAFAAQABAABAAcABAAEAAAABgAEAAQAAQAGAAUABAAAAAYABQAEAP//BQAEAAQAAQAFAAEAAwADAAQAAAADAAQABAAAAAIABQAFAP//AAAGAAQAAQACAAIAAgAGAAIA//8DAAUAAQACAAIAAQABAAQAAgABAAAAAgAEAAMA//8BAAMAAgABAAMAAgD//wIABgABAP3/AwAFAAAA/v8FAAIAAAD//wQAAgACAP//AQABAAQA//8BAAAAAwD//wMAAAACAP//BAD+/wEAAAAEAP//AQD9/wUAAgAAAPv/BQACAP///v8FAP//AAABAAMA/f8BAAIAAwD9/wAAAwAEAP////8AAAUAAQD+////BQAEAP3///8GAAQA/f8AAAUAAgAAAAMAAQD//wIABAD/////AgADAAIAAQD//wAAAgAFAAEA/f8AAAUAAgD+/wEAAgAAAAAAAgABAAEAAAABAAAAAQD//wMAAQD///7/AwACAAAA//8CAAAAAgAAAAAA//8DAAEA///+/wQAAQD///3/BAAAAP3///8EAP3//v8CAAMA+////wMAAwA=", A));
    const e = this.reappearBufferLease;
    e.promise.then((t) => {
      this.destroyed || (this.reappearBuffer = t);
    }).catch(() => {
      this.reappearBufferLease === e && (e.release(), this.reappearBufferLease = null);
    });
  }
  armHoldSilence() {
    typeof window > "u" || (this.clearHoldTimer(), this.holdTimer = window.setTimeout(() => {
      this.holdTimer = null, this.gestureActive && (this.smoothedVelocity = 0, this.smoothedAcceleration = 0, this.stopVoices(/* @__PURE__ */ new Set(["texture", "reattach"]), 0.012));
    }, oe));
  }
  clearHoldTimer() {
    this.holdTimer === null || typeof window > "u" || (window.clearTimeout(this.holdTimer), this.holdTimer = null);
  }
  playLift(A, e) {
    const t = this.profile?.lift;
    t && this.playSlice(t, {
      kind: "lift",
      duration: 0.07 + A * 0.025,
      playbackRate: (0.94 + A * 0.12) * eA(0.5),
      gain: 0.11 + A * 0.065,
      lowpass: 4200 + A * 5400,
      highpass: 180,
      attack: 4e-3,
      release: 0.018,
      pan: e
    });
  }
  playTexture(A, e, t) {
    if (!this.profile || e <= 1e-3) return;
    const i = Math.random() < M(0.12 + 0.58 * A, 0, 0.72), r = this.takeSlice(i ? "body" : "micro");
    if (!r) return;
    const w = T(0.85, 1.15) * (0.066 - 0.032 * A);
    this.playSlice(r, {
      kind: "texture",
      duration: w,
      playbackRate: (0.92 + A * 0.18) * eA(0.7),
      gain: (0.07 + 0.2 * A ** 0.65) * e * xA(T(-1.5, 1.5)),
      lowpass: 2400 + A * 9e3,
      highpass: 210,
      attack: 6e-3 - A * 35e-4,
      release: 0.017 - A * 8e-3,
      pan: t
    });
  }
  playReattach(A, e) {
    const t = this.takeSlice("micro");
    t && this.playSlice(t, {
      kind: "reattach",
      duration: T(0.03, 0.05),
      playbackRate: (0.67 + A * 0.17) * eA(0.5),
      gain: (0.024 + 0.052 * A ** 0.7) * xA(T(-1.2, 1.2)),
      lowpass: 1500 + A * 2400,
      highpass: 120,
      attack: 5e-3,
      release: 0.02,
      pan: e * 0.6
    });
  }
  playAccent(A, e, t) {
    const i = this.takeSlice("accent");
    i && this.playSlice(i, {
      kind: "accent",
      duration: T(0.045, 0.072),
      playbackRate: (0.96 + A * 0.12) * (1 + e * 0.08) * eA(0.45),
      gain: (0.14 + A * 0.1) * (1 + e * 0.35),
      lowpass: 5200 + A * 6e3,
      highpass: 220,
      attack: 2e-3,
      release: 0.024,
      pan: t
    });
  }
  playFinish(A, e) {
    const t = this.profile?.finish;
    t && (this.stopVoices(/* @__PURE__ */ new Set(["texture", "reattach"]), 0.01), this.playSlice(t, {
      kind: "finish",
      duration: 0.064,
      playbackRate: (0.97 + A * 0.08) * eA(0.35),
      gain: 0.2 + A * 0.12,
      lowpass: 7500 + A * 4500,
      highpass: 180,
      attack: 15e-4,
      release: 0.038,
      pan: e
    }));
  }
  takeSlice(A) {
    const e = this.profile?.[A] ?? [];
    if (!e.length) return null;
    let t = this.sliceBags[A];
    t.length || (t = Qe(e.length), t.length > 1 && e[t[t.length - 1]]?.key === this.lastSliceKey && ([t[0], t[t.length - 1]] = [t[t.length - 1], t[0]]), this.sliceBags[A] = t);
    const i = e[t.pop() ?? 0] ?? null;
    return i && (this.lastSliceKey = i.key), i;
  }
  playSlice(A, e) {
    if (!this.enabled || this.destroyed || this.activeVoices.size >= IA) return;
    const t = tA(), i = this.buffer;
    if (!t || !i) return;
    const r = M(A.start, 0, Math.max(i.duration - 4e-3, 0)), w = M(A.end, r + 4e-3, i.duration) - r;
    if (w < 4e-3) return;
    const n = Math.min(e.duration * e.playbackRate, w), s = Math.max(w - n, 0), D = r + (s ? Math.random() * s : 0), P = n / e.playbackRate, a = t.currentTime + 2e-3, o = Math.min(e.attack, P * 0.36), v = Math.min(e.release, P * 0.48), l = Math.max(a + o, a + P - v), h = M(e.gain * A.trim, 0, 1.1), c = t.createBufferSource(), B = t.createBiquadFilter(), Q = t.createBiquadFilter(), f = t.createGain(), C = typeof t.createStereoPanner == "function" ? t.createStereoPanner() : null;
    c.buffer = i, c.playbackRate.setValueAtTime(e.playbackRate, a), B.type = "highpass", B.frequency.setValueAtTime(e.highpass, a), B.Q.setValueAtTime(0.7, a), Q.type = "lowpass", Q.frequency.setValueAtTime(M(e.lowpass, 600, t.sampleRate * 0.46), a), Q.Q.setValueAtTime(0.72, a), C && C.pan.setValueAtTime(e.pan, a), f.gain.setValueAtTime(0, a), f.gain.linearRampToValueAtTime(h, a + o), f.gain.setValueAtTime(h, l), f.gain.linearRampToValueAtTime(0, a + P), c.connect(B), B.connect(Q);
    const u = C ?? Q;
    C && Q.connect(C), u.connect(f), f.connect(this.ensureOutput(t));
    const d = [
      c,
      B,
      Q
    ];
    C && d.push(C), d.push(f);
    const z = {
      source: c,
      gain: f,
      nodes: d,
      kind: e.kind
    };
    this.activeVoices.add(z), c.addEventListener("ended", () => {
      this.activeVoices.delete(z);
      for (const L of d) L.disconnect();
    }, { once: !0 }), c.start(a, D, n);
  }
  stopVoices(A, e) {
    const t = iA;
    if (!t) return;
    const i = t.currentTime;
    for (const r of [...this.activeVoices])
      if (!(A && !A.has(r.kind))) {
        try {
          r.gain.gain.cancelScheduledValues(i), r.gain.gain.setTargetAtTime(0, i, Math.max(e / 3, 2e-3)), r.source.stop(i + e);
        } catch {
        }
        this.activeVoices.delete(r);
      }
  }
  ensureOutput(A) {
    return this.masterGain ? this.masterGain : (this.masterGain = A.createGain(), this.compressor = A.createDynamicsCompressor(), this.masterGain.gain.setValueAtTime(this.volume, A.currentTime), this.compressor.threshold.setValueAtTime(-14, A.currentTime), this.compressor.knee.setValueAtTime(8, A.currentTime), this.compressor.ratio.setValueAtTime(4, A.currentTime), this.compressor.attack.setValueAtTime(3e-3, A.currentTime), this.compressor.release.setValueAtTime(0.1, A.currentTime), this.masterGain.connect(this.compressor), this.compressor.connect(A.destination), this.masterGain);
  }
}, Ce = {
  sweepDuration: 950,
  cycleDuration: 1210,
  coreWidth: 0.04,
  bandWidth: 0.3,
  bandOpacity: 0.46,
  brightness: 1.18,
  highlightIntensity: 0.62,
  distortionRange: 0.41,
  distortionStrength: 3.15,
  rippleDensity: 18,
  rippleSpeed: 6
}, ue = { ...Ce };
function yA() {
  return ue;
}
var de = [
  "original",
  "holographic",
  "glitter",
  "reflective"
];
function UA(A) {
  const e = de.indexOf(A);
  return e < 0 ? 0 : e;
}
var rA = {
  source: void 0,
  outline: {
    width: 18,
    color: "#ffffff"
  },
  edge: {
    width: 2.4,
    strength: 0.7
  },
  shadow: {
    color: "#191823",
    opacity: 0.22,
    blur: 22,
    distance: 16,
    angle: 42
  },
  lighting: {
    direction: {
      x: -0.38,
      y: 0.52,
      z: 0.76
    },
    intensity: 0.8,
    ambient: 0.35,
    softness: 0.6
  },
  peel: {
    radius: 0.12,
    stiffness: 0.72,
    grabWidth: 22,
    maxAngle: 3.55,
    detachThreshold: 0.74,
    residue: !0,
    surfaceShadow: !0,
    release: "snap"
  },
  back: {
    color: "#f7f5f2",
    gloss: 0.7,
    roughness: 0.3
  },
  material: {
    type: "original",
    intensity: 0.86,
    scale: 1,
    holographicGrain: 0.72,
    seed: 0.37,
    holographicColors: [
      "#f2a7c5",
      "#8edfd5",
      "#9db4ea"
    ]
  },
  sound: {
    src: "",
    volume: 0.7,
    enabled: !0
  },
  display: {
    width: 0,
    height: 0
  },
  tilt: -3,
  wind: 0.25,
  quality: "high"
};
function j(A, e = {}) {
  const t = A ?? rA;
  return {
    source: e.source ?? t.source,
    outline: {
      ...t.outline,
      ...e.outline
    },
    edge: {
      ...t.edge,
      ...e.edge
    },
    shadow: {
      ...t.shadow,
      ...e.shadow
    },
    lighting: {
      ...t.lighting,
      ...e.lighting,
      direction: {
        ...t.lighting.direction,
        ...e.lighting?.direction
      }
    },
    peel: {
      ...t.peel,
      ...e.peel
    },
    back: {
      ...t.back,
      ...e.back
    },
    material: {
      ...t.material,
      ...e.material
    },
    sound: {
      ...t.sound,
      ...e.sound
    },
    display: {
      ...t.display,
      ...e.display
    },
    tilt: e.tilt ?? t.tilt,
    wind: e.wind ?? t.wind,
    quality: e.quality ?? t.quality
  };
}
var X = 2147483647, fA = 48271, N = 96, Ie = 6, jA = 5, Me = /* @__PURE__ */ new Map(), pe = /* @__PURE__ */ new Map();
function JA(A) {
  return Math.floor(A * X) || 1;
}
function WA(A, e, t) {
  const i = A.get(e);
  if (i !== void 0)
    return A.delete(e), A.set(e, i), i;
  const r = t();
  if (A.set(e, r), A.size > Ie) {
    const w = A.keys().next().value;
    w !== void 0 && A.delete(w);
  }
  return r;
}
function me(A) {
  const e = JA(A);
  return WA(Me, e, () => {
    let t = e;
    const i = new Uint8ClampedArray(N * N * 4);
    for (let r = 0; r < i.length; r += 4) {
      t = t * fA % X;
      const w = t / X > 0.48 ? 255 : 20;
      i[r] = w, i[r + 1] = w, i[r + 2] = w, t = t * fA % X, i[r + 3] = Math.round(38 + t / X * 74);
    }
    return { pixels: i };
  });
}
function ze(A) {
  const e = me(A);
  if (e.canvas) return e.canvas;
  const t = document.createElement("canvas");
  t.width = N, t.height = N;
  const i = t.getContext("2d", { alpha: !0 });
  if (!i) return null;
  const r = i.createImageData(N, N);
  return r.data.set(e.pixels), i.putImageData(r, 0, 0), e.canvas = t, t;
}
function xe(A, e) {
  const t = JA(A), i = WA(pe, t, () => ({
    state: t,
    values: new Float64Array(0)
  })), r = e * jA;
  if (i.values.length >= r) return i.values;
  const w = new Float64Array(r);
  w.set(i.values);
  let n = i.state;
  for (let s = i.values.length; s < r; s += 1)
    n = n * fA % X, w[s] = n / X;
  return i.state = n, i.values = w, w;
}
function hA(A, e) {
  return (A - 0.5) * e + 0.5;
}
function He(A) {
  const e = A - Math.floor(A);
  return e < 0.25 || e > 0.78 ? 0 : e < 0.46 ? 0.7 * (e - 0.25) / 0.21 : e < 0.58 ? 0.7 + -0.5599999999999999 * (e - 0.46) / 0.12 : 0.14 * (1 - (e - 0.58) / 0.2);
}
function Fe(A, e, t, i) {
  const r = Math.max(32, Math.ceil(48 * e));
  for (let w = 0; w <= r; w += 1) {
    const n = w / r, s = He(hA(n, e) + i);
    A.addColorStop(n, `rgba(255,255,255,${s * t})`);
  }
}
function Le(A, e, t, i) {
  const r = hA(0, e) + i, w = hA(1, e) + i, n = Math.floor(r * 3), s = Math.ceil(w * 3);
  A.addColorStop(0, t[(n % 3 + 3) % 3]);
  for (let D = n; D <= s; D += 1) {
    const P = (D / 3 - r) / e;
    P <= 0 || P >= 1 || A.addColorStop(P, t[(D % 3 + 3) % 3]);
  }
  A.addColorStop(1, t[(s % 3 + 3) % 3]);
}
function ye(A, e, t, i, r, w, n) {
  const s = ze(n);
  if (!s) return;
  const D = A.createPattern(s, "repeat");
  D && (D.setTransform(new DOMMatrix().scaleSelf(1 / Math.sqrt(w), 1 / Math.sqrt(w))), A.save(), A.globalAlpha = 0.42 * i * r, A.fillStyle = D, A.fillRect(0, 0, e, t), A.restore());
}
function Ue(A, e, t, i, r) {
  const w = {
    ...rA.material,
    ...i
  };
  if (w.type === "original" || w.intensity <= 0) return;
  const n = Math.min(1, Math.max(0, w.intensity)), s = Math.min(4, Math.max(0.2, w.scale)), D = {
    ...rA.lighting,
    ...r,
    direction: {
      ...rA.lighting.direction,
      ...r?.direction
    }
  }, P = Math.hypot(D.direction.x, D.direction.y, D.direction.z) || 1, a = D.direction.x / P, o = D.direction.y / P, v = rA.lighting.direction, l = Math.hypot(v.x, v.y, v.z), h = v.x / l, c = v.y / l, B = Math.min(1.5, Math.max(0, D.intensity));
  if (A.save(), A.globalCompositeOperation = "source-atop", w.type === "reflective") {
    const Q = A.createLinearGradient(0, t, e, 0), f = (a - h) * 0.28 + (o - c) * -0.22;
    Fe(Q, s, n * Math.min(1.4, Math.max(0.5, 1 + (B - 0.8) * 0.5)), f), A.fillStyle = Q, A.fillRect(0, 0, e, t);
  } else if (w.type === "holographic") {
    const Q = A.createLinearGradient(0, t, e, 0), f = (a - h) * 0.32 + (o - c) * -0.26;
    Le(Q, s, w.holographicColors, f), A.fillStyle = Q, A.globalAlpha = 0.24 * n * Math.min(1.3, Math.max(0.6, 1 + (B - 0.8) * 0.35)), A.fillRect(0, 0, e, t), ye(A, e, t, n, Math.min(1, Math.max(0, w.holographicGrain)), s, w.seed);
  }
  if (w.type === "glitter") {
    const Q = Math.atan2(o, a), f = Math.min(1.4, Math.max(0.45, 0.5 + B * 0.625)), C = Math.min(8e3, Math.round(e * t / 520 * s * s)), u = xe(w.seed, C);
    for (let d = 0; d < C; d += 1) {
      const z = d * jA, L = u[z] * e, Y = u[z + 1] * t, Z = u[z + 2] > 0.5, K = u[z + 3], y = (L * 0.013 + Y * 0.017 + w.seed * 7) % 1 * Math.PI * 2, wA = 0.18 + Math.pow(Math.max(0, Math.cos(y - Q)), 10) * 0.82;
      A.globalAlpha = 0.38 * n * K * wA * f, A.fillStyle = Z ? "#ffffff" : "#34281f";
      const I = (0.7 + u[z + 4] * 1.8) / Math.sqrt(s);
      A.fillRect(L, Y, I, I);
    }
  }
  A.restore();
}
function be(A, e, t, i, r) {
  const w = document.createElement("canvas");
  w.width = e, w.height = t;
  const n = w.getContext("2d", { alpha: !0 });
  if (!n) throw new Error("Canvas 2D is unavailable.");
  return n.clearRect(0, 0, e, t), n.imageSmoothingEnabled = !0, n.imageSmoothingQuality = "high", n.drawImage(A, 0, 0, e, t), Ue(n, e, t, i, r), w;
}
var q = 2048, k = 320, lA = 0.1 * 255;
function m(A, e, t) {
  return Math.min(t, Math.max(e, A));
}
function Te(A, e, t) {
  const i = new Uint8Array(e * t), r = new Int32Array(e * t);
  let w = 0, n = 0;
  const s = (D, P) => {
    if (D < 0 || D >= e || P < 0 || P >= t) return;
    const a = P * e + D;
    i[a] || A[a] >= lA || (i[a] = 1, r[n] = a, n += 1);
  };
  for (let D = 0; D < e; D += 1)
    s(D, 0), s(D, t - 1);
  for (let D = 1; D < t - 1; D += 1)
    s(0, D), s(e - 1, D);
  for (; w < n; ) {
    const D = r[w];
    w += 1;
    const P = D % e, a = Math.floor(D / e);
    s(P - 1, a), s(P + 1, a), s(P, a - 1), s(P, a + 1);
  }
  return i;
}
function bA(A) {
  if (!A) return null;
  const e = Number.parseFloat(A);
  return Number.isFinite(e) && e > 0 ? e : null;
}
function ke(A) {
  if (A.length > 2e6) throw new Error("SVG markup must be smaller than 2 MB.");
  const e = new DOMParser().parseFromString(A, "image/svg+xml");
  if (e.querySelector("parsererror")) throw new Error("The SVG could not be parsed.");
  const t = e.documentElement;
  if (t.localName.toLowerCase() !== "svg") throw new Error("The uploaded file is not an SVG document.");
  t.querySelectorAll("script, foreignObject, iframe, object, embed, audio, video, canvas, style, animate, animateMotion, animateTransform, set").forEach((i) => i.remove());
  for (const i of [t, ...Array.from(t.querySelectorAll("*"))]) for (const r of Array.from(i.attributes)) {
    const w = r.name.toLowerCase(), n = r.value.trim();
    if (w.startsWith("on")) {
      i.removeAttribute(r.name);
      continue;
    }
    if (w === "href" || w === "xlink:href") {
      n.startsWith("#") || i.removeAttribute(r.name);
      continue;
    }
    /url\s*\(/i.test(n) && !/url\s*\(\s*["']?#/i.test(n) && i.removeAttribute(r.name), (/^javascript:/i.test(n) || /^data:text\/html/i.test(n)) && i.removeAttribute(r.name);
  }
  return t.setAttribute("xmlns", "http://www.w3.org/2000/svg"), new XMLSerializer().serializeToString(t);
}
function Se(A) {
  const e = new DOMParser().parseFromString(A, "image/svg+xml").documentElement, t = e.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (t?.length === 4 && Number.isFinite(t[2]) && Number.isFinite(t[3]) && t[2] > 0 && t[3] > 0) return m(t[2] / t[3], 0.15, 8);
  const i = bA(e.getAttribute("width")), r = bA(e.getAttribute("height"));
  return i && r ? m(i / r, 0.15, 8) : 1;
}
async function Ve(A) {
  const e = new Blob([A], { type: "image/svg+xml;charset=utf-8" }), t = URL.createObjectURL(e);
  try {
    const i = new Image();
    return i.decoding = "async", i.src = t, await i.decode(), i;
  } finally {
    URL.revokeObjectURL(t);
  }
}
async function NA(A) {
  if (!/^(data:|blob:|https?:|\/)/i.test(A)) throw new Error("The image URL must use data, blob, HTTP, or HTTPS.");
  const e = new Image();
  if (e.decoding = "async", /^https?:/i.test(A) && (e.crossOrigin = "anonymous"), e.src = A, await e.decode(), !e.naturalWidth || !e.naturalHeight) throw new Error("The image has no drawable dimensions.");
  return e;
}
function qA(A) {
  const e = Math.min(1, 640 / Math.max(A.naturalWidth, A.naturalHeight)), t = Math.max(1, Math.round(A.naturalWidth * e)), i = Math.max(1, Math.round(A.naturalHeight * e)), r = document.createElement("canvas");
  r.width = t, r.height = i;
  const w = r.getContext("2d", { willReadFrequently: !0 });
  if (!w) throw new Error("Canvas 2D is unavailable.");
  w.clearRect(0, 0, t, i), w.drawImage(A, 0, 0, t, i);
  const n = w.getImageData(0, 0, t, i).data;
  for (let s = 3; s < n.length; s += 4) if (n[s] < 255) return !0;
  return !1;
}
async function Bt(A) {
  return qA(await NA(A));
}
async function Ge(A) {
  const e = A.fontFamily ?? "Arial Rounded MT Bold, Arial Black, sans-serif", t = A.fontWeight ?? 900, i = A.richText?.blocks.filter((Q) => Q.runs.length);
  if (i?.length) {
    const Q = document.createElement("canvas").getContext("2d");
    if (!Q) throw new Error("Canvas 2D is unavailable.");
    const f = 144, C = (I) => {
      const U = i.map((x) => {
        let V = 0, p = 0, G = 0, nA = 0;
        const CA = x.runs.map((_) => {
          const $ = m((_.fontSize ?? 28) * I, 24, 720);
          nA = Math.max(nA, $);
          const uA = _.fontWeight ?? t;
          Q.font = `${uA} ${$}px ${e}`;
          const PA = Q.measureText(_.text || " "), _A = PA.actualBoundingBoxAscent || Math.max($ * 0.76, 1), $A = PA.actualBoundingBoxDescent || Math.max($ * 0.2, 1), dA = _.text ? PA.width : 0;
          return V += dA, p = Math.max(p, _A), G = Math.max(G, $A), {
            ..._,
            fontSize: $,
            fontWeight: uA,
            width: dA
          };
        }), DA = nA || 28 * I;
        return (!CA.length || p + G < 1) && (p = DA * 0.76, G = DA * 0.24), {
          align: x.align ?? "center",
          runs: CA,
          width: V,
          ascent: p,
          descent: G,
          height: Math.max(p + G, DA) * m(x.lineHeight ?? 1.2, 0.7, 3)
        };
      });
      return {
        lines: U,
        contentWidth: Math.max(1, ...U.map((x) => x.width)),
        contentHeight: U.reduce((x, V) => x + V.height, 0)
      };
    };
    let u = 8, d = C(u);
    const z = 1750 / Math.max(d.contentWidth, 1), L = 1790 / Math.max(d.contentHeight, 1);
    if ((z < 1 || L < 1) && (u *= Math.min(z, L), d = C(u)), document.fonts?.load) {
      const I = /* @__PURE__ */ new Set();
      for (const U of d.lines) for (const x of U.runs) I.add(`${x.fontWeight} ${x.fontSize}px ${e}`);
      await Promise.all([...I].map((U) => document.fonts.load(U).catch(() => []))), d = C(u);
    }
    const Y = m(Math.ceil(d.contentWidth + f * 2), k, q), Z = m(Math.ceil(d.contentHeight + f * 2), k, q), K = document.createElement("canvas");
    K.width = Y, K.height = Z;
    const y = K.getContext("2d", { willReadFrequently: !0 });
    if (!y) throw new Error("Canvas 2D is unavailable.");
    y.clearRect(0, 0, Y, Z), y.textBaseline = "alphabetic";
    let wA = (Z - d.contentHeight) / 2;
    for (const I of d.lines) {
      const U = I.align === "left" ? f : I.align === "right" ? Y - f - I.width : (Y - I.width) / 2, x = wA + (I.height - I.ascent - I.descent) / 2 + I.ascent;
      let V = U;
      for (const p of I.runs) {
        if (y.font = `${p.fontWeight} ${p.fontSize}px ${e}`, y.fillStyle = p.color ?? A.color ?? "#19191d", y.fillText(p.text, V, x), p.underline && p.width > 0) {
          const G = Math.max(2, p.fontSize * 0.045);
          y.fillRect(V, x + Math.max(2, p.fontSize * 0.07), p.width, G);
        }
        V += p.width;
      }
      wA += I.height;
    }
    return K;
  }
  const r = t;
  let w = 420;
  const n = document.createElement("canvas").getContext("2d");
  if (!n) throw new Error("Canvas 2D is unavailable.");
  if (document.fonts?.load) try {
    await document.fonts.load(`${r} ${w}px ${e}`);
  } catch {
  }
  const s = A.text || " ";
  n.font = `${r} ${w}px ${e}`;
  let D = n.measureText(s);
  const P = Math.max(1, D.width);
  P > 1750 && (w *= 1750 / P, n.font = `${r} ${w}px ${e}`, D = n.measureText(s));
  const a = D.actualBoundingBoxAscent || Math.max(w * 0.76, 1), o = D.actualBoundingBoxDescent || Math.max(w * 0.2, 1), v = 144, l = m(Math.ceil(D.width + v * 2), k, q), h = m(Math.ceil(a + o + v * 2), k, 1280), c = document.createElement("canvas");
  c.width = l, c.height = h;
  const B = c.getContext("2d", { willReadFrequently: !0 });
  if (!B) throw new Error("Canvas 2D is unavailable.");
  return B.clearRect(0, 0, l, h), B.font = `${r} ${w}px ${e}`, B.textBaseline = "alphabetic", B.textAlign = "center", B.fillStyle = A.color ?? "#19191d", B.fillText(s, l / 2, (h + a - o) / 2), c;
}
async function Ye(A) {
  const e = ke(A.svg), t = Se(e), i = 1740, r = 144, w = t >= 1 ? i : i * t, n = t >= 1 ? i / t : i, s = m(Math.ceil(w + r * 2), k, q), D = m(Math.ceil(n + r * 2), k, q), P = document.createElement("canvas");
  P.width = s, P.height = D;
  const a = P.getContext("2d", { willReadFrequently: !0 });
  if (!a) throw new Error("Canvas 2D is unavailable.");
  const o = await Ve(e);
  return a.drawImage(o, r, r, s - r * 2, D - r * 2), P;
}
async function Re(A) {
  const e = await NA(A.src), t = qA(e), i = m(e.naturalWidth / e.naturalHeight, 0.15, 8), r = m(A.padding ?? 144, 0, 512), w = m(A.textureMaxEdge ?? q, k, 8192), n = Math.max(1, w - r * 2), s = i >= 1 ? n : n * i, D = i >= 1 ? n / i : n, P = m(Math.ceil(s + r * 2), k, w), a = m(Math.ceil(D + r * 2), k, w), o = document.createElement("canvas");
  o.width = P, o.height = a;
  const v = o.getContext("2d", { willReadFrequently: !0 });
  if (!v) throw new Error("Canvas 2D is unavailable.");
  return v.clearRect(0, 0, P, a), v.drawImage(e, r, r, P - r * 2, a - r * 2), {
    canvas: o,
    hasTransparency: t
  };
}
function Oe(A, e) {
  const t = document.createElement("canvas");
  t.width = A.width, t.height = A.height;
  const i = t.getContext("2d");
  if (!i) throw new Error("Canvas 2D is unavailable.");
  return i.fillStyle = e, i.fillRect(0, 0, t.width, t.height), i.globalCompositeOperation = "destination-in", i.drawImage(A, 0, 0), t;
}
var Xe = 1e12;
function TA(A, e, t, i, r, w, n, s, D) {
  let P = 0;
  s[0] = 0, D[0] = Number.NEGATIVE_INFINITY, D[1] = Number.POSITIVE_INFINITY;
  for (let a = 1; a < n; a += 1) {
    let o = s[P], v = (A[e + a * t] + a * a - (A[e + o * t] + o * o)) / (2 * a - 2 * o);
    for (; v <= D[P]; )
      P -= 1, o = s[P], v = (A[e + a * t] + a * a - (A[e + o * t] + o * o)) / (2 * a - 2 * o);
    P += 1, s[P] = a, D[P] = v, D[P + 1] = Number.POSITIVE_INFINITY;
  }
  P = 0;
  for (let a = 0; a < n; a += 1) {
    for (; D[P + 1] < a; ) P += 1;
    const o = s[P], v = a - o;
    i[r + a * w] = v * v + A[e + o * t];
  }
}
function Ke(A, e) {
  const t = A.width, i = A.height, r = A.getContext("2d", { willReadFrequently: !0 });
  if (!r) throw new Error("Canvas 2D is unavailable.");
  const w = r.getImageData(0, 0, t, i).data, n = t * i, s = new Float32Array(n), D = new Float32Array(n);
  let P = !1;
  for (let B = 0; B < n; B += 1) {
    const Q = w[B * 4 + 3] >= lA;
    s[B] = Q ? 0 : Xe, P || (P = Q);
  }
  const a = Math.max(t, i), o = new Int32Array(a), v = new Float64Array(a + 1);
  if (P) {
    for (let B = 0; B < i; B += 1) TA(s, B * t, 1, D, B * t, 1, t, o, v);
    for (let B = 0; B < t; B += 1) TA(D, B, t, s, B, t, i, o, v);
  }
  const l = document.createElement("canvas");
  l.width = t, l.height = i;
  const h = l.getContext("2d");
  if (!h) throw new Error("Canvas 2D is unavailable.");
  const c = h.createImageData(t, i);
  for (let B = 0; B < n; B += 1) {
    const Q = P ? m(e + 0.5 - Math.sqrt(s[B]), 0, 1) : 0, f = B * 4;
    c.data[f] = 255, c.data[f + 1] = 255, c.data[f + 2] = 255, c.data[f + 3] = Math.round(Q * 255);
  }
  return h.putImageData(c, 0, 0), l;
}
function je(A, e) {
  const t = document.createElement("canvas");
  t.width = A.width, t.height = A.height;
  const i = t.getContext("2d", { willReadFrequently: !0 });
  if (!i) throw new Error("Canvas 2D is unavailable.");
  const r = m(e.width * 2.35, 0, 112);
  if (r > 0.25) {
    const w = Ke(A, r);
    i.drawImage(Oe(w, e.color), 0, 0);
  }
  return i.drawImage(A, 0, 0), t;
}
async function kA(A, e) {
  const t = A.type === "image" ? await Re(A) : {
    canvas: A.type === "text" ? await Ge(A) : await Ye(A),
    hasTransparency: !0
  }, i = t.canvas, r = je(i, e), w = r.getContext("2d", { willReadFrequently: !0 });
  if (!w) throw new Error("Canvas 2D is unavailable.");
  const n = w.getImageData(0, 0, r.width, r.height), s = new Uint8ClampedArray(r.width * r.height);
  for (let P = 3, a = 0; P < n.data.length; P += 4)
    s[a] = n.data[P], a += 1;
  const D = [];
  for (let P = 0; P < r.height; P += 1) {
    const a = P * r.width;
    let o = -1, v = -1;
    for (let h = 0; h < r.width; h += 1)
      s[a + h] < lA || (o < 0 && (o = h), v = h);
    if (o < 0) continue;
    const l = P / Math.max(r.height - 1, 1);
    D.push(o / Math.max(r.width - 1, 1), l), v !== o && D.push(v / Math.max(r.width - 1, 1), l);
  }
  return {
    canvas: r,
    width: r.width,
    height: r.height,
    aspect: r.width / r.height,
    alpha: s,
    exteriorAlpha: Te(s, r.width, r.height),
    support: new Float32Array(D),
    hasTransparency: t.hasTransparency
  };
}
var S = {
  type: "text",
  text: `PEEL ME
@cats_juice`,
  color: "#19191d",
  fontFamily: "Arial Rounded MT Bold, Arial Black, sans-serif",
  fontWeight: 900,
  richText: { blocks: [{
    align: "center",
    lineHeight: 1.2,
    runs: [{
      text: "PEEL ",
      color: "#19191d",
      fontSize: 28,
      fontWeight: 900
    }, {
      text: "ME",
      color: "rgb(36, 126, 245)",
      fontSize: 28,
      fontWeight: 900
    }]
  }, {
    align: "center",
    lineHeight: 0.8,
    runs: [{
      text: "@cats_juice",
      color: "#19191d",
      fontSize: 10,
      fontWeight: 500
    }]
  }] }
}, SA = 2.55, Je = Math.PI, We = 1.28, VA = 4e-3, GA = -0.22, Ne = 0.035, gA = 0.74, qe = 760, Ze = 520, gt = 720, YA = 720 / 1e3, RA = 0.06, _e = 0.42, $e = 0.32, At = 0.9, et = "rgb(36, 126, 245)";
function ZA(A) {
  const e = A.payload, t = A.consume;
  return A.payload = null, A.consume = null, {
    payload: e,
    consume: t
  };
}
function vA(A, e) {
  const { payload: t, consume: i } = ZA(A);
  t && i && i(e, t);
}
function tt(A) {
  return {
    commit() {
      vA(A, "commit");
    },
    commitWithEntrance() {
      vA(A, "entrance");
    },
    dispose() {
      vA(A, "dispose");
    }
  };
}
function E(A, e, t) {
  return Math.min(t, Math.max(e, A));
}
function QA(A, e, t) {
  const i = E((t - A) / (e - A), 0, 1);
  return i * i * (3 - 2 * i);
}
function F(A, e) {
  try {
    return new g.Color(A);
  } catch {
    return new g.Color(e);
  }
}
function OA(A, e) {
  return {
    ...A,
    ...e,
    outline: {
      ...A.outline,
      ...e.outline
    },
    edge: {
      ...A.edge,
      ...e.edge
    },
    shadow: {
      ...A.shadow,
      ...e.shadow
    },
    lighting: {
      ...A.lighting,
      ...e.lighting,
      direction: e.lighting?.direction ?? A.lighting?.direction
    },
    peel: {
      ...A.peel,
      ...e.peel
    },
    back: {
      ...A.back,
      ...e.back
    },
    material: {
      ...A.material,
      ...e.material
    },
    sound: {
      ...A.sound,
      ...e.sound
    },
    display: {
      ...A.display,
      ...e.display
    }
  };
}
var it = class {
  constructor(A, e = {}) {
    this.camera = new g.OrthographicCamera(-1, 1, 1, -1, 0.01, 10), this.scene = new g.Scene(), this.peelAudio = new le(), this.groundShadowGeometry = new g.PlaneGeometry(1, 1), this.peelShadowLight = new g.DirectionalLight(16777215, 1), this.peelShadowTarget = new g.Object3D(), this.geometry = new g.PlaneGeometry(1, 1, 2, 2), this.texture = null, this.artwork = null, this.source = S, this.requestedSource = S, this.sourceRevision = 0, this.sourceRebuildTimer = null, this.preparedSourceStates = /* @__PURE__ */ new Set(), this.destroyed = !1, this.resizeObserver = null, this.resizeFrameRequest = 0, this.renderedWidth = 0, this.renderedHeight = 0, this.renderedPixelRatio = 0, this.measuredClientWidth = -1, this.measuredClientHeight = -1, this.geometryWidth = 1, this.geometryHeight = 1, this.geometrySegmentsX = 2, this.geometrySegmentsY = 2, this.viewWidth = 2, this.viewHeight = 2, this.viewportHeightPx = 420, this.renderScale = 1, this.meshWidth = 1.6, this.meshHeight = 0.62, this.pointerId = null, this.grabOrigin = new g.Vector2(-0.8, 0), this.grabStart = new g.Vector2(), this.grabDirection = new g.Vector2(1, 0), this.activeDirection = new g.Vector2(1, 0), this.grabExtent = 1.6, this.creaseDepth = 0, this.basePeelRadius = 0.08, this.effectivePeelRadius = 0.08, this.grabProjection = 0, this.springVelocity = 0, this.springActive = !1, this.springTargetDepth = 0, this.dragDetached = !1, this.detachedTension = 0, this.detachedExitActive = !1, this.detachedExitElapsed = 0, this.detachedExitSpin = 0, this.entranceActive = !1, this.entranceElapsed = 0, this.preparedEntrance = null, this.backgroundRemovalEffectActive = !1, this.backgroundRemovalEffectElapsed = 0, this.interactionHintActive = !1, this.interactionHintElapsed = 0, this.entranceAxis = new g.Vector2(1, 0), this.reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)"), this.hoverFrameRequest = 0, this.hoverClientX = 0, this.hoverClientY = 0, this.frameRequest = 0, this.lastFrameTime = 0, this.state = {
      ready: !1,
      dragging: !1,
      progress: 0,
      grabPoint: null,
      pointer: null
    }, this.resize = () => {
      this.resizeInternal(!0);
    }, this.resizeObserved = () => {
      this.resizeInternal(!1);
    }, this.scheduleResize = () => {
      this.destroyed || this.resizeFrameRequest || (this.resizeFrameRequest = requestAnimationFrame(() => {
        this.resizeFrameRequest = 0, this.resizeObserved();
      }));
    }, this.onPointerDown = (i) => {
      if (this.destroyed || !this.state.ready || this.detachedExitActive || this.entranceActive || i.button !== 0) return;
      this.hoverFrameRequest && (cancelAnimationFrame(this.hoverFrameRequest), this.hoverFrameRequest = 0);
      const r = this.screenToLocal(i.clientX, i.clientY), w = this.hitEdge(r);
      if (!w) {
        this.startInteractionHint();
        return;
      }
      this.interactionHintActive = !1, this.interactionHintElapsed = 0, this.uniforms.uInteractionHint.value = 0, i.preventDefault(), this.renderer.domElement.focus({ preventScroll: !0 }), this.renderer.domElement.setPointerCapture(i.pointerId), this.pointerId = i.pointerId, this.grabOrigin.copy(w.local), this.grabStart.copy(w.local), this.grabDirection.copy(w.inward), this.activeDirection.copy(w.inward), this.grabExtent = this.projectionExtent(this.grabOrigin, this.grabDirection), this.setCreaseDepth(0), this.springActive = !1, this.springVelocity = 0, this.springTargetDepth = 0, this.dragDetached = !1, this.state.dragging = !0, this.state.grabPoint = {
        x: w.local.x,
        y: w.local.y
      }, this.state.pointer = {
        x: r.x,
        y: r.y
      }, this.renderer.domElement.style.cursor = "grabbing", this.peelAudio.unlock(), this.peelAudio.begin(this.state.progress, i.timeStamp), this.updatePeelUniforms(), this.emit("peelstart", {
        amount: this.state.progress,
        progress: this.state.progress,
        origin: this.state.grabPoint
      }), this.requestRender();
    }, this.onPointerMove = (i) => {
      if (this.destroyed || !this.state.ready) return;
      if (this.state.dragging && i.pointerId === this.pointerId && i.buttons === 0) {
        this.finishPointerDrag(i.timeStamp);
        return;
      }
      if (!this.state.dragging || i.pointerId !== this.pointerId) {
        this.hoverClientX = i.clientX, this.hoverClientY = i.clientY, this.hoverFrameRequest || (this.hoverFrameRequest = requestAnimationFrame(this.updateHoverCursor));
        return;
      }
      i.preventDefault();
      const r = this.screenToLocal(i.clientX, i.clientY), w = r.clone().sub(this.grabStart), n = w.length();
      let s = 0, D = !1;
      if (this.dragDetached) {
        const P = n > VA ? w.clone().normalize() : this.grabDirection;
        P.dot(this.grabDirection) >= GA && (this.activeDirection.copy(P), this.grabExtent = this.projectionExtent(this.grabOrigin, this.activeDirection), n < this.peelModelForDepth(this.grabExtent).projection && (this.dragDetached = !1));
      }
      if (this.dragDetached) {
        const P = this.peelModelForDepth(this.grabExtent).projection;
        this.springActive = !1, this.springVelocity = 0, this.springTargetDepth = this.grabExtent, this.setCreaseDepth(this.grabExtent), this.setDetachedDragOffset(w.x - this.activeDirection.x * P, w.y - this.activeDirection.y * P);
      } else {
        if (n > VA) {
          const P = w.clone().normalize();
          P.dot(this.grabDirection) >= GA ? (this.activeDirection.copy(P), s = n) : D = !0;
        } else this.activeDirection.copy(this.grabDirection);
        if (this.grabExtent = this.projectionExtent(this.grabOrigin, this.activeDirection), D)
          this.springActive || (this.springActive = !0, this.springVelocity = 0), this.springTargetDepth = 0;
        else {
          const P = this.peelModelForDepth(this.grabExtent).projection, a = this.solveCreaseDepth(s);
          this.creaseDepth - a > this.grabExtent * Ne || this.springActive && a < this.creaseDepth ? (this.springActive || (this.springActive = !0, this.springVelocity = 0), this.springTargetDepth = a) : (this.springActive = !1, this.springVelocity = 0, this.springTargetDepth = a, this.setCreaseDepth(a));
          const o = Math.max(0, s - P);
          this.setDetachedDragOffset(this.activeDirection.x * o, this.activeDirection.y * o), this.state.progress >= 1 - Number.EPSILON && (this.dragDetached = !0);
        }
      }
      this.peelAudio.update(this.state.progress, i.timeStamp, this.activeDirection.x), this.state.pointer = {
        x: r.x,
        y: r.y
      }, this.updatePeelUniforms(), this.emit("peelchange", {
        amount: this.state.progress,
        progress: this.state.progress,
        direction: {
          x: this.activeDirection.x,
          y: this.activeDirection.y
        }
      }), this.requestRender();
    }, this.onPointerUp = (i) => {
      !this.state.dragging || i.pointerId !== this.pointerId || this.finishPointerDrag(i.timeStamp);
    }, this.onWindowPointerEnd = (i) => {
      !this.state.dragging || i.pointerId !== this.pointerId || this.finishPointerDrag(i.timeStamp);
    }, this.onLostPointerCapture = (i) => {
      !this.state.dragging || i.pointerId !== this.pointerId || this.finishPointerDrag(i.timeStamp);
    }, this.onWindowBlur = () => {
      this.finishPointerDrag(performance.now());
    }, this.onVisibilityChange = () => {
      document.visibilityState === "hidden" && this.finishPointerDrag(performance.now());
    }, this.onPointerLeave = () => {
      this.state.dragging || (this.hoverFrameRequest && (cancelAnimationFrame(this.hoverFrameRequest), this.hoverFrameRequest = 0), this.renderer.domElement.style.cursor !== "default" && (this.renderer.domElement.style.cursor = "default"));
    }, this.updateHoverCursor = () => {
      if (this.hoverFrameRequest = 0, this.destroyed || this.state.dragging) return;
      const i = this.hitEdge(this.screenToLocal(this.hoverClientX, this.hoverClientY)) ? "grab" : "default";
      this.renderer.domElement.style.cursor !== i && (this.renderer.domElement.style.cursor = i);
    }, this.onKeyDown = (i) => {
      if (!this.state.ready) return;
      const r = i.key === "ArrowUp" || i.key === "ArrowRight", w = i.key === "ArrowDown" || i.key === "ArrowLeft";
      if (!r && !w && i.key !== " ") return;
      if (i.preventDefault(), this.peelAudio.unlock(), i.key === " ") {
        this.reset();
        return;
      }
      this.grabOrigin.set(-this.meshWidth / 2, 0), this.activeDirection.set(1, 0), this.grabDirection.copy(this.activeDirection), this.grabExtent = this.meshWidth;
      const n = this.state.progress, s = E(n + (r ? 0.08 : -0.08), 0, 1);
      this.setCreaseDepth(s * this.grabExtent), this.peelAudio.begin(n, i.timeStamp - 72), this.peelAudio.update(this.state.progress, i.timeStamp, this.activeDirection.x), this.peelAudio.end(this.state.progress), this.state.pointer = {
        x: this.grabOrigin.x + this.activeDirection.x * this.grabProjection,
        y: this.grabOrigin.y + this.activeDirection.y * this.grabProjection
      }, this.updatePeelUniforms(), this.emit("peelchange", {
        amount: this.state.progress,
        progress: this.state.progress
      }), this.requestRender();
    }, this.onContextLost = (i) => {
      i.preventDefault(), this.emit("error", { message: "The WebGL context was lost. Reload the page to restore the sticker." });
    }, this.renderFrame = (i) => {
      if (this.frameRequest = 0, this.destroyed) return;
      const r = this.lastFrameTime ? Math.min((i - this.lastFrameTime) / 1e3, 1 / 20) : 1 / 60;
      this.lastFrameTime = i;
      const w = this.reducedMotionQuery.matches;
      if (this.springActive && w) if (this.state.dragging)
        this.setCreaseDepth(this.springTargetDepth), this.springVelocity = 0, this.springActive = !1, this.updatePeelUniforms(), this.emit("peelchange", {
          amount: this.state.progress,
          progress: this.state.progress
        });
      else {
        this.reset();
        return;
      }
      if (this.springActive) {
        const s = 132 + E(this.options.peel.stiffness, 0, 1) * 146, D = Math.sqrt(s) * 1.83;
        let P = r, a = this.creaseDepth;
        for (; P > 0; ) {
          const o = Math.min(P, 0.008333333333333333), v = -s * (a - this.springTargetDepth) - D * this.springVelocity;
          this.springVelocity += v * o, a += this.springVelocity * o, P -= o;
        }
        Math.abs(a - this.springTargetDepth) <= this.grabExtent * 8e-4 && Math.abs(this.springVelocity) < this.grabExtent * 0.018 ? (this.setCreaseDepth(this.springTargetDepth), this.springVelocity = 0, this.springActive = !1, !this.state.dragging && this.springTargetDepth === 0 && (this.state.pointer = null, this.state.grabPoint = null)) : (this.setCreaseDepth(Math.max(0, a)), this.state.dragging || (this.state.pointer = {
          x: this.grabOrigin.x + this.activeDirection.x * this.grabProjection,
          y: this.grabOrigin.y + this.activeDirection.y * this.grabProjection
        })), this.updatePeelUniforms(), this.emit("peelchange", {
          amount: this.state.progress,
          progress: this.state.progress
        });
      }
      if (this.detachedExitActive) {
        this.detachedExitElapsed += r;
        const s = Math.max(this.viewWidth, this.viewHeight) * (1.45 + this.detachedExitElapsed * 3.2);
        if (this.stickerMesh.position.x += this.activeDirection.x * s * r, this.stickerMesh.position.y += this.activeDirection.y * s * r, this.stickerMesh.rotation.z += this.detachedExitSpin * r, this.detachedExitElapsed >= 0.46) {
          if (this.emit("detachcomplete", { progress: 1 }), this.destroyed) return;
          this.startEntranceAnimation();
          return;
        }
      }
      if (this.preparedEntrance) {
        this.preparedEntrance.elapsed += r;
        const s = E(this.preparedEntrance.elapsed / $e, 0, 1), D = QA(0, 1, s);
        if (this.uniforms.uPreparedMix.value = D, this.uniforms.uPreEntranceProgress.value = D, s >= 1) {
          const P = this.preparedEntrance;
          this.preparedEntrance = null, this.sourceRevision += 1, this.requestedSource = P.source, this.source = P.source, this.options = j(this.options, {
            ...P.options,
            source: P.source
          }), this.applyArtwork(P.artwork, P.texture), this.startEntranceAnimation();
          return;
        }
      }
      if (this.entranceActive && (this.entranceElapsed += r, this.applyEntranceElapsed(this.entranceElapsed) && (this.entranceActive = !1, this.clearEntrancePose(), this.emit("cyclecomplete", { progress: 0 }))), this.interactionHintActive) {
        this.interactionHintElapsed += r;
        const s = E(this.interactionHintElapsed / At, 0, 1);
        if (w) this.uniforms.uInteractionHint.value = s < 0.72 ? 1 : 0;
        else {
          const D = QA(0, 0.12, s), P = 1 - QA(0.58, 1, s), a = 0.9 + Math.sin(s * Math.PI * 2) * 0.1;
          this.uniforms.uInteractionHint.value = D * P * a;
        }
        s >= 1 && (this.interactionHintActive = !1, this.uniforms.uInteractionHint.value = 0);
      }
      if (this.backgroundRemovalEffectActive) {
        const s = yA();
        if (this.applyLaserEffectSettings(), w) this.uniforms.uEntranceSweep.value = 0.5;
        else {
          this.backgroundRemovalEffectElapsed += r;
          const D = this.backgroundRemovalEffectElapsed % (s.cycleDuration / 1e3);
          this.uniforms.uEntranceSweep.value = Math.min(D / (s.sweepDuration / 1e3), 1);
        }
      }
      this.uniforms.uTime.value = i / 1e3, this.renderer.render(this.scene, this.camera);
      const n = !w && this.options.wind > 1e-3 && this.state.progress > 0.01;
      (this.springActive || this.detachedExitActive || this.preparedEntrance !== null || this.entranceActive || this.interactionHintActive || this.backgroundRemovalEffectActive && !w || n) && this.requestRender();
    }, this.container = A, this.options = j(void 0, e), this.camera.position.z = 3, this.renderer = new g.WebGLRenderer({
      alpha: !0,
      antialias: !0,
      powerPreference: "high-performance",
      premultipliedAlpha: !0,
      preserveDrawingBuffer: !0
    }), this.renderer.setClearColor(0, 0), this.renderer.outputColorSpace = g.SRGBColorSpace, this.renderer.shadowMap.enabled = !0, this.renderer.shadowMap.type = g.PCFShadowMap, this.renderer.domElement.style.width = "100%", this.renderer.domElement.style.height = "100%", this.renderer.domElement.style.display = "block", this.renderer.domElement.style.touchAction = "none", this.renderer.domElement.style.cursor = "default", this.renderer.domElement.tabIndex = 0, this.renderer.domElement.setAttribute("role", "slider"), this.renderer.domElement.setAttribute("aria-valuemin", "0"), this.renderer.domElement.setAttribute("aria-valuemax", "100"), this.renderer.domElement.setAttribute("aria-valuenow", "0"), this.renderer.domElement.setAttribute("aria-label", "Interactive sticker. Drag a visible edge, or use arrow keys to preview the peel."), this.renderer.domElement.setAttribute("aria-keyshortcuts", "ArrowUp ArrowRight ArrowDown ArrowLeft Space"), this.uniforms = {
      uMap: { value: null },
      uPreparedMap: { value: null },
      uPreparedMix: { value: 0 },
      uPeel: { value: 0 },
      uPeelDepth: { value: 0 },
      uDetachedTension: { value: 0 },
      uRadius: { value: 0.08 },
      uMaxAngle: { value: 3.55 },
      uWind: { value: this.options.wind },
      uTime: { value: 0 },
      uOrigin: { value: this.grabOrigin.clone() },
      uPeelDir: { value: this.activeDirection.clone() },
      uMeshSize: { value: new g.Vector2(this.meshWidth, this.meshHeight) },
      uTexel: { value: new g.Vector2(1 / 1024, 1 / 512) },
      uEdgeFinishScale: { value: 1 },
      uEdgeBevelWidth: { value: this.options.edge.width },
      uEdgeFinishStrength: { value: this.options.edge.strength },
      uBackColor: { value: F(this.options.back.color, "#f7f5f2") },
      uGloss: { value: this.options.back.gloss },
      uRoughness: { value: this.options.back.roughness },
      uLightDirection: { value: new g.Vector3(this.options.lighting.direction.x, this.options.lighting.direction.y, this.options.lighting.direction.z).normalize() },
      uLightIntensity: { value: this.options.lighting.intensity },
      uAmbientLight: { value: this.options.lighting.ambient },
      uLightSoftness: { value: this.options.lighting.softness },
      uMaterialType: { value: UA(this.options.material.type) },
      uMaterialIntensity: { value: this.options.material.intensity },
      uMaterialScale: { value: this.options.material.scale },
      uHolographicGrain: { value: this.options.material.holographicGrain },
      uMaterialSeed: { value: this.options.material.seed },
      uMaterialBaked: { value: 0 },
      uHolographicColorA: { value: F(this.options.material.holographicColors[0], "#f2a7c5") },
      uHolographicColorB: { value: F(this.options.material.holographicColors[1], "#8edfd5") },
      uHolographicColorC: { value: F(this.options.material.holographicColors[2], "#9db4ea") },
      uShadowColor: { value: F(this.options.shadow.color, "#191823") },
      uShadowOpacity: { value: this.options.shadow.opacity },
      uSurfaceShadowEnabled: { value: this.options.peel.surfaceShadow ? 1 : 0 },
      uShadowBlur: { value: this.options.shadow.blur },
      uShadowDistance: { value: 0.04 },
      uShadowDirection: { value: new g.Vector2(0.7, -0.7) },
      uEntranceSweep: { value: -1 },
      uEntranceAxis: { value: this.entranceAxis.clone() },
      uEntranceScaleProgress: { value: -1 },
      uPreEntranceProgress: { value: 0 },
      uLaserCoreWidth: { value: 0.04 },
      uLaserBandWidth: { value: 0.3 },
      uLaserBandOpacity: { value: 0.46 },
      uLaserBrightness: { value: 1.18 },
      uLaserHighlightIntensity: { value: 0.62 },
      uBackgroundRemovalDistortion: { value: 0 },
      uRemovalDistortionRange: { value: 0.37 },
      uRemovalDistortionStrength: { value: 2.25 },
      uRemovalRippleDensity: { value: 12 },
      uRemovalRippleSpeed: { value: 4.2 },
      uInteractionHint: { value: 0 },
      uInteractionHintRadius: { value: 3 },
      uInteractionHintColor: { value: F(et, "rgb(36, 126, 245)") },
      uPreserveFrontColor: { value: 1 },
      uOpacity: { value: 1 }
    };
    const t = {
      ...g.UniformsUtils.clone(g.UniformsLib.lights),
      ...this.uniforms
    };
    this.stickerMaterial = new g.ShaderMaterial({
      uniforms: t,
      vertexShader: Ae,
      fragmentShader: ee,
      lights: !0,
      side: g.DoubleSide,
      transparent: !0,
      depthTest: !0,
      depthWrite: !0
    }), this.stickerMaterial.alphaTest = 8e-3, this.stickerMesh = new g.Mesh(this.geometry, this.stickerMaterial), this.stickerMesh.renderOrder = 20, this.stickerMesh.receiveShadow = !0, this.residueMaterial = new g.ShaderMaterial({
      uniforms: { ...this.uniforms },
      vertexShader: te,
      fragmentShader: ie,
      transparent: !0,
      depthTest: !0,
      depthWrite: !1,
      toneMapped: !1
    }), this.residueMesh = new g.Mesh(this.geometry, this.residueMaterial), this.residueMesh.position.z = -6e-3, this.residueMesh.renderOrder = 10, this.peelShadowDepthMaterial = new g.ShaderMaterial({
      uniforms: { ...this.uniforms },
      vertexShader: re,
      fragmentShader: we,
      side: g.DoubleSide,
      depthTest: !0,
      depthWrite: !0
    }), this.stickerMesh.castShadow = !0, this.stickerMesh.customDepthMaterial = this.peelShadowDepthMaterial, this.peelShadowLight.castShadow = !0, this.peelShadowLight.shadow.mapSize.set(this.options.quality === "high" ? 2048 : 1024, this.options.quality === "high" ? 2048 : 1024), this.peelShadowLight.shadow.bias = -1e-4, this.peelShadowLight.shadow.normalBias = 15e-4, this.peelShadowLight.target = this.peelShadowTarget, this.scene.add(this.peelShadowTarget, this.peelShadowLight), this.groundShadowMaterial = new g.ShadowMaterial({
      color: F(this.options.shadow.color, "#191823"),
      opacity: this.options.shadow.opacity,
      transparent: !0,
      depthTest: !0,
      depthWrite: !1,
      toneMapped: !1
    }), this.groundShadowMesh = new g.Mesh(this.groundShadowGeometry, this.groundShadowMaterial), this.groundShadowMesh.position.z = -0.012, this.groundShadowMesh.receiveShadow = !0, this.groundShadowMesh.renderOrder = 5, this.scene.add(this.groundShadowMesh), this.scene.add(this.residueMesh), this.scene.add(this.stickerMesh);
    try {
      this.attach();
    } catch (i) {
      throw this.destroy(), i;
    }
  }
  attach() {
    const A = this.renderer.domElement;
    this.container.appendChild(A), A.addEventListener("pointerdown", this.onPointerDown), A.addEventListener("pointermove", this.onPointerMove), A.addEventListener("pointerup", this.onPointerUp), A.addEventListener("pointercancel", this.onPointerUp), A.addEventListener("lostpointercapture", this.onLostPointerCapture), A.addEventListener("pointerleave", this.onPointerLeave), A.addEventListener("keydown", this.onKeyDown), A.addEventListener("webglcontextlost", this.onContextLost), window.addEventListener("pointerup", this.onWindowPointerEnd, !0), window.addEventListener("pointercancel", this.onWindowPointerEnd, !0), window.addEventListener("blur", this.onWindowBlur), document.addEventListener("visibilitychange", this.onVisibilityChange), typeof ResizeObserver < "u" ? (this.resizeObserver = new ResizeObserver(this.resizeObserved), this.resizeObserver.observe(this.container)) : window.addEventListener("resize", this.scheduleResize), this.resize();
  }
  async setSource(A) {
    if (this.destroyed) return;
    this.cancelPreparedEntrance(), this.requestedSource = A, this.sourceRebuildTimer !== null && (window.clearTimeout(this.sourceRebuildTimer), this.sourceRebuildTimer = null);
    const e = ++this.sourceRevision;
    try {
      const t = await kA(A, this.options.outline);
      if (this.destroyed || e !== this.sourceRevision) return;
      this.source = A, this.options.source = A, this.applyArtwork(t);
    } catch (t) {
      const i = t instanceof Error ? t.message : "The sticker source failed to render.";
      throw this.emit("error", { message: i }), t;
    }
  }
  async prepareSource(A, e = {}) {
    if (this.destroyed) throw new Error("The sticker renderer has been destroyed.");
    const t = j(this.options, e), i = await kA(A, t.outline);
    if (this.destroyed) throw new Error("The sticker renderer has been destroyed.");
    const r = this.createArtworkTexture(i, t.material, t.lighting);
    try {
      this.renderer.initTexture(r);
    } catch (n) {
      throw r.dispose(), n;
    }
    const w = {
      payload: {
        artwork: i,
        texture: r,
        source: A,
        options: e
      },
      consume: null
    };
    return w.consume = (n, s) => {
      if (this.preparedSourceStates.delete(w), n === "dispose" || this.destroyed) {
        s.texture.dispose();
        return;
      }
      if (n === "commit") {
        this.sourceRevision += 1, this.requestedSource = s.source, this.source = s.source, this.options = j(this.options, {
          ...s.options,
          source: s.source
        }), this.applyArtwork(s.artwork, s.texture);
        return;
      }
      n === "entrance" && (this.cancelPreparedEntrance(), this.entranceActive = !1, this.clearEntrancePose(), this.preparedEntrance = {
        artwork: s.artwork,
        texture: s.texture,
        source: s.source,
        options: s.options,
        elapsed: 0
      }, this.uniforms.uPreparedMap.value = s.texture, this.uniforms.uPreparedMix.value = 0, this.uniforms.uPreEntranceProgress.value = 0, this.requestRender());
    }, this.preparedSourceStates.add(w), tt(w);
  }
  setOptions(A) {
    if (this.destroyed) return;
    const e = this.options.outline, t = this.options.quality, i = this.options.display, r = this.materialKey();
    this.options = j(this.options, A), this.artwork && this.materialKey() !== r && !A.source && this.refreshMaterialTexture(), A.source && this.setSource(A.source).catch(() => {
    }), A.outline && (this.options.outline.width !== e.width || this.options.outline.color !== e.color) && !A.source && (this.sourceRebuildTimer !== null && window.clearTimeout(this.sourceRebuildTimer), this.sourceRebuildTimer = window.setTimeout(() => {
      this.sourceRebuildTimer = null, this.setSource(this.requestedSource).catch(() => {
      });
    }, 70)), (this.options.quality !== t || this.options.display.width !== i.width || this.options.display.height !== i.height) && this.artwork && this.updateMeshGeometry(this.artwork.aspect), this.applyOptionsToRenderer(), this.requestRender();
  }
  reset() {
    const A = this.pointerId;
    this.pointerId = null, this.state.dragging = !1, A !== null && this.renderer.domElement.hasPointerCapture(A) && this.renderer.domElement.releasePointerCapture(A), this.springActive = !1, this.springVelocity = 0, this.springTargetDepth = 0, this.dragDetached = !1, this.detachedTension = 0, this.detachedExitActive = !1, this.detachedExitElapsed = 0, this.detachedExitSpin = 0, this.entranceActive = !1, this.entranceElapsed = 0, this.interactionHintActive = !1, this.interactionHintElapsed = 0, this.stickerMesh.position.set(0, 0, 0), this.stickerMesh.scale.set(1, 1, 1), this.stickerMesh.rotation.z = g.MathUtils.degToRad(this.options.tilt), this.uniforms.uEntranceSweep.value = -1, this.uniforms.uEntranceScaleProgress.value = -1, this.uniforms.uInteractionHint.value = 0, this.peelAudio.reset(0), this.setCreaseDepth(0), this.state.pointer = null, this.state.grabPoint = null, this.renderer.domElement.style.cursor = "default", this.updatePeelUniforms(), this.emit("peelchange", {
      amount: 0,
      progress: 0
    }), this.requestRender();
  }
  setPeelProgress(A, e = {
    origin: {
      x: 0,
      y: 0.5
    },
    target: {
      x: 1,
      y: 0.5
    }
  }) {
    if (this.destroyed || !this.artwork) return;
    this.springActive = !1, this.springVelocity = 0, this.detachedExitActive = !1, this.entranceActive = !1, this.interactionHintActive = !1, this.state.dragging = !1, this.stickerMesh.position.set(0, 0, 0), this.stickerMesh.scale.set(1, 1, 1), this.stickerMesh.rotation.z = g.MathUtils.degToRad(this.options.tilt), this.uniforms.uEntranceSweep.value = -1, this.uniforms.uEntranceScaleProgress.value = -1, this.uniforms.uInteractionHint.value = 0;
    const t = E(e.origin.x, 0, 1) - 0.5, i = 0.5 - E(e.origin.y, 0, 1), r = e.target.x - 0.5, w = 0.5 - e.target.y;
    this.grabOrigin.set(t * this.meshWidth, i * this.meshHeight);
    const n = (r - t) * this.meshWidth, s = (w - i) * this.meshHeight, D = Math.hypot(n, s);
    this.grabDirection.set(n, s), this.grabDirection.lengthSq() < 1e-4 && this.grabDirection.set(1, 0), this.grabDirection.normalize(), this.activeDirection.copy(this.grabDirection), this.grabExtent = this.projectionExtent(this.grabOrigin, this.activeDirection);
    const P = this.peelModelForDepth(this.grabExtent).projection, a = Math.max(D, P), o = E(A, 0, 1) * a;
    this.setCreaseDepth(this.solveCreaseDepth(o));
    const v = Math.max(0, o - P);
    this.setDetachedDragOffset(this.activeDirection.x * v, this.activeDirection.y * v), this.state.grabPoint = {
      x: this.grabOrigin.x,
      y: this.grabOrigin.y
    }, this.state.pointer = {
      x: this.grabOrigin.x + this.activeDirection.x * o,
      y: this.grabOrigin.y + this.activeDirection.y * o
    }, this.updatePeelUniforms(), this.renderer.render(this.scene, this.camera);
  }
  setEntranceProgress(A) {
    this.destroyed || !this.artwork || (this.springActive = !1, this.springVelocity = 0, this.detachedExitActive = !1, this.entranceActive = !1, this.interactionHintActive = !1, this.state.dragging = !1, this.detachedTension = 0, this.stickerMesh.position.set(0, 0, 0), this.stickerMesh.scale.set(1, 1, 1), this.stickerMesh.rotation.z = g.MathUtils.degToRad(this.options.tilt), this.uniforms.uInteractionHint.value = 0, this.setCreaseDepth(0), this.state.grabPoint = null, this.state.pointer = null, this.configureEntranceAxis(), this.applyEntranceElapsed(E(A, 0, 1) * YA) && this.clearEntrancePose(), this.updatePeelUniforms(), this.renderer.render(this.scene, this.camera));
  }
  setBackgroundRemovalEffect(A) {
    this.destroyed || (this.backgroundRemovalEffectActive = A, this.backgroundRemovalEffectElapsed = 0, this.configureEntranceAxis(), this.uniforms.uBackgroundRemovalDistortion.value = A ? 1 : 0, this.entranceActive || (this.uniforms.uEntranceSweep.value = A ? 0 : -1), this.requestRender());
  }
  reappear() {
    this.destroyed || this.startEntranceAnimation();
  }
  setRenderScale(A) {
    if (this.destroyed) return;
    const e = E(A, 1, 6);
    Math.abs(e - this.renderScale) < 1e-3 || (this.renderScale = e, this.resize());
  }
  getRenderSnapshot() {
    const A = this.uniforms.uOrigin.value, e = this.uniforms.uPeelDir.value;
    return {
      progress: this.uniforms.uPeel.value,
      peelDepth: this.uniforms.uPeelDepth.value,
      peelRadius: this.uniforms.uRadius.value,
      detachedTension: this.uniforms.uDetachedTension.value,
      origin: {
        x: A.x,
        y: A.y
      },
      direction: {
        x: e.x,
        y: e.y
      },
      position: {
        x: this.stickerMesh.position.x,
        y: this.stickerMesh.position.y
      },
      scale: {
        x: this.stickerMesh.scale.x,
        y: this.stickerMesh.scale.y
      },
      rotation: this.stickerMesh.rotation.z,
      entranceSweep: this.uniforms.uEntranceSweep.value,
      entranceScaleProgress: this.uniforms.uEntranceScaleProgress.value,
      time: this.uniforms.uTime.value
    };
  }
  setRenderSnapshot(A) {
    this.destroyed || !this.artwork || (this.springActive = !1, this.detachedExitActive = !1, this.entranceActive = !1, this.interactionHintActive = !1, this.state.dragging = !1, this.state.progress = A.progress, this.creaseDepth = A.peelDepth, this.effectivePeelRadius = A.peelRadius, this.detachedTension = A.detachedTension, this.grabOrigin.set(A.origin.x, A.origin.y), this.activeDirection.set(A.direction.x, A.direction.y), this.stickerMesh.position.set(A.position.x, A.position.y, 0), this.stickerMesh.scale.set(A.scale.x, A.scale.y, 1), this.stickerMesh.rotation.z = A.rotation, this.uniforms.uPeel.value = A.progress, this.uniforms.uPeelDepth.value = A.peelDepth, this.uniforms.uRadius.value = A.peelRadius, this.uniforms.uDetachedTension.value = A.detachedTension, this.uniforms.uOrigin.value.copy(this.grabOrigin), this.uniforms.uPeelDir.value.copy(this.activeDirection), this.uniforms.uEntranceSweep.value = A.entranceSweep, this.uniforms.uEntranceScaleProgress.value = A.entranceScaleProgress, this.uniforms.uTime.value = A.time, this.renderer.render(this.scene, this.camera));
  }
  resizeInternal(A) {
    if (this.destroyed) return;
    const e = this.container.clientWidth, t = this.container.clientHeight, i = e !== this.measuredClientWidth || t !== this.measuredClientHeight;
    this.measuredClientWidth = e, this.measuredClientHeight = t;
    const r = Math.max(2, Math.round(e || 640)), w = Math.max(2, Math.round(t || 420)), n = this.options.quality === "low" ? 1.25 : 2, s = Math.min(Math.min(window.devicePixelRatio || 1, n) * this.renderScale, 6), D = r !== this.renderedWidth || w !== this.renderedHeight || s !== this.renderedPixelRatio;
    if (D) {
      this.renderedWidth = r, this.renderedHeight = w, this.renderedPixelRatio = s, this.renderer.setPixelRatio(s), this.renderer.setSize(r, w, !1), this.viewportHeightPx = w, this.viewHeight = 2, this.viewWidth = r / w * this.viewHeight, this.groundShadowMesh.scale.set(this.viewWidth * 1.2, this.viewHeight * 1.2, 1), this.camera.left = -this.viewWidth / 2, this.camera.right = this.viewWidth / 2, this.camera.top = this.viewHeight / 2, this.camera.bottom = -this.viewHeight / 2, this.camera.updateProjectionMatrix();
      const a = this.peelShadowLight.shadow.camera, o = Math.max(this.viewWidth, this.viewHeight) * 0.9;
      a.left = -o, a.right = o, a.top = o, a.bottom = -o, a.near = 0.1, a.far = 16, a.updateProjectionMatrix();
    }
    const P = this.artwork ? this.updateMeshGeometry(this.artwork.aspect, A || D || i) : !1;
    !D && !P && !i && !A || (this.applyOptionsToRenderer(), this.renderer.render(this.scene, this.camera));
  }
  getState() {
    return {
      ready: this.state.ready,
      dragging: this.state.dragging,
      progress: this.state.progress,
      grabPoint: this.state.grabPoint ? { ...this.state.grabPoint } : null,
      pointer: this.state.pointer ? { ...this.state.pointer } : null
    };
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = !0, cancelAnimationFrame(this.frameRequest), cancelAnimationFrame(this.resizeFrameRequest), cancelAnimationFrame(this.hoverFrameRequest), this.frameRequest = 0, this.resizeFrameRequest = 0, this.hoverFrameRequest = 0;
    for (const e of this.preparedSourceStates) {
      const { payload: t } = ZA(e);
      t?.texture.dispose();
    }
    this.preparedSourceStates.clear(), this.cancelPreparedEntrance(), this.sourceRebuildTimer !== null && (window.clearTimeout(this.sourceRebuildTimer), this.sourceRebuildTimer = null), this.resizeObserver?.disconnect(), this.resizeObserver = null, window.removeEventListener("resize", this.scheduleResize);
    const A = this.renderer.domElement;
    A.removeEventListener("pointerdown", this.onPointerDown), A.removeEventListener("pointermove", this.onPointerMove), A.removeEventListener("pointerup", this.onPointerUp), A.removeEventListener("pointercancel", this.onPointerUp), A.removeEventListener("lostpointercapture", this.onLostPointerCapture), A.removeEventListener("pointerleave", this.onPointerLeave), A.removeEventListener("keydown", this.onKeyDown), A.removeEventListener("webglcontextlost", this.onContextLost), window.removeEventListener("pointerup", this.onWindowPointerEnd, !0), window.removeEventListener("pointercancel", this.onWindowPointerEnd, !0), window.removeEventListener("blur", this.onWindowBlur), document.removeEventListener("visibilitychange", this.onVisibilityChange), this.texture?.dispose(), this.texture = null, this.artwork = null, this.source = S, this.requestedSource = S, this.options = j(void 0, {}), this.uniforms.uMap.value = null, this.uniforms.uPreparedMap.value = null, this.geometry.dispose();
    for (const e of Object.keys(this.geometry.attributes)) this.geometry.deleteAttribute(e);
    this.geometry.setIndex(null), this.groundShadowGeometry.dispose(), this.stickerMaterial.dispose(), this.residueMaterial.dispose(), this.peelShadowDepthMaterial.dispose(), this.groundShadowMaterial.dispose(), this.peelAudio.destroy(), this.renderer.dispose(), this.renderer.forceContextLoss(), A.width = 1, A.height = 1, A.remove();
  }
  materialKey() {
    const A = this.options.material, e = this.options.lighting;
    return JSON.stringify([
      A.type,
      A.intensity,
      A.scale,
      A.holographicGrain,
      A.seed,
      ...A.holographicColors,
      e.direction.x,
      e.direction.y,
      e.direction.z,
      e.intensity
    ]);
  }
  createArtworkTexture(A, e = this.options.material, t = this.options.lighting) {
    const i = be(A.canvas, A.width, A.height, e, t), r = new g.CanvasTexture(i);
    return r.colorSpace = g.SRGBColorSpace, r.minFilter = g.LinearMipmapLinearFilter, r.magFilter = g.LinearFilter, r.generateMipmaps = !0, r.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy()), r.needsUpdate = !0, r;
  }
  refreshMaterialTexture() {
    if (!this.artwork) return;
    const A = this.texture, e = this.createArtworkTexture(this.artwork);
    this.texture = e, this.uniforms.uMap.value = e, this.uniforms.uPreparedMap.value === A && (this.uniforms.uPreparedMap.value = e), this.uniforms.uMaterialBaked.value = 1, A?.dispose();
  }
  cancelPreparedEntrance() {
    const A = this.preparedEntrance;
    this.preparedEntrance = null, A && A.texture.dispose(), this.uniforms.uPreparedMix.value = 0, this.uniforms.uPreEntranceProgress.value = 0, this.uniforms.uPreparedMap.value = this.texture;
  }
  applyArtwork(A, e = this.createArtworkTexture(A)) {
    this.artwork = A;
    const t = this.texture;
    this.texture = e, this.uniforms.uMap.value = e, this.uniforms.uPreparedMap.value = e, this.uniforms.uPreparedMix.value = 0, this.uniforms.uMaterialBaked.value = 1, this.uniforms.uPreEntranceProgress.value = 0, this.uniforms.uTexel.value.set(1 / A.width, 1 / A.height), this.updateMeshGeometry(A.aspect), this.applyOptionsToRenderer(), this.reset(), this.state.ready = !0, t?.dispose(), this.emit("ready", {
      width: A.width,
      height: A.height,
      hasTransparency: A.hasTransparency
    });
  }
  updateMeshGeometry(A, e = !1) {
    const t = this.viewHeight / Math.max(1, this.viewportHeightPx);
    let i, r;
    if (this.options.display.width > 0 && this.options.display.height > 0)
      i = this.options.display.width * t, r = this.options.display.height * t;
    else {
      const v = Math.min(this.viewWidth * 0.78, qe * t), l = Math.min(this.viewHeight * 0.58, Ze * t);
      i = v, r = i / A, r > l && (r = l, i = r * A);
    }
    const w = this.options.display.width > 0 ? Math.max(1e-3, i) : Math.max(0.34, i), n = this.options.display.height > 0 ? Math.max(1e-3, r) : Math.max(0.25, r), s = this.options.quality === "high" ? 240 : this.options.quality === "medium" ? 160 : 96, D = E(Math.round(s), 64, 256), P = E(Math.round(s / Math.max(A, 0.35)), 56, 192), a = D !== this.geometrySegmentsX || P !== this.geometrySegmentsY, o = Math.abs(w - this.geometryWidth) > 1e-6 || Math.abs(n - this.geometryHeight) > 1e-6;
    if (!a && !o)
      return e && this.resetGeometryPeelState(), !1;
    if (this.meshWidth = w, this.meshHeight = n, a) {
      const v = new g.PlaneGeometry(this.meshWidth, this.meshHeight, D, P), l = this.geometry;
      this.geometry = v, this.stickerMesh.geometry = v, this.residueMesh.geometry = v, l.dispose(), this.geometrySegmentsX = D, this.geometrySegmentsY = P;
    } else {
      const v = this.geometry.attributes.position;
      let l = 0;
      for (let h = 0; h <= P; h += 1) {
        const c = (0.5 - h / P) * this.meshHeight;
        for (let B = 0; B <= D; B += 1) {
          const Q = (B / D - 0.5) * this.meshWidth;
          v.setXYZ(l, Q, c, 0), l += 1;
        }
      }
      v.needsUpdate = !0, this.geometry.computeBoundingBox(), this.geometry.computeBoundingSphere();
    }
    return this.geometryWidth = this.meshWidth, this.geometryHeight = this.meshHeight, this.resetGeometryPeelState(), !0;
  }
  resetGeometryPeelState() {
    this.uniforms.uMeshSize.value.set(this.meshWidth, this.meshHeight), this.grabOrigin.set(-this.meshWidth / 2, 0), this.grabDirection.set(1, 0), this.activeDirection.copy(this.grabDirection), this.grabExtent = this.meshWidth, this.setCreaseDepth(0), this.updatePeelUniforms();
  }
  applyOptionsToRenderer() {
    const A = g.MathUtils.degToRad(this.options.tilt);
    this.stickerMesh.rotation.z = A, this.residueMesh.rotation.z = A, this.uniforms.uBackColor.value = F(this.options.back.color, "#f7f5f2"), this.uniforms.uEdgeBevelWidth.value = E(this.options.edge.width, 0.5, 6), this.uniforms.uEdgeFinishStrength.value = E(this.options.edge.strength, 0, 1), this.uniforms.uGloss.value = E(this.options.back.gloss, 0, 1), this.uniforms.uRoughness.value = E(this.options.back.roughness, 0, 1), this.uniforms.uMaterialType.value = UA(this.options.material.type), this.uniforms.uMaterialIntensity.value = E(this.options.material.intensity, 0, 1), this.uniforms.uMaterialScale.value = E(this.options.material.scale, 0.2, 4), this.uniforms.uHolographicGrain.value = E(this.options.material.holographicGrain, 0, 1), this.uniforms.uMaterialSeed.value = this.options.material.seed, this.uniforms.uHolographicColorA.value = F(this.options.material.holographicColors[0], "#f2a7c5"), this.uniforms.uHolographicColorB.value = F(this.options.material.holographicColors[1], "#8edfd5"), this.uniforms.uHolographicColorC.value = F(this.options.material.holographicColors[2], "#9db4ea"), this.uniforms.uWind.value = Math.max(0, this.options.wind);
    const e = this.uniforms.uLightDirection.value;
    e.set(this.options.lighting.direction.x, this.options.lighting.direction.y, Math.max(1e-3, this.options.lighting.direction.z)), e.lengthSq() < 1e-4 ? e.set(-0.38, 0.52, 0.76) : e.normalize();
    const t = E(this.options.lighting.intensity, 0, 1.5), i = E(this.options.lighting.ambient, 0, 1), r = E(this.options.lighting.softness, 0, 1);
    this.uniforms.uLightIntensity.value = t, this.uniforms.uAmbientLight.value = i, this.uniforms.uLightSoftness.value = r;
    const w = this.options.sound.src.trim();
    this.peelAudio.configure({
      enabled: this.options.sound.enabled,
      src: w || KA,
      volume: this.options.sound.volume,
      useBuiltInProfile: !w
    });
    const n = this.options.peel.maxAngle, s = n > Math.PI * 2 ? g.MathUtils.degToRad(n) : n;
    this.uniforms.uMaxAngle.value = E(s, SA, Je);
    const D = this.options.peel.radius, P = this.container.getBoundingClientRect(), a = D <= 1 ? Math.max(8e-3, Math.min(this.meshWidth, this.meshHeight) * D) : Math.max(8e-3, D / Math.max(P.height, 1) * this.viewHeight);
    this.basePeelRadius = a * g.MathUtils.lerp(0.82, 1.16, E(this.options.peel.stiffness, 0, 1)), this.residueMesh.visible = this.options.peel.residue, this.uniforms.uSurfaceShadowEnabled.value = this.options.peel.surfaceShadow ? 1 : 0, this.setCreaseDepth(this.creaseDepth), this.uniforms.uShadowColor.value = F(this.options.shadow.color, "#191823");
    const o = (0.45 + t * 0.75) * (1 - i * 0.35), v = E(this.options.shadow.opacity * o, 0, 0.9);
    this.uniforms.uShadowOpacity.value = v, this.groundShadowMaterial.color.copy(F(this.options.shadow.color, "#191823")), this.groundShadowMaterial.opacity = v;
    const l = this.meshWidth / Math.max(this.viewWidth, 1e-3) * Math.max(this.renderer.domElement.clientWidth, 1), h = this.artwork ? this.artwork.width / Math.max(l, 1) : 1;
    this.uniforms.uEdgeFinishScale.value = E(h, 0.75, 8), this.uniforms.uInteractionHintRadius.value = this.artwork ? E(this.options.peel.grabWidth * h, 3, Math.min(this.artwork.width, this.artwork.height) * 0.13) : 3;
    const c = g.MathUtils.lerp(0.55, 1.3, r);
    this.uniforms.uShadowBlur.value = Math.max(0, this.options.shadow.blur) * h * 0.34 * c, this.uniforms.uShadowDistance.value = Math.max(0, this.options.shadow.distance) / Math.max(P.width || 1, 1) * this.viewWidth;
    const B = this.uniforms.uShadowDirection.value;
    if (B.set(-e.x, -e.y), B.lengthSq() < 1e-4) {
      const C = g.MathUtils.degToRad(this.options.shadow.angle);
      B.set(Math.cos(C), -Math.sin(C));
    }
    B.normalize();
    const Q = 1.6 + this.uniforms.uShadowDistance.value * 34;
    this.peelShadowLight.position.set(e.x * Q, e.y * Q, Math.max(0.8, e.z * Q)), this.peelShadowTarget.position.set(0, 0, 0), this.peelShadowLight.shadow.radius = E(this.options.shadow.blur * g.MathUtils.lerp(0.42, 0.72, r), 1, 56);
    const f = this.options.quality === "high" ? 2048 : 1024;
    this.peelShadowLight.shadow.mapSize.set(f, f), this.peelShadowLight.shadow.needsUpdate = !0;
  }
  updatePeelUniforms() {
    this.uniforms.uPeel.value = this.state.progress, this.uniforms.uPeelDepth.value = this.creaseDepth, this.uniforms.uDetachedTension.value = this.detachedTension, this.uniforms.uRadius.value = this.effectivePeelRadius, this.uniforms.uOrigin.value.copy(this.grabOrigin), this.uniforms.uPeelDir.value.copy(this.activeDirection);
    const A = Math.round(E(this.state.progress, 0, 1) * 100);
    this.renderer.domElement.setAttribute("aria-valuenow", String(A)), this.renderer.domElement.setAttribute("aria-valuetext", `${A}% peeled`);
  }
  projectedGrabDistance(A, e, t = this.uniforms.uMaxAngle.value) {
    if (A <= 0) return 0;
    const i = Math.max(e, 1e-3), r = Math.min(A / i, t), w = i * t;
    let n = -i * Math.sin(r);
    return A > w && (n -= (A - w) * Math.cos(t)), Math.max(0, A + n);
  }
  peelModelForDepth(A) {
    const e = E(A, 0, Math.max(this.grabExtent, 1e-3));
    if (e <= 1e-6) return {
      depth: 0,
      radius: this.basePeelRadius,
      projection: 0
    };
    const t = this.projectedGrabDistance(e, this.basePeelRadius);
    if (t >= e / We) return {
      depth: e,
      radius: this.basePeelRadius,
      projection: t
    };
    const i = e / SA;
    return {
      depth: e,
      radius: i,
      projection: this.projectedGrabDistance(e, i)
    };
  }
  setCreaseDepth(A) {
    const e = this.peelModelForDepth(A);
    this.creaseDepth = e.depth, this.effectivePeelRadius = e.radius, this.grabProjection = e.projection, this.state.progress = E(this.creaseDepth / Math.max(this.grabExtent, 1e-3), 0, 1);
  }
  solveCreaseDepth(A) {
    const e = Math.max(0, A), t = this.peelModelForDepth(this.grabExtent);
    if (e >= t.projection) return t.depth;
    if (e <= 1e-6) return 0;
    let i = 0, r = this.grabExtent;
    for (let w = 0; w < 16; w += 1) {
      const n = (i + r) * 0.5;
      this.peelModelForDepth(n).projection < e ? i = n : r = n;
    }
    return (i + r) * 0.5;
  }
  setDetachedDragOffset(A, e) {
    const t = g.MathUtils.degToRad(this.options.tilt), i = Math.cos(t), r = Math.sin(t), w = E(Math.hypot(A, e) / Math.max(this.grabExtent * 0.45, 0.12), 0, 1);
    this.detachedTension = w * w * (3 - 2 * w);
    const n = this.grabProjection - this.grabExtent * 2, s = A + this.activeDirection.x * n * this.detachedTension, D = e + this.activeDirection.y * n * this.detachedTension;
    this.stickerMesh.position.set(s * i - D * r, s * r + D * i, 0);
  }
  screenToLocal(A, e) {
    const t = this.renderer.domElement.getBoundingClientRect(), i = (A - t.left) / Math.max(t.width, 1) * 2 - 1, r = 1 - (e - t.top) / Math.max(t.height, 1) * 2, w = i * (this.viewWidth / 2), n = r * (this.viewHeight / 2), s = -g.MathUtils.degToRad(this.options.tilt), D = Math.cos(s), P = Math.sin(s);
    return new g.Vector2(w * D - n * P, w * P + n * D);
  }
  sampleAlpha(A, e) {
    if (!this.artwork) return 0;
    const t = E(Math.round(A), 0, this.artwork.width - 1), i = E(Math.round(e), 0, this.artwork.height - 1);
    return this.artwork.alpha[i * this.artwork.width + t] / 255;
  }
  sampleExterior(A, e) {
    if (!this.artwork) return !1;
    const t = Math.round(A), i = Math.round(e);
    return t < 0 || t >= this.artwork.width || i < 0 || i >= this.artwork.height ? !0 : this.artwork.exteriorAlpha[i * this.artwork.width + t] === 1;
  }
  hitEdge(A) {
    if (!this.artwork) return null;
    const e = A.x / this.meshWidth + 0.5, t = A.y / this.meshHeight + 0.5;
    if (e < -0.04 || e > 1.04 || t < -0.04 || t > 1.04) return null;
    const i = e * (this.artwork.width - 1), r = (1 - t) * (this.artwork.height - 1), w = this.meshWidth / Math.max(this.viewWidth, 1e-3) * this.renderer.domElement.clientWidth, n = this.artwork.width / Math.max(w, 1), s = E(this.options.peel.grabWidth * n, 3, Math.min(this.artwork.width, this.artwork.height) * 0.13), D = Math.ceil(s), P = Math.max(0, Math.floor(i - D)), a = Math.min(this.artwork.width - 1, Math.ceil(i + D)), o = Math.max(0, Math.floor(r - D)), v = Math.min(this.artwork.height - 1, Math.ceil(r + D));
    let l = -1, h = -1, c = s * s + 1;
    for (let C = o; C <= v; C += 1) for (let u = P; u <= a; u += 1) {
      const d = u - i, z = C - r, L = d * d + z * z;
      L >= c || L > s * s || this.sampleAlpha(u, C) < 0.1 || (this.sampleExterior(u - 1, C) || this.sampleExterior(u + 1, C) || this.sampleExterior(u, C - 1) || this.sampleExterior(u, C + 1)) && (l = u, h = C, c = L);
    }
    if (l < 0 || h < 0) return null;
    const B = new g.Vector2((l / Math.max(this.artwork.width - 1, 1) - 0.5) * this.meshWidth, (0.5 - h / Math.max(this.artwork.height - 1, 1)) * this.meshHeight), Q = E(s * 0.14, 1.5, 4.5), f = new g.Vector2(this.sampleAlpha(l + Q, h) - this.sampleAlpha(l - Q, h), -(this.sampleAlpha(l, h + Q) - this.sampleAlpha(l, h - Q)));
    return f.lengthSq() < 8e-3 && f.set(-B.x, -B.y), f.lengthSq() < 1e-4 && f.set(1, 0), f.normalize(), {
      local: B,
      inward: f
    };
  }
  projectionExtent(A, e) {
    if (!this.artwork) return Math.max(this.meshHeight * 0.35, this.meshWidth);
    let t = this.meshHeight * 0.35;
    for (let i = 0; i < this.artwork.support.length; i += 2) {
      const r = (this.artwork.support[i] - 0.5) * this.meshWidth, w = (0.5 - this.artwork.support[i + 1]) * this.meshHeight;
      t = Math.max(t, (r - A.x) * e.x + (w - A.y) * e.y);
    }
    return Math.max(this.meshHeight * 0.35, t + this.meshHeight * 0.025);
  }
  finishPointerDrag(A) {
    if (!this.state.dragging) return;
    const e = this.pointerId;
    this.pointerId = null, this.state.dragging = !1, e !== null && this.renderer.domElement.hasPointerCapture(e) && this.renderer.domElement.releasePointerCapture(e), this.renderer.domElement.style.cursor = "grab";
    const t = this.options.peel.release, i = this.springActive ? Math.min(this.state.progress, E(this.springTargetDepth / Math.max(this.grabExtent, 1e-3), 0, 1)) : this.state.progress, r = t === "snap" && i >= gA || t === "snap" && this.options.peel.detachThreshold < gA && i >= E(this.options.peel.detachThreshold, 0.1, gA);
    r && (this.setCreaseDepth(this.grabExtent), this.state.pointer = {
      x: this.grabOrigin.x + this.activeDirection.x * this.grabProjection,
      y: this.grabOrigin.y + this.activeDirection.y * this.grabProjection
    }, this.updatePeelUniforms(), this.peelAudio.update(this.state.progress, A, this.activeDirection.x)), this.peelAudio.end(this.state.progress);
    const w = t === "reset" || t === "snap" && !r, n = this.reducedMotionQuery.matches;
    if (w || (this.springActive = !1, this.springVelocity = 0, this.springTargetDepth = this.creaseDepth), w && !n && (this.springActive = !0, this.springVelocity = 0, this.springTargetDepth = 0), this.emit("peelend", {
      amount: this.state.progress,
      progress: this.state.progress,
      willReset: w
    }), r) {
      if (n) {
        if (this.emit("detachcomplete", { progress: 1 }), this.destroyed) return;
        this.reset();
        return;
      }
      this.detachedExitActive = !0, this.detachedExitElapsed = 0, this.detachedExitSpin = this.activeDirection.x >= 0 ? -0.42 : 0.42;
    }
    if (w && n) {
      this.reset();
      return;
    }
    this.requestRender();
  }
  requestRender() {
    this.destroyed || this.frameRequest || (this.frameRequest = requestAnimationFrame(this.renderFrame));
  }
  startInteractionHint() {
    this.interactionHintActive = !0, this.interactionHintElapsed = 0, this.uniforms.uInteractionHint.value = 1, this.requestRender();
  }
  configureEntranceAxis() {
    this.entranceAxis.set(this.meshWidth >= this.meshHeight ? 1 : 0, this.meshWidth >= this.meshHeight ? 0 : -1), this.uniforms.uEntranceAxis.value.copy(this.entranceAxis);
  }
  applyEntranceElapsed(A) {
    const e = E(A / YA, 0, 1);
    this.uniforms.uEntranceScaleProgress.value = e;
    const t = E((A - RA) / _e, 0, 1);
    return this.uniforms.uEntranceSweep.value = A < RA ? -1 : t, e >= 1 && t >= 1;
  }
  clearEntrancePose() {
    this.uniforms.uEntranceScaleProgress.value = -1, this.uniforms.uEntranceSweep.value = -1;
  }
  startEntranceAnimation() {
    this.reset(), this.peelAudio.playReappear(), this.entranceActive = !0, this.entranceElapsed = 0, this.configureEntranceAxis(), this.applyLaserEffectSettings(), this.applyEntranceElapsed(0), this.requestRender();
  }
  applyLaserEffectSettings() {
    const A = yA();
    this.uniforms.uLaserCoreWidth.value = A.coreWidth, this.uniforms.uLaserBandWidth.value = A.bandWidth, this.uniforms.uLaserBandOpacity.value = A.bandOpacity, this.uniforms.uLaserBrightness.value = A.brightness, this.uniforms.uLaserHighlightIntensity.value = A.highlightIntensity, this.uniforms.uRemovalDistortionRange.value = A.distortionRange, this.uniforms.uRemovalDistortionStrength.value = A.distortionStrength, this.uniforms.uRemovalRippleDensity.value = A.rippleDensity, this.uniforms.uRemovalRippleSpeed.value = A.rippleSpeed;
  }
  emit(A, e) {
    this.container.dispatchEvent(new CustomEvent(A, { detail: e }));
  }
};
function rt(A) {
  return {
    ready: A.ready,
    dragging: A.dragging,
    progress: A.progress,
    grabPoint: A.grabPoint ? { ...A.grabPoint } : null,
    pointer: A.pointer ? { ...A.pointer } : null
  };
}
function wt(A) {
  return {
    ...A,
    origin: { ...A.origin },
    direction: { ...A.direction },
    position: { ...A.position },
    scale: { ...A.scale }
  };
}
var st = class {
  constructor(A) {
    this.resize = () => {
      this.renderer?.resize();
    }, this.renderer = A, this.lastState = A.getState(), this.lastSnapshot = A.getRenderSnapshot();
  }
  async setSource(A) {
    await this.renderer?.setSource(A);
  }
  async prepareSource(A, e) {
    if (!this.renderer) throw new Error("The sticker renderer has been destroyed.");
    return this.renderer.prepareSource(A, e);
  }
  setOptions(A) {
    this.renderer?.setOptions(A);
  }
  reset() {
    this.renderer?.reset();
  }
  setPeelProgress(A, e) {
    this.renderer?.setPeelProgress(A, e);
  }
  setEntranceProgress(A) {
    this.renderer?.setEntranceProgress(A);
  }
  setBackgroundRemovalEffect(A) {
    this.renderer?.setBackgroundRemovalEffect(A);
  }
  reappear() {
    this.renderer?.reappear();
  }
  setRenderScale(A) {
    this.renderer?.setRenderScale(A);
  }
  getRenderSnapshot() {
    return this.renderer ? (this.lastSnapshot = this.renderer.getRenderSnapshot(), this.lastSnapshot) : wt(this.lastSnapshot);
  }
  setRenderSnapshot(A) {
    this.renderer?.setRenderSnapshot(A);
  }
  getState() {
    return this.renderer ? (this.lastState = this.renderer.getState(), this.lastState) : rt(this.lastState);
  }
  destroy() {
    const A = this.renderer;
    if (A) {
      this.lastState = A.getState(), this.lastSnapshot = A.getRenderSnapshot();
      try {
        A.destroy();
      } finally {
        this.renderer = null;
      }
    }
  }
};
function nt(A) {
  return new st(A);
}
async function Dt(A, e = {}) {
  if (typeof document > "u") throw new Error("Sticker Forge can only be created in a browser.");
  const t = typeof A == "string" ? document.querySelector(A) : A;
  if (!t) throw new Error("Sticker Forge could not find its target element.");
  const i = new it(t, e);
  try {
    return await i.setSource(e.source ?? S), nt(i);
  } catch (r) {
    throw i.destroy(), r;
  }
}
var Pt = typeof HTMLElement > "u" ? class {
} : HTMLElement, XA = class extends Pt {
  constructor(...A) {
    super(...A), this.instance = null, this.instancePromise = null, this.mountElement = null, this.pendingOptions = {}, this.pendingSource = null, this.lifecycleRevision = 0;
  }
  static get observedAttributes() {
    return ["text"];
  }
  connectedCallback() {
    if (!this.shadowRoot) {
      const A = this.attachShadow({ mode: "open" }), e = document.createElement("style");
      e.textContent = `
        :host { display: block; min-width: 160px; min-height: 120px; }
        .mount { width: 100%; height: 100%; min-height: inherit; }
      `, this.mountElement = document.createElement("div"), this.mountElement.className = "mount", A.append(e, this.mountElement);
      for (const t of [
        "peelstart",
        "peelchange",
        "peelend",
        "detachcomplete",
        "cyclecomplete",
        "error"
      ]) this.mountElement.addEventListener(t, (i) => {
        this.dispatchEvent(new CustomEvent(t, {
          detail: i.detail,
          bubbles: !0,
          composed: !0
        }));
      });
    }
    this.pendingSource || (this.pendingSource = {
      ...S,
      text: this.getAttribute("text") || S.text
    }), this.ensureInstance().catch(() => {
    });
  }
  disconnectedCallback() {
    this.destroy();
  }
  attributeChangedCallback(A, e, t) {
    if (A === "text" && e !== t) {
      const i = {
        ...S,
        text: t || " "
      };
      this.pendingSource = i, this.isConnected && this.setSource(i).catch(() => {
      });
    }
  }
  async setSource(A) {
    this.pendingSource = A, await (await this.ensureInstance()).setSource(A);
  }
  async prepareSource(A, e) {
    return (await this.ensureInstance()).prepareSource(A, e);
  }
  setOptions(A) {
    this.pendingOptions = OA(this.pendingOptions, A), this.instance?.setOptions(A);
  }
  reset() {
    this.instance?.reset();
  }
  setPeelProgress(A, e) {
    this.instance?.setPeelProgress(A, e);
  }
  setEntranceProgress(A) {
    this.instance?.setEntranceProgress(A);
  }
  setBackgroundRemovalEffect(A) {
    this.instance?.setBackgroundRemovalEffect(A);
  }
  reappear() {
    this.instance?.reappear();
  }
  setRenderScale(A) {
    this.instance?.setRenderScale(A);
  }
  getRenderSnapshot() {
    return this.instance?.getRenderSnapshot() ?? {
      progress: 0,
      peelDepth: 0,
      peelRadius: 0,
      detachedTension: 0,
      origin: {
        x: 0,
        y: 0
      },
      direction: {
        x: 1,
        y: 0
      },
      position: {
        x: 0,
        y: 0
      },
      scale: {
        x: 1,
        y: 1
      },
      rotation: 0,
      entranceSweep: -1,
      entranceScaleProgress: -1,
      time: 0
    };
  }
  setRenderSnapshot(A) {
    this.instance?.setRenderSnapshot(A);
  }
  resize() {
    this.instance?.resize();
  }
  getState() {
    return this.instance?.getState() ?? {
      ready: !1,
      dragging: !1,
      progress: 0,
      grabPoint: null,
      pointer: null
    };
  }
  destroy() {
    this.lifecycleRevision += 1;
    const A = this.instancePromise;
    this.instance?.destroy(), this.instance = null, this.instancePromise = null, A && A.then((e) => {
      e.destroy();
    }).catch(() => {
    });
  }
  ensureInstance() {
    if (this.instance) return Promise.resolve(this.instance);
    if (this.instancePromise) return this.instancePromise;
    if (!this.mountElement) return Promise.reject(/* @__PURE__ */ new Error("The sticker element is not connected."));
    const A = OA(this.pendingOptions, { source: this.pendingSource ?? S }), e = this.lifecycleRevision, t = Dt(this.mountElement, A);
    return this.instancePromise = t, t.then((i) => {
      if (this.instancePromise === t && (this.instancePromise = null), e !== this.lifecycleRevision || !this.isConnected) {
        i.destroy();
        return;
      }
      this.instance = i, this.dispatchEvent(new CustomEvent("ready", {
        bubbles: !0,
        composed: !0
      }));
    }).catch((i) => {
      this.instancePromise === t && (this.instancePromise = null);
      const r = i instanceof Error ? i.message : "Sticker Forge could not initialize.";
      this.dispatchEvent(new CustomEvent("error", {
        detail: { message: r },
        bubbles: !0,
        composed: !0
      }));
    }), t;
  }
};
function at(A = "sticker-forge") {
  if (!(typeof customElements > "u") && !customElements.get(A)) {
    const e = A === "sticker-forge" ? XA : class extends XA {
    };
    customElements.define(A, e);
  }
}
at();
export {
  gt as STICKER_ENTRANCE_DURATION_MS,
  XA as StickerForgeElement,
  Dt as createSticker,
  at as defineStickerForge,
  Bt as imageSourceHasTransparency,
  ke as sanitizeSvgMarkup
};

//# sourceMappingURL=sticker-forge.es.js.map