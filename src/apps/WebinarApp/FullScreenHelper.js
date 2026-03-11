export const isFullScreen = (el = document.body) => {
  const owner = el.ownerDocument;
  return (
    el && (owner.fullscreenElement === el || owner.mozFullScreenElemen === el || owner.webkitFullscreenElement === el)
  );
};

export const toggleFullScreen = (el = document.body) => {
  const owner = el.ownerDocument;
  const isFull = isFullScreen(el);
  if (isFull) {
    if (owner.exitFullscreen) {
      owner.exitFullscreen();
    } else if (el.webkitExitFullscreen) {
      owner.webkitExitFullscreen();
    } else if (el.mozCancelFullScreen) {
      owner.mozCancelFullScreen();
    }
  } else {
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
    } else if (el.webkitEnterFullscreen) {
      el.webkitEnterFullscreen();
    }
  }
  return !isFull;
};
