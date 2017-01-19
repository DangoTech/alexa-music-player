module.exports = {
  REQUEST : {
    LAUNCH_REQUEST : 'LaunchRequest',
    INTENT_REQUEST : 'IntentRequest',
    SESSION_ENDED_REQUEST : 'SessionEndedRequest',
    AUDIOPLAYER_PLAYBACK_STARTED : 'AudioPlayer.PlaybackStarted',
    AUDIOPLAYER_PLAYBACK_NEARLY_FINISHED : 'AudioPlayer.PlaybackNearlyFinished',
    AUDIOPLAYER_PLAYBACK_FINISHED : 'AudioPlayer.PlaybackFinished',
    AUDIOPLAYER_PLAYBACK_STOPPED : 'AudioPlayer.PlaybackStopped',
    AUDIOPLAYER_PLAYBACK_FAILED : 'AudioPlayer.PlaybackFailed',
    SYSTEM_EXCEPTION_ENCOUNTERED : 'System.ExceptionEncountered'
  },
  RESPONSE : {
    TYPE : {
      AUDIOPLAYER_PLAY : 'AudioPlayer.Play',
      AUDIOPLAYER_STOP : 'AudioPlayer.Stop',
      AUDIOPLAYER_CLEARQUEUE : 'AudioPlayer.ClearQueue'
    },
    PLAY_BEHAVIOUR : {
      ENQUEUE : 'ENQUEUE',
      REPLACE_ALL : 'REPLACE_ALL'
    }
  }
};