import React, { createContext } from 'react';

export const AudioModeContext = createContext({
  isAudioMode: false,
  updateAudioMode: () => {
    localStorage.getItem('audio_mode');
  }
});