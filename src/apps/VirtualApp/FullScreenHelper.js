export default class FullScreenHelper {
  constructor(el) {
    this.el = el;
  }

  isFullScreen = () => {
    return !!this.el && (this.el.ownerDocument.fullscreenElement
      || this.el.ownerDocument.mozFullScreenElemen
      || this.el.ownerDocument.webkitFullscreenElement);
  };

  toggle = () => {
    if (this.isFullScreen()) {
      if (this.el.ownerDocument.exitFullscreen) {
        this.el.ownerDocument.exitFullscreen();
      } else if (this.el.ownerDocument.webkitExitFullscreen) {
        this.el.ownerDocument.webkitExitFullscreen();
      } else if (this.el.ownerDocument.mozCancelFullScreen) {
        this.el.ownerDocument.mozCancelFullScreen();
      }
    } else {
      if (this.el.requestFullscreen) {
        this.el.requestFullscreen();
      } else if (this.el.webkitRequestFullscreen) {
        this.el.webkitRequestFullscreen();
      } else if (this.el.mozRequestFullScreen) {
        this.el.mozRequestFullScreen();
      } else if (this.video.webkitEnterFullscreen) {
        this.video.webkitEnterFullscreen();
      }
    }
  };
}
