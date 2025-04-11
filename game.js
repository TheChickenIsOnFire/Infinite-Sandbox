import * as THREE from './libs/three.module.min.js';
import * as BufferGeometryUtils from './libs/BufferGeometryUtils.js';

let scene, camera, renderer;

// Player dimensions and ground level (declare early to avoid ReferenceError)
const groundHeight = 0; // block ground level (terrain base)
const eyeHeight = 1.8; // approx 2 blocks tall

// Movement state
const keysPressed = {};
let velocityY = 0;
const moveSpeed = 0.5;
const jumpSpeed = 0.25; // lower jump height, clear 1 block
const gravity = 0.02;  // reduced gravity for smoother fall

// Player velocity for smooth movement
const velocity = new THREE.Vector3(0, 0, 0);
const acceleration = 0.05;
const friction = 0.1;
const maxSpeed = 0.3; // slower overall movement speed
let isJumping = false;

// Mouse look state
let yaw = 0;
let pitch = 0;
const pitchLimit = Math.PI / 2 - 0.1; // prevent flipping
let chunkSize = 16;
let blockSize = 1;
let chunks = {};

// Persistent placed blocks storage
const placedBlocks = {};

// Chunk generation resources
const textureLoader = new THREE.TextureLoader();
const blockTexture = textureLoader.load('assets/textures/blocks/block.png');
blockTexture.magFilter = THREE.NearestFilter;
blockTexture.minFilter = THREE.NearestMipMapNearestFilter;
const blockMaterial = new THREE.MeshLambertMaterial({ map: blockTexture });
const radius = 1; // generate 3x3 chunks around player
const maxRadius = 2; // max chunks to keep loaded

function init(seed) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 0); // spawn above terrain height to avoid collisions
  yaw = 0;
  pitch = 0;

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  document.getElementById('gameContainer').appendChild(renderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 20, 10);
  scene.add(light);

  const ambient = new THREE.AmbientLight(0x404040);
  scene.add(ambient);

  const textureLoader = new THREE.TextureLoader();
  const blockTexture = textureLoader.load('assets/textures/blocks/block.png');
  blockTexture.magFilter = THREE.NearestFilter;
  blockTexture.minFilter = THREE.NearestMipMapNearestFilter;

  const blockMaterial = new THREE.MeshLambertMaterial({ map: blockTexture });

  function generateChunksAroundPlayer(material, seed) {
    const genChunkX = Math.floor(camera.position.x / (chunkSize * blockSize));
    const genChunkZ = Math.floor(camera.position.z / (chunkSize * blockSize));
    const radius = 1; // generate 3x3 chunks around player
  
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const chunkX = currentPlayerChunkX + dx;
        const chunkZ = currentPlayerChunkZ + dz;
        const key = `${chunkX},${chunkZ}`;
        if (!chunks[key]) {
          generateChunk(chunkX, chunkZ, material, seed);
          chunks[key] = true;
        }
      }
    }
  }
  
  generateChunksAroundPlayer(blockMaterial, seed);
  
  // Raycaster for block interaction
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  // Handle mouse clicks for breaking/placing blocks
  window.addEventListener('mousedown', (event) => {
    // Only if pointer is locked
    if (document.pointerLockElement !== renderer.domElement) return;
  
    raycaster.setFromCamera({ x: 0, y: 0 }, camera); // center of screen
  
    const intersects = raycaster.intersectObjects(scene.children, false);
  
    if (intersects.length > 0) {
      const intersect = intersects[0];
  
      if (event.button === 0) {
        // Left click: remove block
        if (intersect.object !== undefined && intersect.object.geometry.type === 'BoxGeometry') {
          scene.remove(intersect.object);

          // Remove from placed blocks if exists
          const pos = intersect.object.position;
          const chunkX = Math.floor(pos.x / (chunkSize * blockSize));
          const chunkZ = Math.floor(pos.z / (chunkSize * blockSize));
          const chunkKey = `${chunkX},${chunkZ}`;
          if (placedBlocks[chunkKey]) {
            placedBlocks[chunkKey].delete(`${pos.x},${pos.y},${pos.z}`);
          }
        }
      } else if (event.button === 2) {
        // Right click: place block
        const normal = intersect.face.normal.clone();
        const position = intersect.point.clone().add(normal.multiplyScalar(0.5));
        position.x = Math.round(position.x);
        position.y = Math.round(position.y);
        position.z = Math.round(position.z);
  
        const newBlock = new THREE.Mesh(
          new THREE.BoxGeometry(1,1,1),
          intersect.object.material
        );
        newBlock.position.copy(position);
        const chunkX = Math.floor(newBlock.position.x / (chunkSize * blockSize));
        const chunkZ = Math.floor(newBlock.position.z / (chunkSize * blockSize));
        const chunkKey = `${chunkX},${chunkZ}`;

        newBlock.userData.chunkKey = chunkKey; // tag with chunk key
        scene.add(newBlock);

        // Save placed block
        if (!placedBlocks[chunkKey]) placedBlocks[chunkKey] = new Set();
        placedBlocks[chunkKey].add(`${newBlock.position.x},${newBlock.position.y},${newBlock.position.z}`);
      }
    }
  });
  
  // Prevent context menu on right click
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('resize', onWindowResize);

  // Movement key listeners
  window.addEventListener('keydown', (e) => {
    keysPressed[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', (e) => {
    keysPressed[e.key.toLowerCase()] = false;
  });

  // Pointer lock for mouse look
  renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === renderer.domElement) {
      document.addEventListener('mousemove', onMouseMove, false);
    } else {
      document.removeEventListener('mousemove', onMouseMove, false);
    }
  });

  animate();
}

