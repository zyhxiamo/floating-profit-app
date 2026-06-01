const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("floatWindow", {
  setExpanded: (expanded) => ipcRenderer.invoke("window:set-expanded", expanded),
  getExpanded: () => ipcRenderer.invoke("window:get-expanded"),
  setUiScale: (scale) => ipcRenderer.invoke("window:set-ui-scale", scale),
  hide: () => ipcRenderer.invoke("window:hide"),
  onExpandedChange: (callback) => {
    ipcRenderer.on("window:expanded", (_event, expanded) => callback(expanded));
  }
});

contextBridge.exposeInMainWorld("marketData", {
  getIndexes: () => ipcRenderer.invoke("market:get-indexes"),
  getStocks: (codes) => ipcRenderer.invoke("market:get-stocks", codes)
});

contextBridge.exposeInMainWorld("appActions", {
  submitReview: (review) => ipcRenderer.invoke("app:submit-review", review)
});
