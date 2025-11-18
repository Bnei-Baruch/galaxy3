import React, {Component} from "react";
import classNames from "classnames";
import NewWindow from "@hinaser/react-new-window";
import {isFullScreen, toggleFullScreen} from "../FullScreenHelper";
import {Icon} from "semantic-ui-react";
import {Close} from "@mui/icons-material";
import IconButton from "@mui/material/IconButton";
import JanusStream from "../../../shared/streaming-utils";

class QuadStream extends Component {
  constructor(props) {
    super(props);
    this.state = {
      fullScreen: false,
      stream: null,
      showControls: true,
    };

    this.handleFullScreenChange = this.handleFullScreenChange.bind(this);
    this.handleUserActivity = this.handleUserActivity.bind(this);
    this.handleFullScreen = this.handleFullScreen.bind(this);
  }

  hideControlsTimer = null;

  componentDidMount() {
    if (!this.state.stream) JanusStream.initQuadStream((stream) => this.setState({stream}));
    // Start hide timer on mount
    this.showControlsTemporarily();
  }

  componentWillUnmount() {
    this.clearHideTimer();
    if (this.videoWrapper) {
      JanusStream.toggle("quad");
      const doc = this.videoWrapper.ownerDocument;
      const win = doc.defaultView;
      win.removeEventListener("resize", this.handleFullScreenChange);
      doc.removeEventListener('fullscreenchange', this.handleFullScreenChange);
      doc.removeEventListener('webkitfullscreenchange', this.handleFullScreenChange);
      doc.removeEventListener('mozfullscreenchange', this.handleFullScreenChange);
      doc.removeEventListener('MSFullscreenChange', this.handleFullScreenChange);
      doc.removeEventListener('mousemove', this.handleUserActivity);
      doc.removeEventListener('mousedown', this.handleUserActivity);
      doc.removeEventListener('keydown', this.handleUserActivity);
      doc.removeEventListener('touchstart', this.handleUserActivity);
    }
    this.props.toggleAttach(true);
  }

  componentDidUpdate(prevProps) {
    // Start hide timer when switching between attached/detached modes
    if (prevProps.attached !== this.props.attached) {
      this.showControlsTemporarily();
    }
  }

  shouldComponentUpdate(nextProps, nextState, nextContext) {
    return (
      nextProps.attached !== this.props.attached ||
      nextProps.isDoubleSize !== this.props.isDoubleSize ||
      nextState.stream !== this.state.stream ||
      nextState.fullScreen !== this.state.fullScreen ||
      nextState.showControls !== this.state.showControls
    );
  }

  videoRef(ref) {
    if (ref && ref !== this.videoElement) {
      this.videoElement = ref;
      ref.srcObject = this.state.stream;
    }
  }

  setVideoWrapperRef(ref) {
    if (ref && ref !== this.videoWrapper) {
      // Remove old event listeners if videoWrapper changed
      if (this.videoWrapper) {
        const oldDoc = this.videoWrapper.ownerDocument;
        const oldWindow = oldDoc.defaultView;
        oldWindow.removeEventListener("resize", this.handleFullScreenChange);
        oldDoc.removeEventListener('fullscreenchange', this.handleFullScreenChange);
        oldDoc.removeEventListener('webkitfullscreenchange', this.handleFullScreenChange);
        oldDoc.removeEventListener('mozfullscreenchange', this.handleFullScreenChange);
        oldDoc.removeEventListener('MSFullscreenChange', this.handleFullScreenChange);
        oldDoc.removeEventListener('mousemove', this.handleUserActivity);
        oldDoc.removeEventListener('mousedown', this.handleUserActivity);
        oldDoc.removeEventListener('keydown', this.handleUserActivity);
        oldDoc.removeEventListener('touchstart', this.handleUserActivity);
      }
      
      this.videoWrapper = ref;
      const newDoc = this.videoWrapper.ownerDocument;
      const newWindow = newDoc.defaultView;
      
      // Add event listeners to the correct window/document
      newWindow.addEventListener("resize", this.handleFullScreenChange);
      // Add fullscreen change listeners for better detection
      newDoc.addEventListener('fullscreenchange', this.handleFullScreenChange);
      newDoc.addEventListener('webkitfullscreenchange', this.handleFullScreenChange);
      newDoc.addEventListener('mozfullscreenchange', this.handleFullScreenChange);
      newDoc.addEventListener('MSFullscreenChange', this.handleFullScreenChange);
      
      newDoc.addEventListener('mousemove', this.handleUserActivity);
      newDoc.addEventListener('mousedown', this.handleUserActivity);
      newDoc.addEventListener('keydown', this.handleUserActivity);
      newDoc.addEventListener('touchstart', this.handleUserActivity);
      
      this.setState({fullScreen: isFullScreen(this.videoWrapper)});
    }
  }