function onMouseMove(event) {
  const sensitivity = 0.002;
  yaw -= event.movementX * sensitivity;
  pitch -= event.movementY * sensitivity;

  // Clamp pitch
  pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
}

function perlin2d(x, y) {
  // Simple pseudo-Perlin noise using Math.sin/cos (placeholder for real noise)
  return (
    Math.sin(x * 0.1) * Math.cos(y * 0.1) +
    0.5 * Math.sin(x * 0.2 + 100) * Math.cos(y * 0.2 + 100)
  ) * 0.5 + 0.5; // normalize to 0..1
}

function fractalNoise2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;  // Used for normalization

  for (let i = 0; i < octaves; i++) {
    total += perlin2d(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;

    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return total / maxValue;  // Normalize to 0..1
}

function caveNoise3D(x, y, z, octaves = 3, persistence = 0.5, lacunarity = 2.0) {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    // Use the existing 2D noise as a pseudo-3D noise by combining axes
    const noiseVal = perlin2d(x * frequency + i * 100, y * frequency + i * 200) *
                     perlin2d(y * frequency + i * 300, z * frequency + i * 400) *
                     perlin2d(z * frequency + i * 500, x * frequency + i * 600);
    total += noiseVal * amplitude;
    maxValue += amplitude;

    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return total / maxValue;  // Normalize to 0..1
}

function generateChunk(chunkX, chunkZ, material, seed) {
  const blockGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);

  const blocks = {};

  for (let x = 0; x < chunkSize; x++) {
    for (let z = 0; z < chunkSize; z++) {
      // Generate smooth terrain height using noise
      const worldX = chunkX * chunkSize + x;
      const worldZ = chunkZ * chunkSize + z;

      let noiseVal = fractalNoise2D(worldX * 0.05, worldZ * 0.05, 5, 0.5, 2.0);

      // Terrain feature thresholds
      const plainsThreshold = 0.4;
      const hillsThreshold = 0.6;
      const mountainsThreshold = 0.8;

      let height;
      const sharp = (val, power = 0.5) => Math.pow(val, power);

      if (noiseVal < plainsThreshold) {
        const t = noiseVal / plainsThreshold;
        height = 2 + sharp(t) * 2;  // 2-4 blocks high, mostly flat
      } else if (noiseVal < hillsThreshold) {
        const t = (noiseVal - plainsThreshold) / (hillsThreshold - plainsThreshold);
        height = 4 + sharp(t) * 10;  // 4-14 blocks, sharper hills
      } else if (noiseVal < mountainsThreshold) {
        const t = (noiseVal - hillsThreshold) / (mountainsThreshold - hillsThreshold);
        height = 14 + sharp(t) * 16;  // 14-30 blocks, steep cliffs
      } else {
        const t = (noiseVal - mountainsThreshold) / (1 - mountainsThreshold);
        height = 30 + sharp(t) * 30;  // 30-60 blocks, towering mountains
      }

      height = Math.floor(height);

      const maxChunkHeight = 64;  // or desired max vertical size of chunk

      for (let y = 0; y < maxChunkHeight; y++) {
        const wx = (chunkX * chunkSize + x);
        const wy = y;
        const wz = (chunkZ * chunkSize + z);

        // Carve out air above terrain height
        if (y >= height) {
          continue; // leave air above terrain surface
        }

        // Cave generation: skip blocks inside caves
        const caveVal = caveNoise3D(wx * 0.1, wy * 0.1, wz * 0.1, 3, 0.5, 2.0);
        const caveThreshold = 0.6;
        if (caveVal > caveThreshold && y < height - 2) {  // caves mostly underground
          continue; // carve cave
        }

        // Clear spawn area: 3x3x3 cube centered at (0,0,0)
        if (
          wx >= -1 && wx <= 1 &&
          wy >= 0 && wy <= 3 &&
          wz >= -1 && wz <= 1
        ) {
          continue; // skip block creation in spawn area
        }

        blocks[`${wx},${wy},${wz}`] = true;
      }
    }
  }

  // Add persistent placed blocks for this chunk
  const chunkKey = `${chunkX},${chunkZ}`;
  if (placedBlocks[chunkKey]) {
    for (const posKey of placedBlocks[chunkKey]) {
      const [wx, wy, wz] = posKey.split(',').map(Number);
      blocks[`${wx},${wy},${wz}`] = true;
    }
  }

  const geometries = [];

  for (const key in blocks) {
    const [wx, wy, wz] = key.split(',').map(Number);

    // Check neighbors
    const neighbors = [
      [1,0,0], [-1,0,0],
      [0,1,0], [0,-1,0],
      [0,0,1], [0,0,-1]
    ];

    let exposed = false;
    for (const [dx, dy, dz] of neighbors) {
      const neighborKey = `${wx+dx},${wy+dy},${wz+dz}`;
      if (!blocks[neighborKey]) {
        exposed = true;
        break;
      }
    }

    if (exposed) {
      const cubeGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
      cubeGeo.translate(wx * blockSize, wy * blockSize, wz * blockSize);
      geometries.push(cubeGeo);
    }
  }

  const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries, false);
  const chunkMesh = new THREE.Mesh(mergedGeometry, material);
  chunkMesh.userData.chunkKey = `${chunkX},${chunkZ}`;
  scene.add(chunkMesh);
}

