console.log("Menu script loaded");

import { startGame } from './game.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log("Attaching menu event listeners");
  console.log("Exit button element:", document.getElementById('exitButton'));

  document.getElementById('exitButton').addEventListener('click', () => {
    console.log("Exit button clicked");
    console.log("Window close called");
    window.close();
  });

  document.getElementById('optionsButton').addEventListener('click', () => {
    console.log("Options button clicked");
    document.querySelector('.menu').style.display = 'none';
    document.querySelector('.options-menu').style.display = 'block';
  });

  document.getElementById('backButton').addEventListener('click', () => {
    console.log("Back button (options) clicked");
    document.querySelector('.options-menu').style.display = 'none';
    document.querySelector('.menu').style.display = 'block';
  });

  document.getElementById('startButton').addEventListener('click', () => {
    console.log("Start button clicked");
    document.querySelector('.menu').style.display = 'none';
    document.querySelector('.worlds-menu').style.display = 'block';
  });

  document.getElementById('createWorldButton').addEventListener('click', () => {
    console.log("Create World button clicked");
    document.querySelector('.worlds-menu').style.display = 'none';
    document.querySelector('.create-world-menu').style.display = 'block';
  });

  document.getElementById('backToMainButton').addEventListener('click', () => {
    console.log("Back to Main button clicked");
    document.querySelector('.worlds-menu').style.display = 'none';
    document.querySelector('.menu').style.display = 'block';
  });

  document.getElementById('backToWorldsButton').addEventListener('click', () => {
    console.log("Back to Worlds button clicked");
    document.querySelector('.create-world-menu').style.display = 'none';
    document.querySelector('.worlds-menu').style.display = 'block';
  });

  document.getElementById('startWorldButton').addEventListener('click', () => {
    console.log("Start World button clicked");
    const seed = Math.floor(Math.random() * 1000000);
    startGame(seed);
  });
});