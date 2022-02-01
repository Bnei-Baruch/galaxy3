import React, {Component} from "react";
import NewWindow from "@hinaser/react-new-window";
import {isFullScreen, toggleFullScreen} from "../FullScreenHelper";
import {Fullscreen} from "../buttons";
import {Close, OpenInNew} from "@material-ui/icons";
import IconButton from "@material-ui/core/IconButton";

class KliOlamiStream extends Component {
  constructor(props) {
    super(props);
    this.state = {
      fullScreen: false,
      stream: null,
    };

    this.handleFullScreenChange = this.handleFullScreenChange.bind(this);
  }

  componentDidMount() {
    if(!this.state.stream) this.props.VirtualStreamingJanus.initQuadStream(stream => this.setState({stream}))
  }

  componentWillUnmount() {
    if (this.videoWrapper) {
      this.props.VirtualStreamingJanus.detachQuadStream()
      this.videoWrapper.ownerDocument.defaultView.removeEventListener("resize", this.handleFullScreenChange);
    }
    this.props.toggleAttach(true);
  }

  shouldComponentUpdate(nextProps, nextState, nextContext) {
    return (
      nextProps.attached !== this.props.attached ||
      nextState.stream !== this.state.stream ||
      nextState.fullScreen !== this.state.fullScreen
    );
  }

  videoRef(ref) {
    if (ref) {
      ref.srcObject = this.state.stream;
    }
  }

  setVideoWrapperRef(ref) {
    if (ref && ref !== this.videoWrapper) {
      this.videoWrapper = ref;
      ref.ownerDocument.defaultView.removeEventListener("resize", this.handleFullScreenChange);
      ref.ownerDocument.defaultView.addEventListener("resize", this.handleFullScreenChange);
      this.setState({fullScreen: isFullScreen(this.videoWrapper)});
    }
  }

  handleFullScreenChange() {
    this.setState({fullScreen: isFullScreen(this.videoWrapper)});
  }

  onBlock() {
    alert("You browser is blocking our popup! You need to allow it");
  }

  handleFullScreen() {
    const fullScreen = toggleFullScreen(this.videoWrapper);
    this.setState({fullScreen});
  }

  render() {
    const {attached, close, toggleAttach} = this.props;
    const {stream, fullScreen} = this.state;

    const inLine = stream && (
      <div
        className="video video--broadcast"
        key="v0"
        ref={(ref) => this.setVideoWrapperRef(ref)}
        id="video0"
        style={{height: !attached ? "100%" : null, width: !attached ? "100%" : null}}
      >
        <div className="video__overlay">
          <div className={"activities"}>
            <div className="controls">
              <div className="controls__top">
                <IconButton onClick={close}>
                  <Close style={{color: "white", fontWeight: "bold"}} />
                </IconButton>
              </div>
              <div className="controls__bottom">
                <div className="controls__spacer"></div>
                <Fullscreen isOn={fullScreen} action={this.handleFullScreen.bind(this)} color={"white"} />
                {!attached ? null : (
                  <IconButton onClick={() => toggleAttach()}>
                    <OpenInNew style={{color: "white", fontWeight: "bold"}} />
                  </IconButton>
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

export default KliOlamiStream;
