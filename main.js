// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // nodeIntegration: true, // Now you can use nodejs on the preload file! (but you can't use ipc contextBridge communication)
      // contextIsolation: false, // Now you can use nodejs on the preload file! (but you can't use ipc contextBridge communication)
      nodeIntegration: false, // is default value after Electron v5
      contextIsolation: true, // protect against prototype pollution
      enableRemoteModule: false, // turn off remote
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

console.log("from main.js");




// ==================================================
// ==================================================



/*
const { resolve } = require('path');
const { readdir } = require('fs').promises;

async function* getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

(async () => {
  for await (const f of getFiles('Y:/')) {
    console.log(f);
  }
})()
*/

const fs = require('fs');
// let path = require('path');
var crypto = require('crypto');

let filesWalked = 0;

function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let i = 0;
    (function next() {
      let file = list[i++];
      if (!file) return done(null, results);
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        filesWalked++;
        console.log("files walked", filesWalked);
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            next();
          });
        } else {
          if (/\\origen\.json$/.test(file)) results.push(file); // Filter by Regex to add file to the list
          next();
        }
      });
    })();
  });
};




function readFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return data;
  } catch (err) {
    console.error(err);
    return false;
  }
}





let dirMap = {};
let etapaMap = new Map();
let origins = [];


function addToGraph(orig, dest, note = "") {

  /////////////// Map origin (first node... it does not have an origin... nor notes...)

  const origMD5 = crypto.createHash('md5').update(orig).digest('hex');

  const origSplit = orig.split('\\');
  const origEtapa   = origSplit[origSplit.length - 2];
  const origVersion = origSplit[origSplit.length - 1];
  const origAlias = `${origVersion}`/*.replace(/\(|\)|\[|\]|\{|\}|\\|\//g, "-")*/

  if ( !(origMD5 in dirMap) ) {
    // if this dir hasn't been processed

    dirMap[origMD5] = {
      id: origMD5,
      dir: orig,
      alias: origAlias,
      note: "Inicio",
      orig: false,
      is_leaf: true
    };
  }

  /////////////// Map destiny (real node... dir of the found file)

  const destMD5 = crypto.createHash('md5').update(dest).digest('hex');

  const destSplit   = dest.split('\\');
  const destEtapa   = destSplit[destSplit.length - 2];
  const destVersion = destSplit[destSplit.length - 1];
  const destAlias   = `${destEtapa} / ${destVersion}`/*.replace(/\(|\)|\[|\]|\{|\}|\\|\//g, "-")*/

  dirMap[destMD5] = {
    id: destMD5,
    dir: dest,
    alias: destAlias,
    note: note,
    etapa: destEtapa,
    version: destVersion,
    error: false,
    orig: origMD5,
    is_leaf: true,
    is_last_version: false
  };

  if ( origEtapa == destEtapa ) {
    dirMap[destMD5].error = true;
    dirMap[destMD5].alias += " [Wrong origin: Same Etapa]";
  }

  if ( !(/^\d\d [^ ].+$/.test(destEtapa)) ) {
    dirMap[destMD5].error = true;
    dirMap[destMD5].alias += " [Wrong format: Etapa]";
  }

  if ( /^V \d+\.\d+$/.test(destVersion) ) {
    dirMap[destMD5].version = parseFloat( destVersion.split(' ')[1] );
  } else {
    dirMap[destMD5].error = true;
    dirMap[destMD5].alias += " [Wrong format: Version]";
  }

  if (!dirMap[destMD5].error) {

    // Track last version of each etapa
    if (etapaMap.get(destEtapa) === undefined) {
      // If there was no track of this Etapa
      etapaMap.set(destEtapa, destMD5); // Set this Etapa as last version
    } else {

      if ( dirMap[destMD5].version > dirMap[ etapaMap.get(destEtapa) ].version) {
        // If this version is greater than the one saved
        etapaMap.set(destEtapa, destMD5); // Set this Etapa as last version
      }

      if ( (dirMap[destMD5].version == dirMap[ etapaMap.get(destEtapa) ].version) && (destMD5 !== etapaMap.get(destEtapa)) ) {
        // If the versions are the same but different graphNode...
        dirMap[destMD5].error = true;
        dirMap[destMD5].alias += " [Bad versioning: Two same versions of same Etapa]";
      }
      
    }
  }


  if ( !origins.includes(origMD5) ) origins.push(origMD5);

  if ( (origMD5 in dirMap) ) dirMap[origMD5].is_leaf = false;
  if ( origins.includes(destMD5) ) dirMap[destMD5].is_leaf = false;

}













ipcMain.on("toMain_indexReady", (event, args) => {

  walk('Y:/02 CLIENTES (EEX-CLI)/(2019-0002) AMEHOS/(2022-PIN-0081) AMPLIACION CENTRO LOGISTICO/', (err, results) => {
  // walk('C:\\Users\\Roy\\Desktop\\test', (err, results) => {
    if (err) throw err;
    console.log(results);

    mainWindow.webContents.send("fromMain_toPre", JSON.stringify(results, null, 2));

    for (let i = 0; i < results.length; i++) {
      const fRaw = readFile(results[i]).replaceAll('\\', '\\\\');
      const fParsed = JSON.parse(fRaw);
      addToGraph(fParsed.directorio, results[i].replace(/\\origen\.json$/, ""), fParsed.nota);

      if (i == results.length - 1) {
        // If last round...

        etapaMap.forEach( (value, key, map) => {
          dirMap[value].is_last_version = true;
        });

        console.log("graph", dirMap)
        mainWindow.webContents.send("fromMain_toGraph", JSON.stringify(dirMap));
      }
    }

  });
});



ipcMain.on("toMain_openDir", (event, args) => {

  const dir = args.replaceAll('\\', '\\\\');

  require('child_process').exec(`start "" "${dir}"`);

});
