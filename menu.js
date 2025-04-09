import { startGame } from './game.js';

document.getElementById('exitButton').addEventListener('click', () => {
  window.close();
});

document.getElementById('optionsButton').addEventListener('click', () => {
  document.querySelector('.menu').style.display = 'none';
  document.querySelector('.options-menu').style.display = 'block';
});

document.getElementById('backButton').addEventListener('click', () => {
  document.querySelector('.options-menu').style.display = 'none';
  document.querySelector('.menu').style.display = 'block';
});

document.getElementById('startButton').addEventListener('click', () => {
  document.querySelector('.menu').style.display = 'none';
  document.querySelector('.worlds-menu').style.display = 'block';
});

document.getElementById('createWorldButton').addEventListener('click', () => {
  document.querySelector('.worlds-menu').style.display = 'none';
  document.querySelector('.create-world-menu').style.display = 'block';
});

document.getElementById('backToMainButton').addEventListener('click', () => {
  document.querySelector('.worlds-menu').style.display = 'none';
  document.querySelector('.menu').style.display = 'block';
});

document.getElementById('backToWorldsButton').addEventListener('click', () => {
  document.querySelector('.create-world-menu').style.display = 'none';
  document.querySelector('.worlds-menu').style.display = 'block';
});

document.getElementById('startWorldButton').addEventListener('click', () => {
  const seed = Math.floor(Math.random() * 1000000);
  startGame(seed);
});