let lastFrameTime = performance.now();
let fps = 0;

let debugFrameCounter = 0;

function animate() {
  requestAnimationFrame(animate);

  // FPS counter update
  const now = performance.now();
  fps = 1000 / (now - lastFrameTime);
  lastFrameTime = now;
  const fpsCounter = document.getElementById('fpsCounter');
  if (fpsCounter) {
    fpsCounter.textContent = 'FPS: ' + fps.toFixed(1);
  }

  // Dynamically generate chunks around player every frame
  const animCX = Math.floor(camera.position.x / (chunkSize * blockSize));
  const animCZ = Math.floor(camera.position.z / (chunkSize * blockSize));

  // Generate nearby chunks
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const chunkX = genChunkX + dx;
      const chunkZ = genChunkZ + dz;
      const key = `${chunkX},${chunkZ}`;
      if (!chunks[key]) {
        generateChunk(chunkX, chunkZ, blockMaterial, 0);
        chunks[key] = true;
      }
    }
  }

  // Unload distant chunks
  for (const key in chunks) {
    const [chunkX, chunkZ] = key.split(',').map(Number);
    const distX = Math.abs(chunkX - currentPlayerChunkX);
    const distZ = Math.abs(chunkZ - currentPlayerChunkZ);
    if (distX > maxRadius || distZ > maxRadius) {
      // Remove blocks in this chunk
      scene.children = scene.children.filter(obj => {
        if (!obj.userData.chunkKey) return true;
        return obj.userData.chunkKey !== key;
      });
      delete chunks[key];
    }
  }

  // Dynamically generate chunks around player every frame

  // Calculate forward and right vectors from yaw
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(-forward.z, 0, forward.x);

  const moveDir = new THREE.Vector3();

  // Air control factor
  let airControl = 1;
  if (!isJumping && velocityY === 0) {
    airControl = 1; // grounded
  } else {
    airControl = 0.3; // reduce control in air
  }

  if (keysPressed['w'] || keysPressed['arrowup']) {
    velocity.x += forward.x * acceleration * airControl;
    velocity.z += forward.z * acceleration * airControl;
  }
  if (keysPressed['s'] || keysPressed['arrowdown']) {
    velocity.x -= forward.x * acceleration * airControl;
    velocity.z -= forward.z * acceleration * airControl;
  }
  if (keysPressed['a'] || keysPressed['arrowleft']) {
    velocity.x -= right.x * acceleration * airControl;
    velocity.z -= right.z * acceleration * airControl;
  }
  if (keysPressed['d'] || keysPressed['arrowright']) {
    velocity.x += right.x * acceleration * airControl;
    velocity.z += right.z * acceleration * airControl;
  }

  // Apply friction
  velocity.x *= (1 - friction);
  velocity.z *= (1 - friction);

  // Clamp speed
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
  if (speed > maxSpeed) {
    velocity.x = (velocity.x / speed) * maxSpeed;
    velocity.z = (velocity.z / speed) * maxSpeed;
  }

  // Unified collision detection system
  const playerAABB = new THREE.Box3(
    new THREE.Vector3(
      camera.position.x - playerWidth/2,
      camera.position.y - eyeHeight,
      camera.position.z - playerWidth/2
    ),
    new THREE.Vector3(
      camera.position.x + playerWidth/2,
      camera.position.y,
      camera.position.z + playerWidth/2
    )
  );

  // Apply gravity before movement
  velocityY -= gravity;
  newPos.y += velocityY;

  // Get nearby blocks using chunk coordinates
  const nearbyBlocks = [];
  const animChunkX = Math.floor(camera.position.x / (chunkSize * blockSize));
  const animChunkZ = Math.floor(camera.position.z / (chunkSize * blockSize));
  
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const chunkKey = `${collisionChunkX + dx},${collisionChunkZ + dz}`;
      scene.children.forEach(obj => {
        if (obj.userData.chunkKey === chunkKey && obj.geometry?.type === 'BoxGeometry') {
          nearbyBlocks.push(obj);
        }
      });
    }
  }

  // Sweep test for movement
  const sweepAABB = playerAABB.clone().translate(
    new THREE.Vector3(velocity.x, velocityY, velocity.z)
  );

  let collisionNormal = new THREE.Vector3();
  let shortestTime = 1;

  nearbyBlocks.forEach(block => {
    const blockAABB = new THREE.Box3().setFromObject(block);
    const [collided, normal, time] = sweepAABB.intersectBox(blockAABB);
    
    if (collided && time < shortestTime) {
      shortestTime = time;
      collisionNormal.copy(normal);
    }
  });

  // Apply movement with collision response
  if (shortestTime < 1) {
    velocity.multiplyScalar(shortestTime);
    velocityY *= shortestTime;

    // Bounce off normal (with friction)
    const bounceFactor = 0.2;
    const vel = new THREE.Vector3(velocity.x, velocityY, velocity.z);
    vel.add(collisionNormal.multiplyScalar(-2 * vel.dot(collisionNormal) * bounceFactor));
    velocity.set(vel.x, vel.y, vel.z);

    // Ground detection
    if (collisionNormal.y > 0.5) {
      isJumping = false;
      velocityY = 0;
    }
  }

  // Update final position
  camera.position.add(velocity);
  camera.position.y += velocityY;

  // Keep player above ground
  if (camera.position.y < groundHeight + eyeHeight) {
    camera.position.y = groundHeight + eyeHeight;
    velocityY = 0;
    isJumping = false;
  }

  if (!collisionZ) {
    camera.position.z = newZ;
  }

  // Jumping
  if ((keysPressed[' '] || keysPressed['space']) && !isJumping) {
    velocityY = jumpSpeed;
    isJumping = true;
  }

  // Apply gravity
  velocityY -= gravity;
  camera.position.y += velocityY;

  // Ground collision
  // Check for blocks directly below player to stop falling
  let grounded = false;
  scene.traverse((obj) => {
    if (!obj.isMesh || obj.geometry.type !== 'BoxGeometry') return;
    const pos = obj.position;

    // Ignore blocks far away horizontally
    if (Math.abs(pos.x - camera.position.x) > 0.5) return;
    if (Math.abs(pos.z - camera.position.z) > 0.5) return;

    const blockTop = pos.y + 0.5;
    const playerFeet = camera.position.y - eyeHeight;

    // If block is just below feet within small margin
    if (playerFeet >= blockTop - 0.1 && playerFeet <= blockTop + 0.2) {
      grounded = true;
      camera.position.y = blockTop + eyeHeight;
      velocityY = 0;
      isJumping = false;
    }
  });

  // If below initial ground level, stop falling there as fallback
  if (!grounded && camera.position.y <= groundHeight + eyeHeight) {
    camera.position.y = groundHeight + eyeHeight;
    velocityY = 0;
    isJumping = false;
  }

  // Update camera rotation
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function startGame(seed) {
  document.querySelector('.menu').style.display = 'none';
  document.querySelector('.options-menu').style.display = 'none';
  document.querySelector('.worlds-menu').style.display = 'none';
  document.querySelector('.create-world-menu').style.display = 'none';
  document.getElementById('gameContainer').style.display = 'block';

  init(seed);
}