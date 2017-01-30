(function MusicUploader() {
  'use strict';

  /** constants **/
  let FIREBASE_CONFIG = require('./config/firebase-config.json');
  const FIREBASE_PROJECT_ID = FIREBASE_CONFIG.PROJECT_ID;
  const FIREBASE_BUCKET_NAME = FIREBASE_CONFIG.BUCKET_NAME;
  const FIREBASE_CONFIG_CONFIG = FIREBASE_CONFIG.CONFIG;
  const FIREBASE_SERVICE_ACCOUNT_JSON_FILENAME = FIREBASE_CONFIG.SERVICE_ACCOUNT_JSON_FILENAME;
  const FIREBASE_USER = FIREBASE_CONFIG.USER;
  const SUPPORTED_FILE_TYPES = [ 'mp3', 'm4a' ];
  const MUSIC_DEST_ROOT_FOLDER = 'music';
  const DEFAULT_PLAYLIST = 'music';

  let musicSourceRootFolder = process.argv[2];

  /** module requires **/
  const firebase = require('firebase');
  const fs = require('fs');
  const gcs = require('@google-cloud/storage')({
    projectId: FIREBASE_PROJECT_ID,
    keyFilename: `./config/${FIREBASE_SERVICE_ACCOUNT_JSON_FILENAME}`
  });
  const id3Parser = require('id3-parser');
  const checksum = require('checksum');

  /** global variables **/
  let database, bucket;

  let uploadQueue = {
    numOfUploads: 0,
    numOfSongsAdded: 0,
    queueItems: []
  };

  function main() {

    initModules();

    signInUser().then(uploadMusic);

  }

  function initModules() {
    bucket = gcs.bucket(FIREBASE_BUCKET_NAME);

    firebase.initializeApp(FIREBASE_CONFIG_CONFIG);
    database = firebase.database();
  }

  function signInUser() {
    return firebase.auth()
      .signInWithEmailAndPassword(
        FIREBASE_USER.USERNAME,
        FIREBASE_USER.PASSWORD)
      .then(
        () => {
            logSuccess('signInUser', 'User signed in.');
        },
        error => {
          logError('signInUser', error.code, error.message);
        }
      );
  }

  function signOutUser() {
    firebase.auth().signOut().then(
      () => {
        logSuccess('signOutUser', 'User signed out.');
      },
      error => {
        logError('signOutUser', error.code, error.message);
      }
    );
  }

  function uploadMusic() {
    let rootChildren = fs.readdirSync(musicSourceRootFolder);
    rootChildren.sort();

    // split music source folder path into two halves by the last '/' or '\' character
    let parentDir = musicSourceRootFolder.match(/[^/\\\\]+$/);
    musicSourceRootFolder = musicSourceRootFolder.substr(0, musicSourceRootFolder.length - parentDir[0].length - 1);
    uploadQueue.queueItems.push({
      targetIndex: 0,
      itemNames: rootChildren,
      parentSubPath: parentDir[0],
      parentDirName: parentDir[0]
    });
    uploadItem(uploadQueue);
  }

  function uploadItem(uploadQueue) {
    let queueItem = uploadQueue.queueItems.length > 0 ? uploadQueue.queueItems[uploadQueue.queueItems.length - 1] : null;
    if (queueItem == null){
      logSuccess('uploadItem', `Songs uploaded: ${uploadQueue.numOfUploads}, Songs added to database: ${uploadQueue.numOfSongsAdded}`);
      uploadQueue.numOfUploads = 0;
      uploadQueue.numOfSongsAdded = 0;

      console.log('====== All Playlists ======');
      let playlistsRef = database.ref('playlists');
      playlistsRef.once('value')
        .then(playlistsDS => {
          playlistsDS.forEach(playlistDS => {
            console.log(playlistDS.val().displayName);
          });
          console.log('=========== end ===========');
        });

      return;
    }

    let targetIndex = queueItem.targetIndex;
    let itemNames = queueItem.itemNames;
    let parentSubPath = queueItem.parentSubPath;
    let parentLocalFullPath = `${musicSourceRootFolder}${parentSubPath ? '/'+parentSubPath : ''}`;
    let parentUploadFullPath = `${musicSourceRootFolder}${parentSubPath ? '/'+parentSubPath : ''}`;
    let parentDirName = queueItem.parentDirName;

    let uploadNextSiblingItem = (uploadQueue) => {
      if (uploadQueue.queueItems.length > 0) {
        let lastQueueItem = uploadQueue.queueItems[uploadQueue.queueItems.length - 1];
        lastQueueItem.targetIndex++;
      }
      uploadItem(uploadQueue);
    };
    let uploadFirstChildItem = (uploadQueue, targetItemSubPath, targetItemName) => {
      let targetItemLocalFullPath = `${musicSourceRootFolder}/${targetItemSubPath}`;
      let childrenItemNames = fs.readdirSync(targetItemLocalFullPath);
      uploadQueue.queueItems.push({
        targetIndex: 0,
        itemNames: childrenItemNames,
        parentSubPath: targetItemSubPath,
        parentDirName: targetItemName
      });
      uploadItem(uploadQueue);
    };
    let uploadNextParentSiblingItem = (uploadQueue) => {
      uploadQueue.queueItems.pop();
      uploadNextSiblingItem(uploadQueue);
    };

    if (targetIndex < itemNames.length) {

      let targetItemName = itemNames[targetIndex];
      let targetItemSubPath = `${parentSubPath ? parentSubPath+'/' : ''}${targetItemName}`;
      let targetItemLocalFullPath = `${parentLocalFullPath}/${targetItemName}`;
      let targetItemUploadFullPath = `${parentUploadFullPath}/${targetItemName}`;
      let stats = fs.statSync(targetItemLocalFullPath);

      if (stats.isFile()) {
        let isSupportedFileType = false;
        SUPPORTED_FILE_TYPES.forEach(type => {
          isSupportedFileType = isSupportedFileType || targetItemLocalFullPath.endsWith(`.${type}`);
        });

        if (isSupportedFileType) {
          console.log(`Processing ..... ${targetItemSubPath}`);

          // 1. Check if existing song has the same md5 hash in base64
          new Promise((resolve, reject) => {
            checksum.file(
              targetItemLocalFullPath,
              { algorithm: 'md5' },
              (err, md5HashInHex) => {
                var md5HashInBase64 = new Buffer(md5HashInHex, 'hex').toString('base64');
                let songId = encodeSongId(md5HashInBase64);
                database.ref(`songs/${songId}`).once('value')
                  .then(dataSnapshot => {
                    if (dataSnapshot.exists()) {
                      reject('Song already uploaded.');
                    }
                    else {
                      resolve();
                    }
                  });
              });
          })
          // 2. Upload song
          .then(() => {
            return new Promise((resolve, reject) => {
              bucket.upload(
                targetItemLocalFullPath,
                {
                  destination: targetItemUploadFullPath,
                  public: true
                },
                (err, file, apiResponse) => {
                  if (err) {
                    reject(err);
                  }
                  else {
                    uploadQueue.numOfUploads++;
                    resolve(file);
                  }
                });
            });
          })
          // 3. Parse out the ID3 tags from song file
          .then(file => {
            return id3Parser.parse(fs.readFileSync(targetItemLocalFullPath))
              .then(tags => Promise.resolve({
                tags: tags,
                file: file
              }));
          })
          // 4. Add song record to database
          .then(tagsAndFile => {
            let tags = tagsAndFile.tags;
            let file = tagsAndFile.file;
            return addSongToDatabase(
              targetItemUploadFullPath,
              file.metadata,
              tags,
              parentDirName)
              .then(() => {
                uploadQueue.numOfSongsAdded++;
              });
          }).catch(err => {
            logError('uploadItem', null, err);
          }).then(() => {
            uploadNextSiblingItem(uploadQueue);
          });
        } else {
          uploadNextSiblingItem(uploadQueue);
        }
      } else if (stats.isDirectory()) {
        uploadFirstChildItem(uploadQueue, targetItemSubPath, targetItemName);
      } else {
        uploadNextSiblingItem(uploadQueue);
      }
    } else {
      uploadNextParentSiblingItem(uploadQueue);
    }
  }

  function addSongToDatabase(songFilePath, fileMetadata, tags, playlistName) {
    console.log(`Adding to database ..... ${songFilePath}`);
    let albumName = tags.album;
    let albumArtist = tags.band != null && tags.band.length > 0 ? tags.band : tags.artist;
    let albumYear = tags.year;

    let songArtist = tags.artist;
    let songName = tags.title;

    let songId = encodeSongId(fileMetadata.md5Hash);
    let downloadUrl = fileMetadata.mediaLink;

    let albumsRef = database.ref('albums');
    let playlistsRef = database.ref('playlists');
    let songsRef = database.ref('songs');

    // 1. Get existing album reference or create new album reference if none exists by the name
    return albumsRef.orderByChild('name').equalTo(albumName).once('value')
      .then(matchingAlbumsDS => {
        if (matchingAlbumsDS.numChildren() <= 0) {
          return albumsRef.push(
            {
              artist: albumArtist,
              name: albumName,
              year: albumYear
            });
        } else {
          let matchingAlbums = matchingAlbumsDS.val();
          let albumId = Object.keys(matchingAlbums)[0];
          return albumsRef.child(albumId);
        }
      })
      // 2. Create song and link to album from step 1
      .then(albumRef => {
        return songsRef.child(`${songId}`).set(
          {
            songName: songName,
            artist: songArtist || albumArtist,
            album: albumRef.key,
            filePath: songFilePath,
            downloadUrl: downloadUrl
          })
          .then(() => {
            return albumsRef.child(`${albumRef.key}/songs`).orderByChild('order').limitToLast(1).once('value')
              .then(lastSongDS => {
                let lastSong = lastSongDS.val();
                let lastSongOrder = -1;
                if (lastSong != null) {
                  lastSongOrder = Number.parseInt(lastSong[Object.keys(lastSong)[0]].order);
                }
                return albumsRef.child(`${albumRef.key}/songs`).push({
                  songId: songId,
                  order: lastSongOrder + 1
                });
              });
          });
      })
      // 3. Get existing playlist reference or create new playlist reference if none exists by the name
      .then(() => {
        return playlistsRef.orderByChild('displayName').equalTo(playlistName).once('value')
          .then(matchingPlaylistsDS => {
            if (matchingPlaylistsDS.numChildren() <= 0) {
              return playlistsRef.push({
                displayName: playlistName
              });
            } else {
              let matchingPlaylists = matchingPlaylistsDS.val();
              let playlistId = Object.keys(matchingPlaylists)[0];
              return playlistsRef.child(playlistId);
            }
          });        
      })
      // 4. Add song to the end of the playlist from step 3
      .then(playlistRef => {
        return playlistsRef.child(`${playlistRef.key}/songs`).orderByChild('order').limitToLast(1).once('value')
          .then(lastSongDS => {
            let lastSong = lastSongDS.val();
            let lastSongOrder = -1;
            if (lastSong != null) {
              lastSongOrder = Number.parseInt(lastSong[Object.keys(lastSong)[0]].order);
            }
            return playlistsRef.child(`${playlistRef.key}/songs`).push({
              songId: songId,
              order: lastSongOrder + 1
            });
          });
      });
  }

  function encodeSongId(md5Hash) {
    return encodeURIComponent(md5Hash).replace(/\./g, '%2E');
  }

  function logSuccess(source, successMessage) {
    console.log(`[SUCCESS in '${source}'] ${successMessage}`);
  }

  function logError(source, errorCode, errorMessage) {
    console.log(`[ERROR in '${source}'] Code: ${errorCode} | Message: ${errorMessage}`);
  }

  return {
    main: main
  };

})().main();

