// "Music mode" for live music sent to the room (groups only):
// no echo cancellation / noise suppression / auto gain, stereo Opus up to 256 kbps.
let music = false;

export const isMusic = () => music;

export const setMusicEnabled = (enabled) => {
  music = !!enabled;
};
