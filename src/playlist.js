class Playlist {
    constructor(playlistId, currentIndex) {
        this.playlistId = playlistId;
        this.currentIndex = currentIndex;
    }

    get playlistId() {
        return this.playlistId;
    }

    get currentIndex() {
        return this.currentIndex;
    }
    
    playFirst(event, context) {
        this.currentIndex = 0;
        this.buildQueueResponse(event, context, 0, true);
    }
    
    playPrevious(event, context) {
        this.buildAudioPlayerResponse(event, context, -1, true);
    }
    
    playNext(event, context) {
        this.buildAudioPlayerResponse(event, context, 1, true);
    }

    queuePrevious(event, context) {
        this.buildAudioPlayerResponse(event, context, -1, false);
    }
    
    queueNext(event, context) {
        this.buildAudioPlayerResponse(event, context, 1, false);
    }
    
    buildAudioPlayerResponse(event, context, indexOffset, isPlayImmediately) {
        console.log("queue");
        this.getSongDownloadUrls()
            .then((urls) => {
                console.log(`>>>> playlistId: ${this.playlistId}`);
                console.log(`>>>> currentIndex: ${this.currentIndex}`);
                console.log(`>>>> urls: ${urls}`);
        
                if (urls[this.currentIndex + indexOffset]) {
                    this.currentIndex += indexOffset;
                    respond(
                        /*context:*/ context,
                        /*spokenMessage:*/ null,
                        /*cardMessage:*/ null,
                        /*audioUrl:*/ urls[this.currentIndex],
                        /*playBehavior:*/ isPlayImmediately ? "REPLACE_ALL"  : "ENQUEUE",
                        /*token:*/ this.getTokenJson(),
                        /*expectedPreviousToken:*/ event.context.AudioPlayer.token,
                        /*shouldEndSession:*/ true,
                        /*isStop:*/ false,
                        /*isClearQueue:*/ false);
                } else {
                    respond(
                        /*context:*/ context,
                        /*spokenMessage:*/ null,
                        /*cardMessage:*/ null,
                        /*audioUrl:*/ null,
                        /*playBehavior:*/ null,
                        /*token:*/ this.getTokenJson(),
                        /*expectedPreviousToken:*/ null,
                        /*shouldEndSession:*/ true,
                        /*isStop:*/ false,
                        /*isClearQueue:*/ false);
                }
            });
    }
    
    getSongDownloadUrls() {
        let songIds;
        let downloadUrls;
        // log-in to firebase
        console.log(`playlists/${this.playlistId}/songs`);
        return firebase.auth().signInWithEmailAndPassword(FIREBASE_USERNAME, FIREBASE_PASSWORD)
            // fetch songs in playlist
            .then(() => firebase.database().ref(`playlists/${this.playlistId}/songs`).once('value'))
            // extract songIds from songs in playlist
            // fetch all songs
            .then(snapshot => {
                var playlistSongs = snapshot.val();
                songIds = Object.keys(playlistSongs).map(playlistSongKey => playlistSongs[playlistSongKey].songId); 
                return firebase.database().ref('songs').once('value');
            // use songIds to extract downloadUrls from songs
            }).then(snapshot => {
                var songs = snapshot.val();
                downloadUrls = songIds.map(songId => songs[songId].downloadUrl);
                return firebase.auth().signOut();
            }).then(() => downloadUrls);
    }
    
    getTokenJson() {
        return JSON.stringify({
            playlistId: this.playlistId,
            currentIndex: this.currentIndex
        });
    }
}