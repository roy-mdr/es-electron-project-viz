// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
/*window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
	const element = document.getElementById(selector)
	if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
	replaceText(`${type}-version`, process.versions[type])
  }
})*/

console.log("from preload.js")

const {
	contextBridge,
	ipcRenderer
} = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
	"api", {
		send: (channel, data) => {
			// whitelist channels
			let validChannels = ["toMain_indexReady", "toMain_openDir"];
			if (validChannels.includes(channel)) {
				ipcRenderer.send(channel, data);
			}
		},
		receive: (channel, func) => {
			let validChannels = ["fromMain_toGraph", "fromMain_toPre"];
			if (validChannels.includes(channel)) {
				// Deliberately strip event as it includes `sender` 
				ipcRenderer.on(channel, (event, ...args) => func(...args));
			}
		}
	}
);