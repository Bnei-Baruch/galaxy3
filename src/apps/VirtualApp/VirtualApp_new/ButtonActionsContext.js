import React, { createContext } from 'react';

export const ButtonActionsContext = createContext({
  micOn: false,
  cameraOn: false,
  audioModeOn: false,
  questionOn: false,

  handleMic: () => {
    localStorage.getItem('audio_mode');
  },
  handleCamera: () => {
    localStorage.getItem('audio_mode');
  },
  handleAudioMode: () => {
    localStorage.getItem('audio_mode');
  },
  handleLayout: () => {
    localStorage.getItem('audio_mode');
  },
  handleExitRoom: () => {
    localStorage.getItem('audio_mode');
  },
  handleQuestion: () => {
  }
});