import * as THREE from './libs/three.module.min.js';

let scene, camera, renderer;

// Movement state
const keysPressed = {};
let velocityY = 0;
const moveSpeed = 0.5;
const jumpSpeed = 1.0;
const gravity = 0.05;
let isJumping = false;

// Mouse look state
let yaw = 0;
let pitch = 0;
const pitchLimit = Math.PI / 2 - 0.1; // prevent flipping
let chunkSize = 16;
let blockSize = 1;
let chunks = {};

function init(seed) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 21.6, 20); // eye level 1.6 above ground
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

  generateChunk(0, 0, blockMaterial, seed);

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

function generateChunk(chunkX, chunkZ, material, seed) {
  const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);

  for (let x = 0; x < chunkSize; x++) {
    for (let z = 0; z < chunkSize; z++) {
      const height = Math.floor(Math.random() * 3) + 1; // Placeholder height variation
      for (let y = 0; y < height; y++) {
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(
          (chunkX * chunkSize + x) * blockSize,
          y * blockSize,
          (chunkZ * chunkSize + z) * blockSize
        );
        scene.add(cube);
      }
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  // Calculate forward and right vectors from yaw
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(-forward.z, 0, forward.x);

  const moveDir = new THREE.Vector3();

  if (keysPressed['w'] || keysPressed['arrowup']) {
    moveDir.add(forward);
  }
  if (keysPressed['s'] || keysPressed['arrowdown']) {
    moveDir.sub(forward);
  }
  if (keysPressed['a'] || keysPressed['arrowleft']) {
    moveDir.sub(right);
  }
  if (keysPressed['d'] || keysPressed['arrowright']) {
    moveDir.add(right);
  }

  moveDir.normalize();

  // Move camera horizontally
  camera.position.x += moveDir.x * moveSpeed;
  camera.position.z += moveDir.z * moveSpeed;

  // Jumping
  if ((keysPressed[' '] || keysPressed['space']) && !isJumping) {
    velocityY = jumpSpeed;
    isJumping = true;
  }

  // Apply gravity
  velocityY -= gravity;
  camera.position.y += velocityY;

  // Ground collision
  const groundHeight = 20; // block ground level
  const eyeHeight = 1.6;
  if (camera.position.y <= groundHeight + eyeHeight) {
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