  handleFullScreenChange() {
    const fullScreen = isFullScreen(this.videoWrapper);
    // Show controls immediately (no transition) so icon change is visible
    this.setState({fullScreen, showControls: true}, () => {
      // Force re-render to update icon
      this.forceUpdate();
    });
    // Clear and restart hide timer
    this.clearHideTimer();
    this.hideControlsTimer = setTimeout(() => {
      this.setState({showControls: false});
    }, 5000);
  }

  handleUserActivity() {
    // Always auto-hide controls in all modes
    this.showControlsTemporarily();
  }

  showControlsTemporarily() {
    this.setState({showControls: true});
    this.clearHideTimer();
    // Hide controls after 5 seconds of inactivity
    this.hideControlsTimer = setTimeout(() => {
      this.setState({showControls: false});
    }, 5000);
  }

  clearHideTimer() {
    if (this.hideControlsTimer) {
      clearTimeout(this.hideControlsTimer);
      this.hideControlsTimer = null;
    }
  }

  onBlock() {
    alert("You browser is blocking our popup! You need to allow it");
  }

  handleFullScreen() {
    // Show controls immediately before toggling
    this.showControlsTemporarily();
    toggleFullScreen(this.videoWrapper);
    // The icon will update via handleFullScreenChange when browser actually changes fullscreen
  }

  render() {
    const {attached, close, toggleAttach, isDoubleSize} = this.props;
    const {stream, fullScreen, showControls} = this.state;

    const inLine = stream && (
      <div
        className={classNames("video video--broadcast", {
          "is-double-size": isDoubleSize,
          "hide-cursor": !showControls
        })}
        key="v0"
        ref={(ref) => this.setVideoWrapperRef(ref)}
        id="video0"
        style={{height: !attached ? "100%" : null, width: !attached ? "100%" : null}}
      >
        <div className="video__overlay">
          <div className={"activities"}>
            <div className={classNames("controls", {"controls--hidden": !showControls})}>
              <div className="controls__top">
                <IconButton onClick={close} size="large">
                  <Close style={{color: "white", fontWeight: "bold"}} />
                </IconButton>
              </div>
              <div className="controls__bottom">
                <div className="controls__spacer"></div>
                <button onClick={this.handleFullScreen}>
                  <Icon name={isFullScreen(this.videoWrapper) ? "compress" : "expand"}/>
                </button>
                {!attached ? null : (
                  <button onClick={() => toggleAttach()}>
                    <Icon name="external square"/>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="mediaplayer">
          <video
            ref={(ref) => this.videoRef(ref)}
            id="remoteVideo"
            width="134"
            height="100"
            autoPlay={true}
            controls={false}
            muted={true}
            playsInline={true}
          />
        </div>
      </div>
    );

    return (
      <>
        {attached && inLine}
        {!attached && (
          <NewWindow
            features={{width: "725", height: "635", left: "200", top: "200", location: "no"}}
            title="KliOlami"
            onUnload={() => toggleAttach()}
            onBlock={this.onBlock}
          >
            {inLine}
          </NewWindow>
        )}
      </>
    );
  }
}

export default QuadStream;
