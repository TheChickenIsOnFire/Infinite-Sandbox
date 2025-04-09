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