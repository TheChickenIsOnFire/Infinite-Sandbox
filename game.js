import * as THREE from './libs/three.module.min.js';

let scene, camera, renderer;

// Player dimensions and ground level (declare early to avoid ReferenceError)
const groundHeight = 0; // block ground level (terrain base)
const eyeHeight = 1.8; // approx 2 blocks tall

// Movement state
const keysPressed = {};
let velocityY = 0;
const moveSpeed = 0.5;
const jumpSpeed = 0.4; // slightly higher jump
const gravity = 0.02;  // reduced gravity for smoother fall

// Player velocity for smooth movement
const velocity = new THREE.Vector3(0, 0, 0);
const acceleration = 0.05;
const friction = 0.1;
const maxSpeed = 0.5;
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
  camera.position.set(0, 1.6, 0); // eye level 1.6 above ground, centered
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
    const playerChunkX = Math.floor(camera.position.x / (chunkSize * blockSize));
    const playerChunkZ = Math.floor(camera.position.z / (chunkSize * blockSize));
    const radius = 1; // generate 3x3 chunks around player
  
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const chunkX = playerChunkX + dx;
        const chunkZ = playerChunkZ + dz;
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
        scene.add(newBlock);

        // Save placed block
        const chunkX = Math.floor(newBlock.position.x / (chunkSize * blockSize));
        const chunkZ = Math.floor(newBlock.position.z / (chunkSize * blockSize));
        const chunkKey = `${chunkX},${chunkZ}`;
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
    console.log(`keydown: ${e.key.toLowerCase()}`);
    keysPressed[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', (e) => {
    console.log(`keyup: ${e.key.toLowerCase()}`);
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

function generateChunk(chunkX, chunkZ, material, seed) {
  const blockGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);

  const blocks = {};

  for (let x = 0; x < chunkSize; x++) {
    for (let z = 0; z < chunkSize; z++) {
      const height = Math.floor(Math.random() * 3) + 1; // Placeholder height variation
      for (let y = 0; y < height; y++) {
        const wx = (chunkX * chunkSize + x);
        const wy = y;
        const wz = (chunkZ * chunkSize + z);
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
      const cube = new THREE.Mesh(blockGeo, material);
      cube.position.set(wx * blockSize, wy * blockSize, wz * blockSize);
      cube.userData.chunkKey = `${chunkX},${chunkZ}`;
      scene.add(cube);
    }
  }
}

let lastFrameTime = performance.now();
let fps = 0;

let debugFrameCounter = 0;

function animate() {
  requestAnimationFrame(animate);

  debugFrameCounter++;
  if (debugFrameCounter % 10 === 0) {  // log every 10 frames
    console.groupCollapsed("Frame Debug");

    console.log(`Position: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);
    console.log(`Velocity: (${velocity.x.toFixed(2)}, ${velocityY.toFixed(2)}, ${velocity.z.toFixed(2)})`);
    console.log(`Jumping: ${isJumping}`);
    console.log(`Keys pressed:`, JSON.stringify(keysPressed));

    console.groupEnd();
  }

  // FPS counter update
  const now = performance.now();
  fps = 1000 / (now - lastFrameTime);
  lastFrameTime = now;
  const fpsCounter = document.getElementById('fpsCounter');
  if (fpsCounter) {
    fpsCounter.textContent = 'FPS: ' + fps.toFixed(1);
  }

  // Dynamically generate chunks around player every frame
  let playerChunkX = Math.floor(camera.position.x / (chunkSize * blockSize));
  let playerChunkZ = Math.floor(camera.position.z / (chunkSize * blockSize));

  // Generate nearby chunks
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const chunkX = playerChunkX + dx;
      const chunkZ = playerChunkZ + dz;
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
    const distX = Math.abs(chunkX - playerChunkX);
    const distZ = Math.abs(chunkZ - playerChunkZ);
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

  if (keysPressed['w'] || keysPressed['arrowup']) {
    velocity.x += forward.x * acceleration;
    velocity.z += forward.z * acceleration;
  }
  if (keysPressed['s'] || keysPressed['arrowdown']) {
    velocity.x -= forward.x * acceleration;
    velocity.z -= forward.z * acceleration;
  }
  if (keysPressed['a'] || keysPressed['arrowleft']) {
    velocity.x -= right.x * acceleration;
    velocity.z -= right.z * acceleration;
  }
  if (keysPressed['d'] || keysPressed['arrowright']) {
    velocity.x += right.x * acceleration;
    velocity.z += right.z * acceleration;
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

  // Predict new position
  const newPos = camera.position.clone();
  newPos.x += velocity.x;
  newPos.z += velocity.z;

  // Player bounding box size
  const playerWidth = 0.6;
  const playerHeight = 1.8;

  // Improved collision detection with tolerance and local filtering
  const tolerance = 0.05;
  let newX = newPos.x;
  let newZ = newPos.z;

  // Check X axis movement
  let collisionX = false;
  scene.traverse((obj) => {
    if (!obj.isMesh || obj.geometry.type !== 'BoxGeometry') return;
    const pos = obj.position;
    if (Math.abs(pos.x - newPos.x) > 2 || Math.abs(pos.z - camera.position.z) > 2) return; // skip far blocks

    const minX = pos.x - 0.5, maxX = pos.x + 0.5;
    const minY = pos.y - 0.5, maxY = pos.y + 0.5;
    const minZ = pos.z - 0.5, maxZ = pos.z + 0.5;

    const playerMinX = newX - playerWidth/2 - tolerance;
    const playerMaxX = newX + playerWidth/2 + tolerance;
    const playerMinY = camera.position.y - eyeHeight + 0.1; // offset to avoid ground sticking
    const playerMaxY = camera.position.y;
    const playerMinZ = camera.position.z - playerWidth/2;
    const playerMaxZ = camera.position.z + playerWidth/2;

    const overlapX = (playerMinX <= maxX) && (playerMaxX >= minX);
    const overlapY = (playerMinY <= maxY) && (playerMaxY >= minY);
    const overlapZ = (playerMinZ <= maxZ) && (playerMaxZ >= minZ);

    if (overlapX && overlapY && overlapZ) {
      console.warn(`X COLLISION with block at (${pos.x}, ${pos.y}, ${pos.z})`);
      collisionX = true;
    } else {
      console.log(`X no collision with block at (${pos.x}, ${pos.y}, ${pos.z})`);
    }
  });
  if (!collisionX) {
    camera.position.x = newX;
  }

  // Check Z axis movement
  let collisionZ = false;
  scene.traverse((obj) => {
    if (!obj.isMesh || obj.geometry.type !== 'BoxGeometry') return;
    const pos = obj.position;
    if (Math.abs(pos.x - camera.position.x) > 2 || Math.abs(pos.z - newPos.z) > 2) return; // skip far blocks

    const minX = pos.x - 0.5, maxX = pos.x + 0.5;
    const minY = pos.y - 0.5, maxY = pos.y + 0.5;
    const minZ = pos.z - 0.5, maxZ = pos.z + 0.5;

    const playerMinX = camera.position.x - playerWidth/2;
    const playerMaxX = camera.position.x + playerWidth/2;
    const playerMinY = camera.position.y - eyeHeight + 0.1; // offset to avoid ground sticking
    const playerMaxY = camera.position.y;
    const playerMinZ = newZ - playerWidth/2 - tolerance;
    const playerMaxZ = newZ + playerWidth/2 + tolerance;

    const overlapX = (playerMinX <= maxX) && (playerMaxX >= minX);
    const overlapY = (playerMinY <= maxY) && (playerMaxY >= minY);
    const overlapZ = (playerMinZ <= maxZ) && (playerMaxZ >= minZ);

    if (overlapX && overlapY && overlapZ) {
      console.warn(`Z COLLISION with block at (${pos.x}, ${pos.y}, ${pos.z})`);
      collisionZ = true;
    } else {
      console.log(`Z no collision with block at (${pos.x}, ${pos.y}, ${pos.z})`);
    }
  });
  if (!collisionZ) {
    camera.position.z = newZ;
  }

  // Jumping
  if ((keysPressed[' '] || keysPressed['space']) && !isJumping) {
    console.log("Jump initiated");
    velocityY = jumpSpeed;
    isJumping = true;
  }

  // Apply gravity
  velocityY -= gravity;
  camera.position.y += velocityY;

  // Ground collision
  if (camera.position.y <= groundHeight + eyeHeight) {
    if (isJumping) console.log("Landed on ground");
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