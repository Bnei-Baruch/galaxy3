export default class FullScreenHelper {
  constructor(el = document.body) {
    this.el    = el;
    this.owner = el.ownerDocument;
  }

  isFullScreen = () => {
    return !!this.el && (this.owner.fullscreenElement
      || this.owner.mozFullScreenElemen
      || this.owner.webkitFullscreenElement);
  };

  toggle = () => {
    if (this.isFullScreen()) {
      if (this.owner.exitFullscreen) {
        this.owner.exitFullscreen();
      } else if (this.el.webkitExitFullscreen) {
        this.owner.webkitExitFullscreen();
      } else if (this.el.mozCancelFullScreen) {
        this.owner.mozCancelFullScreen();
      }
    } else {
      if (this.el.requestFullscreen) {
        this.el.requestFullscreen();
      } else if (this.el.webkitRequestFullscreen) {
        this.el.webkitRequestFullscreen();
      } else if (this.el.mozRequestFullScreen) {
        this.el.mozRequestFullScreen();
      } else if (this.el.webkitEnterFullscreen) {
        this.el.webkitEnterFullscreen();
      }
    }
  };
}
