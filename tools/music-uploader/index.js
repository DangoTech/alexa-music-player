(function MusicUploader() {
	"use strict";

	/** constants **/
	let FIREBASE_CONFIG = require('../../_no_commit/firebase-config');
	const FIREBASE_PROJECT_ID = FIREBASE_CONFIG.PROJECT_ID;
	const FIREBASE_BUCKET_NAME = FIREBASE_CONFIG.BUCKET_NAME;	
	const FIREBASE_CONFIG_CONFIG = FIREBASE_CONFIG.CONFIG;
	const FIREBASE_SERVICE_ACCOUNT_JSON_FILENAME = FIREBASE_CONFIG.FIREBASE_SERVICE_ACCOUNT_JSON_FILENAME;
	const FIREBASE_USER = FIREBASE_CONFIG.USER;
	const SUPPORTED_FILE_TYPES = [ "mp3" ];
	const MUSIC_UPLOAD_ROOT_FOLDER = "music";
	
	/** module requires **/
	const firebase = require("firebase");
	const fs = require("fs");
	console.log(JSON.stringify(FIREBASE_CONFIG));
	const gcs = require("@google-cloud/storage")({
		projectId: FIREBASE_PROJECT_ID,
		keyFilename: `../../_no_commit/${FIREBASE_SERVICE_ACCOUNT_JSON_FILENAME}`
	});
	const id3Parser = require("id3-parser");
	
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
					logSuccess("signInUser", "User signed in.");
				},
				error => {
					logError("signInUser", error.code, error.message);
				}
			);
	}

	function signOutUser() {
		firebase.auth().signOut().then(
			() => {
				logSuccess("signOutUser", "User signed out.");
			},
			error => {
				logError("signOutUser", error.code, error.message);
			}
		);
	}
	
	function uploadMusic() {
		
		let rootChildren = fs.readdirSync(MUSIC_UPLOAD_ROOT_FOLDER);
		uploadQueue.queueItems.push({
			targetIndex: 0,
			itemNames: rootChildren,
			parentFullPath: MUSIC_UPLOAD_ROOT_FOLDER,
			parentDirName: MUSIC_UPLOAD_ROOT_FOLDER
		});		
		uploadItem(uploadQueue);
	}
	
	function uploadItem(uploadQueue) {
		let queueItem = uploadQueue.queueItems.length > 0 ? uploadQueue.queueItems[uploadQueue.queueItems.length - 1] : null;		
		if (queueItem == null){
			logSuccess("uploadItem", `Songs uploaded: ${uploadQueue.numOfUploads}, Songs added to database: ${uploadQueue.numOfSongsAdded}`);
			uploadQueue.numOfUploads = 0;
			uploadQueue.numOfSongsAdded = 0;
			return;
		}
		
		let targetIndex = queueItem.targetIndex;
		let itemNames = queueItem.itemNames;
		let parentFullPath = queueItem.parentFullPath;
		let parentDirName = queueItem.parentDirName;
		
		let uploadNextSiblingItem = (uploadQueue) => {
			if (uploadQueue.queueItems.length > 0) {
				let lastQueueItem = uploadQueue.queueItems[uploadQueue.queueItems.length - 1];
				lastQueueItem.targetIndex++;
			}
			uploadItem(uploadQueue);
		};
		let uploadFirstChildItem = (uploadQueue, targetItemFullPath, targetItemName) => {
			let childrenItemNames = fs.readdirSync(targetItemFullPath);
			uploadQueue.queueItems.push({
				targetIndex: 0,
				itemNames: childrenItemNames,
				parentFullPath: targetItemFullPath,
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
		
			let targetItemFullPath = `${parentFullPath}/${targetItemName}`;
			let stats = fs.statSync(targetItemFullPath);
			
			if (stats.isFile()) {
				let isSupportedFileType = false;
				SUPPORTED_FILE_TYPES.forEach(type => {
					isSupportedFileType = isSupportedFileType || targetItemFullPath.endsWith(`.${type}`);
				});
				
				if (isSupportedFileType) {
					console.log(`Uploading... ${targetItemFullPath}`);
					
					id3Parser.parse(fs.readFileSync(targetItemFullPath))
						.then(tags => {
							console.log("uploadddd");
							bucket.upload(
								targetItemFullPath,
								{
									destination: targetItemFullPath,
									public: true
								},
								(err, file, apiResponse) => {
									console.log("callback");
									if (!err) {
										uploadQueue.numOfUploads++;
										addSongToDatabase(targetItemFullPath, file.metadata, tags, parentDirName).then(() => {
											uploadQueue.numOfSongsAdded++;
											uploadNextSiblingItem(uploadQueue);
										});											
									}
									else {
										logError("uploadItem", null, err);
									}
								}
							);
						});
				} else {
					uploadNextSiblingItem(uploadQueue);
				}
			} else if (stats.isDirectory()) {
				uploadFirstChildItem(uploadQueue, targetItemFullPath, targetItemName);
			} else {
				uploadNextSiblingItem(uploadQueue);
			}
		} else {
			uploadNextParentSiblingItem(uploadQueue);
		}
	}
	
	function addSongToDatabase(songFilePath, fileMetadata, tags, playlistName) {
		console.log(`Adding to database... ${songFilePath}`);
		
		let playlistId = playlistName.toLowerCase();

		let albumName = tags.album;
		let albumArtist = tags.band;
		let albumYear = tags.year;
		let albumId = encodeURI(`${albumName} | ${albumArtist}`);
		
		let songArtist = tags.artist;		
		let songName = tags.title;
		
		let songId = fileMetadata.md5Hash;
		let downloadUrl = fileMetadata.mediaLink;

		return database.ref(`songs/${songId}`).set(
			{
				downloadUrl: downloadUrl
			}
		).then(() => {
			return database.ref(`songProperties/${songId}`).set(
				{
					album: albumId,
					artist: songArtist,
					filePath: songFilePath,
					songName: songName
				}
			);
		}).then(() => {
			return database.ref(`albums/${albumId}`).once("value");
		}).then(dataSnapshot => {
			if (!dataSnapshot.exists()) {
				return database.ref(`albums/${albumId}`).set(
					{
						artist: albumArtist,
						name: albumName,
						year: albumYear
					});
			}
		}).then(() => {
			return database.ref(`playlists/${playlistId}/songs`).orderByChild("order").limitToLast(1).once("value");
		}).then(dataSnapshot => {
			let lastSong = dataSnapshot.val();
			let lastSongOrder = -1;
			if (lastSong != null){
				lastSongOrder = Number.parseInt(lastSong[Object.keys(lastSong)[0]].order);
			}
			return database.ref(`playlists/${playlistId}/songs`).push({
				songId: songId,
				order: lastSongOrder + 1
			});
		}).then(() => {
			return database.ref(`playlists/${playlistId}/displayName`).set(playlistName);
		});
	}

	function logSuccess(source, successMessage) {
		console.log(`[SUCCESS in "${source}"] ${successMessage}`);
	}

	function logError(source, errorCode, errorMessage) {
		console.log(`[ERROR in "${source}"] Code: ${errorCode} | Message: ${errorMessage}`);
	}
	
	return {
		main: main
	}
	
})().main();

