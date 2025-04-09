document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('openSandbox').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('sandbox.html') });
  });

  document.getElementById('options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('exit').addEventListener('click', () => {
    window.close();
  });
});