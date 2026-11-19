import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface SpatialBackdrop3DProps {
  isScraping: boolean;
  hotLeadCount: number;
  totalLeadCount: number;
  stageMode: 'ambient' | 'showcase';
  motionEnabled: boolean;
}

// Pre-allocated math helpers outside render loop (zero per-frame GC)
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _color = new THREE.Color();

interface OrbitNodeSeed {
  radius: number;
  angle: number;
  speed: number;
  yOffset: number;
  bobAmp: number;
  bobFreq: number;
  baseScale: number;
  spinSpeed: number;
  tintHex: number;
}

function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const SpatialBackdrop3D: React.FC<SpatialBackdrop3DProps> = ({
  isScraping,
  hotLeadCount,
  totalLeadCount,
  stageMode,
  motionEnabled,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  // Store live props in a ref so React updates never tear down the WebGL context
  const liveStateRef = useRef({
    isScraping,
    hotLeadCount,
    totalLeadCount,
    stageMode,
    motionEnabled,
  });

  useEffect(() => {
    liveStateRef.current = {
      isScraping,
      hotLeadCount,
      totalLeadCount,
      stageMode,
      motionEnabled,
    };
  }, [isScraping, hotLeadCount, totalLeadCount, stageMode, motionEnabled]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const isSoftwareGl = detectSoftwareGl();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    // Scene + horizon-matched exponential fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05070e');
    scene.fog = new THREE.FogExp2('#05070e', 0.045);

    // Procedural Studio Environment Map (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || window.innerWidth) /
        Math.max(1, container.clientHeight || window.innerHeight),
      0.1,
      100
    );
    camera.position.set(0, 1.4, 11.5);
    camera.lookAt(0, 0, 0);

    // 3-Point Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x0b1120, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.2);
    keyLight.position.set(6.5, 8.5, 7.0);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 28;
      keyLight.shadow.camera.left = -8;
      keyLight.shadow.camera.right = 8;
      keyLight.shadow.camera.top = 8;
      keyLight.shadow.camera.bottom = -8;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x2dd4bf, 1.85);
    rimLight.position.set(-7.5, 3.0, -6.0);
    scene.add(rimLight);

    const accentAmberLight = new THREE.PointLight(0xf59e0b, 14, 18, 2);
    accentAmberLight.position.set(4.5, -2.5, 3.5);
    scene.add(accentAmberLight);

    // --- Composite Multi-Part 3D Hero Assembly: Kinetic Lead Prism Core ---
    const heroGroup = new THREE.Group();
    scene.add(heroGroup);

    const disposables: Array<{ dispose: () => void }> = [];

    // Part 1: Faceted obsidian metallic core housing
    const coreGeo = new THREE.IcosahedronGeometry(1.15, 0);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      metalness: 0.92,
      roughness: 0.2,
      clearcoat: 0.85,
      clearcoatRoughness: 0.15,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.castShadow = !isSoftwareGl;
    coreMesh.receiveShadow = !isSoftwareGl;
    heroGroup.add(coreMesh);
    disposables.push(coreGeo, coreMat);

    // Part 2: Glowing inner kinetic energy crystal
    const innerGeo = new THREE.OctahedronGeometry(0.76, 0);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x0d9488,
      emissiveIntensity: 1.4,
      metalness: 0.3,
      roughness: 0.45,
      wireframe: false,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    heroGroup.add(innerMesh);
    disposables.push(innerGeo, innerMat);

    // Part 3: Structural wireframe cage surrounding core
    const cageGeo = new THREE.IcosahedronGeometry(1.48, 1);
    const cageMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x115e59,
      emissiveIntensity: 0.4,
      metalness: 0.65,
      roughness: 0.55,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    heroGroup.add(cageMesh);
    disposables.push(cageGeo, cageMat);

    // Part 4, 5, 6: Three nested machined gimbal rings with varied roughness/metalness
    const ring1Geo = new THREE.TorusGeometry(2.15, 0.045, 20, 96);
    const ring1Mat = new THREE.MeshPhysicalMaterial({
      color: 0x94a3b8,
      metalness: 0.95,
      roughness: 0.18,
      clearcoat: 0.6,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI * 0.32;
    heroGroup.add(ring1);
    disposables.push(ring1Geo, ring1Mat);

    const ring2Geo = new THREE.TorusGeometry(2.75, 0.032, 18, 112);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x78350f,
      emissiveIntensity: 0.25,
      metalness: 0.88,
      roughness: 0.44,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI * 0.25;
    ring2.rotation.x = -Math.PI * 0.2;
    heroGroup.add(ring2);
    disposables.push(ring2Geo, ring2Mat);

    const ring3Geo = new THREE.TorusGeometry(3.45, 0.022, 16, 128);
    const ring3Mat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x0f766e,
      emissiveIntensity: 0.5,
      metalness: 0.72,
      roughness: 0.35,
    });
    const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3.rotation.x = Math.PI * 0.48;
    heroGroup.add(ring3);
    disposables.push(ring3Geo, ring3Mat);

    // Part 7: Precision axis pins on gimbal ring 1 (4 mounted stabilizers)
    const pinGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.36, 12);
    const pinMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.22,
    });
    disposables.push(pinGeo, pinMat);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.set(Math.cos(a) * 2.15, Math.sin(a) * 2.15, 0);
      pin.rotation.z = a + Math.PI / 2;
      ring1.add(pin);
    }

    // Part 8: Instanced Orbital Prospect Nodes (48 faceted lead crystals)
    const NODE_COUNT = 48;
    const nodeGeo = new THREE.OctahedronGeometry(0.14, 0);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.78,
      roughness: 0.24,
      emissive: 0x0b1120,
      emissiveIntensity: 0.25,
    });
    const nodeInstanced = new THREE.InstancedMesh(nodeGeo, nodeMat, NODE_COUNT);
    nodeInstanced.frustumCulled = false;
    disposables.push(nodeGeo, nodeMat);

    const palette = [0x14b8a6, 0x2dd4bf, 0xf59e0b, 0xf43f5e, 0x38bdf8];
    const seeds: OrbitNodeSeed[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const t = i / NODE_COUNT;
      const tintHex = palette[i % palette.length];
      seeds.push({
        radius: 3.9 + (i % 7) * 0.62,
        angle: t * Math.PI * 2 + (i % 3) * 0.37,
        speed: (0.12 + (i % 5) * 0.045) * (i % 2 === 0 ? 1 : -0.75),
        yOffset: ((i % 9) - 4) * 0.42,
        bobAmp: 0.14 + (i % 4) * 0.06,
        bobFreq: 0.6 + (i % 5) * 0.22,
        baseScale: 0.72 + ((i * 17) % 10) * 0.07,
        spinSpeed: 0.6 + (i % 4) * 0.35,
        tintHex,
      });
      _color.setHex(tintHex);
      nodeInstanced.setColorAt(i, _color);
    }
    if (nodeInstanced.instanceColor) {
      nodeInstanced.instanceColor.needsUpdate = true;
    }
    scene.add(nodeInstanced);

    // Part 9: Grounded Architectural Horizon Coordinate Plane
    const gridGeo = new THREE.RingGeometry(4.2, 9.8, 64, 4);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      wireframe: true,
      transparent: true,
      opacity: 0.24,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const horizonGrid = new THREE.Mesh(gridGeo, gridMat);
    horizonGrid.rotation.x = -Math.PI / 2;
    horizonGrid.position.y = -3.6;
    scene.add(horizonGrid);
    disposables.push(gridGeo, gridMat);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer parallax state (damped smoothly inside render loop)
    const pointer = { targetX: 0, targetY: 0, curX: 0, curY: 0 };
    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      pointer.targetX = nx;
      pointer.targetY = ny;
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = Math.max(1, container.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let contextLost = false;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const handleContextRestored = () => {
      contextLost = false;
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    let simTime = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;

      const delta = Math.min(clock.getDelta(), 0.05);
      const state = liveStateRef.current;
      const activeMotion = state.motionEnabled && !prefersReduced;
      const speedMult = state.isScraping ? 3.2 : 1.0;

      if (activeMotion) {
        simTime += delta * speedMult;
      }

      // Smoothly damp pointer parallax and camera stage framing
      pointer.curX = THREE.MathUtils.damp(pointer.curX, pointer.targetX, 3.5, delta);
      pointer.curY = THREE.MathUtils.damp(pointer.curY, pointer.targetY, 3.5, delta);

      const targetCamX =
        state.stageMode === 'showcase'
          ? pointer.curX * 2.2
          : 2.4 + pointer.curX * 0.9;
      const targetCamY =
        state.stageMode === 'showcase'
          ? 0.9 - pointer.curY * 1.1
          : 1.4 - pointer.curY * 0.6;
      const targetCamZ = state.stageMode === 'showcase' ? 8.6 : 11.4;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 3.0, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 3.0, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 3.0, delta);
      camera.lookAt(0, 0, 0);

      // Animate Composite Hero Assembly
      const heroTargetX = state.stageMode === 'showcase' ? 0 : 2.3;
      heroGroup.position.x = THREE.MathUtils.damp(heroGroup.position.x, heroTargetX, 3.0, delta);
      heroGroup.position.y = Math.sin(simTime * 0.85) * 0.16;

      coreMesh.rotation.y = simTime * 0.34;
      coreMesh.rotation.x = simTime * 0.18;
      innerMesh.rotation.y = -simTime * 0.68;
      innerMesh.rotation.z = simTime * 0.42;
      cageMesh.rotation.y = -simTime * 0.22;
      cageMesh.rotation.x = Math.sin(simTime * 0.3) * 0.25;

      ring1.rotation.z = simTime * 0.45;
      ring1.rotation.y = simTime * 0.22;
      ring2.rotation.x = -Math.PI * 0.2 + simTime * 0.32;
      ring2.rotation.z = -simTime * 0.28;
      ring3.rotation.y = simTime * 0.18;
      ring3.rotation.z = simTime * 0.14;

      horizonGrid.rotation.z = simTime * 0.04;

      // Emissive intensity subtly responds to scraping or hot leads
      const targetEmissive = state.isScraping
        ? 2.2
        : state.hotLeadCount > 0
        ? 1.55
        : 1.15;
      innerMat.emissiveIntensity = THREE.MathUtils.damp(
        innerMat.emissiveIntensity,
        targetEmissive,
        4.0,
        delta
      );

      // Update Instanced Orbital Prospect Nodes
      for (let i = 0; i < NODE_COUNT; i++) {
        const s = seeds[i];
        const ang = s.angle + simTime * s.speed;
        const px = heroGroup.position.x + Math.cos(ang) * s.radius;
        const pz = Math.sin(ang) * s.radius;
        const py = s.yOffset + Math.sin(simTime * s.bobFreq + i) * s.bobAmp;

        _pos.set(px, py, pz);
        _euler.set(simTime * s.spinSpeed, ang, simTime * 0.4);
        _quat.setFromEuler(_euler);
        const pulse = s.baseScale * (1 + Math.sin(simTime * 1.4 + i) * 0.12);
        _scale.set(pulse, pulse, pulse);
        _mat4.compose(_pos, _quat, _scale);
        nodeInstanced.setMatrixAt(i, _mat4);
      }
      nodeInstanced.instanceMatrix.needsUpdate = true;

      if (!contextLost) {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);

      for (const item of disposables) {
        item.dispose();
      }
      envTarget.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {webglUnavailable ? (
        <div
          className="w-full h-full"
          style={{
            background:
              'radial-gradient(circle at 72% 38%, rgba(20, 184, 166, 0.18), transparent 45%), radial-gradient(circle at 24% 72%, rgba(245, 158, 11, 0.12), transparent 42%), #05070e',
          }}
        />
      ) : (
        <div ref={mountRef} className="w-full h-full" />
      )}
      {/* Subtle radial edge vignette so foreground typography keeps crisp contrast */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          opacity: stageMode === 'showcase' ? 0.25 : 0.72,
          background:
            'radial-gradient(circle at 65% 42%, rgba(5, 7, 14, 0.08) 0%, rgba(5, 7, 14, 0.72) 65%, rgba(5, 7, 14, 0.94) 100%)',
        }}
      />
    </div>
  );
};
