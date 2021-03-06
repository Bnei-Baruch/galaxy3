import React, {Component, Fragment} from "react";
import {Divider, Header, Icon, Modal, List, Menu} from "semantic-ui-react";
import {videos_options2, audiog_options2, NO_VIDEO_OPTION_VALUE} from "../../shared/consts";
// import '../StreamApp/GalaxyStream.css';
import classNames from "classnames";
import "./BroadcastStream.scss";
import Volume from "./Volume";
import {withTranslation} from "react-i18next";
import {isIOS} from "react-device-detect";

class VirtualStreaming extends Component {
  constructor(props) {
    super(props);
    this.handleFullScreenChange = this.handleFullScreenChange.bind(this);
    // this.videoStateChanged = this.videoStateChanged.bind(this);
  }

  state = {
    audios: Number(localStorage.getItem("vrt_lang")) || 2,
    room: Number(localStorage.getItem("room")) || null,
    user: {},
    cssFixInterval: null,
    fullScreen: false,
    videoSelectionOpen: false,
    audioSelectionOpen: false,
  };

  videoRef(ref) {
    if (ref && ref !== this.video) {
      this.video = ref;
      this.props.shidurJanus.attachVideoStream(ref);
    }
  }

  setVideoWrapperRef(ref) {
    if (ref && ref !== this.videoWrapper) {
      this.videoWrapper = ref;
      this.videoWrapper.ownerDocument.defaultView.removeEventListener("resize", this.handleFullScreenChange);
      this.videoWrapper.ownerDocument.defaultView.addEventListener("resize", this.handleFullScreenChange);
    }
  }

  handleFullScreenChange() {
    this.setState({fullScreen: this.isFullScreen()});
  }

  componentDidMount() {
    this.setState({cssFixInterval: setInterval(() => this.cssFix(), 500)});
  }

  cssFix() {
    const d = document.getElementsByClassName("controls__dropdown");
    if (d) {
      const o = document.getElementById("video0");
      if (o) {
        Array.from(d).forEach((x) => {
          x.style.maxHeight = `85vh`;
        });
      }
    }
  }

  componentWillUnmount() {
    if (this.state.cssFixInterval) {
      clearInterval(this.state.cssFixInterval);
    }
    if (this.videoWrapper) {
      this.videoWrapper.ownerDocument.defaultView.removeEventListener("resize", this.handleFullScreenChange);
    }
  }

  isFullScreen = () => {
    return (
      !!this.videoWrapper &&
      (this.videoWrapper.ownerDocument.fullscreenElement ||
        this.videoWrapper.ownerDocument.mozFullScreenElemen ||
        this.videoWrapper.ownerDocument.webkitFullscreenElement)
    );
  };

  toggleFullScreen = () => {
    if (this.state.fullScreen) {
      if (this.videoWrapper.ownerDocument.exitFullscreen) {
        this.videoWrapper.ownerDocument.exitFullscreen();
      } else if (this.videoWrapper.ownerDocument.webkitExitFullscreen) {
        this.videoWrapper.ownerDocument.webkitExitFullscreen();
      } else if (this.videoWrapper.ownerDocument.mozCancelFullScreen) {
        this.videoWrapper.ownerDocument.mozCancelFullScreen();
      }
      this.setState({fullScreen: false});
    } else {
      if (this.videoWrapper.requestFullscreen) {
        this.videoWrapper.requestFullscreen();
      } else if (this.videoWrapper.webkitRequestFullscreen) {
        this.videoWrapper.webkitRequestFullscreen();
      } else if (this.videoWrapper.mozRequestFullScreen) {
        this.videoWrapper.mozRequestFullScreen();
      } else if (this.video.webkitEnterFullscreen) {
        this.video.webkitEnterFullscreen();
      }
      this.setState({fullScreen: true});
    }
  };

  setVideo(videos) {
    this.setState({videoSelectionOpen: false});
    this.props.shidurJanus.setVideo(videos);
    this.props.setVideo(videos);
  }

  setAudio(audios, text) {
    this.setState({audios, audioSelectionOpen: false});
    this.props.shidurJanus.setAudio(audios, text);
  }

