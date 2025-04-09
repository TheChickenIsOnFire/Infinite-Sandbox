import * as THREE from './libs/three.module.min.js';

let scene, camera, renderer;
let chunkSize = 16;
let blockSize = 1;
let chunks = {};

function init(seed) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 20, 20);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
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

  animate();
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
  renderer.render(scene, camera);
}

export function startGame(seed) {
  document.querySelector('.menu').style.display = 'none';
  document.querySelector('.options-menu').style.display = 'none';
  document.querySelector('.worlds-menu').style.display = 'none';
  document.querySelector('.create-world-menu').style.display = 'none';
  document.getElementById('gameContainer').style.display = 'block';

  init(seed);
}