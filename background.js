chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "closeWindow") {
    chrome.windows.getCurrent(window => {
      chrome.windows.remove(window.id);
    });
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL('sandbox.html'),
    type: 'popup',
    width: 1280,
    height: 720,
    left: 100,
    top: 100
  });
});