  localToggleShidur() {
    const {
      //	shidur,
      //	shidurLoading,
      toggleShidur,
    } = this.props;

    /*if (!shidurLoading && shidur && this.video && this.video.paused) {
        this.video.play();
        if (this.props.audio) {
            this.props.audio.play();
        }
    } else {*/
    toggleShidur();
    //}
  }

  /*isForcedPaused() {
      const {
          shidur,
          shidurLoading,
      } = this.props;
    return !shidurLoading && shidur && this.video && this.video.paused;
  }*/

  render() {
    const {shidur, shidurLoading, shidurJanus, t, videos} = this.props;
    const {audios, fullScreen, room, videoSelectionOpen, audioSelectionOpen} = this.state;

    if (!room) {
      return <b> :: THIS PAGE CAN NOT BE OPENED DIRECTLY ::</b>;
    }

    const video_option = videos_options2.find((option) => option.value === videos);
    const audio_option = audiog_options2.find((option) => option.value === audios);

    return (
      <Fragment>
        <div ref={(ref) => this.setVideoWrapperRef(ref)}>
          <div
            className={classNames("video", "video--broadcast", {"no-full-screen": !fullScreen})}
            key="v0"
            id="video0"
          >
            <div className="center-play">
              {!shidurLoading && !shidur && (
                <Icon name="play" className="center-play" onClick={() => this.localToggleShidur()} />
              )}
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
          <Menu icon="labeled" inverted className={classNames("toolbar", {"full-screen": fullScreen})}>
            <Menu.Item onClick={() => this.localToggleShidur()} disabled={shidurLoading || !shidur}>
              <Icon name="stop" />
            </Menu.Item>
            <Menu.Item>
              <Volume media={shidurJanus.audioElement} muted={this.props.muted} setMuted={this.props.setMuted} />
            </Menu.Item>
            {!fullScreen && (
              <Modal
                className="video-selection"
                open={videoSelectionOpen}
                onClose={() => this.setState({videoSelectionOpen: false})}
                trigger={
                  <Menu.Item
                    onClick={() => this.setState({videoSelectionOpen: true})}
                    name={
                      video_option
                        ? video_option.value === NO_VIDEO_OPTION_VALUE
                          ? t(video_option.description)
                          : video_option.description
                        : ""
                    }
                  />
                }
                closeIcon
              >
                <List>
                  {videos_options2.map((option, i) => {
                    if (option.divider === true) return <Divider key={i} />;
                    return (
                      <List.Item
                        key={i}
                        onClick={() => this.setVideo(option.value)}
                        className={classNames({selected: option.value === videos})}
                      >
                        <div>{t(option.text)}</div>
                        <div className="description">{t(option.description)}</div>
                      </List.Item>
                    );
                  })}
                </List>
              </Modal>
            )}
            {!fullScreen && (
              <Modal
                className="audio-selection"
                open={audioSelectionOpen}
                onClose={() => this.setState({audioSelectionOpen: false})}
                trigger={
                  <Menu.Item
                    className="audio-selection"
                    onClick={() => this.setState({audioSelectionOpen: true})}
                    icon={audio_option.icon ? audio_option.icon : ""}
                    name={audio_option.text ? `${audio_option.text}` : ""}
                  />
                }
                closeIcon
              >
                <List>
                  {audiog_options2.map((option, i) => {
                    if (option.divider === true) return <Divider key={i} />;
                    if (option.header === true)
                      return (
                        <List.Header className="ui blue" icon={option.icon} key={i}>
                          <Icon name={option.icon} />
                          <div>
                            {t(option.text)}
                            <br />
                            {option.description ? (
                              <Header as="span" size="tiny" color="grey" content={t(option.description)} />
                            ) : (
                              ""
                            )}
                          </div>
                        </List.Header>
                      );
                    return (
                      <List.Item
                        key={i}
                        className={classNames({selected: option.value === audios})}
                        //flag={option.flag}
                        onClick={() => this.setAudio(option.value, option.eng_text)}
                      >
                        <div>{option.text}</div>
                        <div className="description">{option.description}</div>
                      </List.Item>
                    );
                  })}
                </List>
              </Modal>
            )}
            {!isIOS && (
              <Menu.Item>
                <Icon name={fullScreen ? "compress" : "expand"} onClick={this.toggleFullScreen} />
              </Menu.Item>
            )}
          </Menu>
        </div>
      </Fragment>
    );
  }
}

export default withTranslation()(VirtualStreaming);
