import React, {Component, Fragment} from "react";
import classNames from "classnames";
import {Dropdown, Grid, Header, Icon, Image, Label, Radio} from "semantic-ui-react";
import NewWindow from "@hinaser/react-new-window";
import {audiog_options2, NO_VIDEO_OPTION_VALUE, NOTRL_STREAM_ID} from "../../shared/consts";
import "./BroadcastStream.scss";
import Volume from "./components/Volume";
import JanusStream from "../../shared/streaming-utils";
import {withTranslation} from "react-i18next";
import {isFullScreen, toggleFullScreen} from "./FullScreenHelper";
import audioOnly from "../../shared/audio_only.svg";
import {SubtitlesContainer} from "./subtitles/SubtitlesContainer";
import {getNextVideosByIsAv1, getVideoOptionsByIsAv1} from "../../shared/tools";

class VirtualStreaming extends Component {
  state = {
    room: Number(localStorage.getItem("room")) || null,
    user: {},
    cssFixInterval: null,
    talking: false,
    showControls: true,
  };

  hideControlsTimer = null;

  constructor(props) {
    super(props);
    this.handleFullScreenChange = this.handleFullScreenChange.bind(this);
    this.toggleIsAv1 = this.toggleIsAv1.bind(this);
    this.handleUserActivity = this.handleUserActivity.bind(this);
  }

  videoRef(ref) {
    if (ref && ref !== this.videoElement) {
      this.videoElement = ref;
      JanusStream.attachVideoStream(ref);
    }
  }

  setVideoWrapperRef(ref) {
    if (ref && ref !== this.videoWrapper) {
      // Remove old event listeners if videoWrapper changed
      if (this.videoWrapper) {
        const oldDoc = this.videoWrapper.ownerDocument;
        const oldWindow = oldDoc.defaultView;
        oldWindow.removeEventListener("resize", this.handleFullScreenChange);
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
      newDoc.addEventListener('mousemove', this.handleUserActivity);
      newDoc.addEventListener('mousedown', this.handleUserActivity);
      newDoc.addEventListener('keydown', this.handleUserActivity);
      newDoc.addEventListener('touchstart', this.handleUserActivity);
    }
  }

  handleFullScreenChange() {
    const isNowFullScreen = isFullScreen(this.videoWrapper);
    this.setState({fullScreen: isNowFullScreen});
    
    // Show controls and start hide timer whenever fullscreen changes
    this.showControlsTemporarily();
  }

  handleUserActivity() {
    // Always auto-hide controls in all modes (inline, detached, fullscreen)
    this.showControlsTemporarily();
  }

  showControlsTemporarily() {
    this.setState({showControls: true});
    this.clearHideTimer();
    // Hide controls after 5 seconds of inactivity in all modes
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

  componentDidMount() {
    JanusStream.onTalking((talking) => this.setState({talking}));
    //this.setState({ cssFixInterval: setInterval(() => this.cssFix(), 500) });
    
    // Event listeners will be added in setVideoWrapperRef when the ref is set
    // This ensures they're added to the correct document (parent or new window)
    
    // Start hide timer on mount (works for all modes)
    this.showControlsTemporarily();
  }

  componentDidUpdate(prevProps) {
    // Start hide timer when switching between attached/detached modes
    if (prevProps.attached !== this.props.attached) {
      this.showControlsTemporarily();
    }
  }

  cssFix() {
    const d = document.getElementsByClassName("controls__dropdown");
    if (d) {
      const o = document.getElementById("video1");
      if (o) {
        Array.from(d).forEach((x) => {
          x.style.maxHeight = `${o.offsetHeight - 50}px`;
        });
      }
    }
  }

  componentWillUnmount() {
    if (this.state.cssFixInterval) {
      clearInterval(this.state.cssFixInterval);
    }
    this.clearHideTimer();
    
    // Remove event listeners from the correct document
    if (this.videoWrapper) {
      const doc = this.videoWrapper.ownerDocument;
      const win = doc.defaultView;
      win.removeEventListener("resize", this.handleFullScreenChange);
      doc.removeEventListener('mousemove', this.handleUserActivity);
      doc.removeEventListener('mousedown', this.handleUserActivity);
      doc.removeEventListener('keydown', this.handleUserActivity);
      doc.removeEventListener('touchstart', this.handleUserActivity);
    }
  }

  isFullScreen = () => isFullScreen(this.videoWrapper);

  toggleFullScreen = () => toggleFullScreen(this.videoWrapper);

  toggleNewWindow = () => {
    this.props.attached ? this.props.setDetached() : this.props.setAttached();
  };

  onUnload = () => {
    this.props.setAttached();
  };

  onBlock = () => {
    alert("You browser is blocking our popup! You need to allow it");
  };

  setVideo(videos) {
    JanusStream.setVideo(videos);
    this.props.setVideo(videos);
  }

  toggleIsAv1() {
    const {videos, isAv1: prevIsAv1} = this.props
    const isAv1 = !prevIsAv1
    const nextVideos = getNextVideosByIsAv1(videos, isAv1)
    JanusStream.toggleAv1(nextVideos)
    this.props.setVideo(nextVideos, isAv1)
    localStorage.setItem("vrt_video", nextVideos);
    localStorage.setItem("vrt_is_av1", isAv1.toString());
  }

  toggleTranslation = () => {
    if (this.props.audios === NOTRL_STREAM_ID) {
      let prev_lang = Number(localStorage.getItem("trl_lang")) || 2;
      const audio_option = audiog_options2.find((option) => option.value === prev_lang);
      this.props.setAudio(prev_lang, audio_option.eng_text);
    }
    if (this.props.audios !== NOTRL_STREAM_ID) {
      let prev_lang = Number(localStorage.getItem("trl_lang"))
      let curr_lang = Number(localStorage.getItem("vrt_lang")) || 2;
      if (!prev_lang) {
        const audio_option = audiog_options2.find((option) => option.value === curr_lang);
        localStorage.setItem("trl_lang", curr_lang);
        localStorage.setItem("vrt_langtext", audio_option.eng_text);
      }
      this.props.setAudio(NOTRL_STREAM_ID, "Original");
    }
  };

  render() {
    const {attached, closeShidur, t, videos, layout, audios, setAudio, isDoubleSize, isAv1} = this.props;
    const {room, talking, showControls} = this.state;

    if (!room) {
      return <b> :: THIS PAGE CAN NOT BE OPENED DIRECTLY ::</b>;
    }
    const isOnFullScreen = isFullScreen(this.videoWrapper);
    const shouldHideCursor = !showControls && (isOnFullScreen || !attached);

    const video_options = getVideoOptionsByIsAv1(isAv1).current;
    const video_option = video_options.find((option) => option.value === videos);
    const audio_option = audiog_options2.find((option) => option.value === audios);
    const playerLang = audio_option.langKey || audio_option.key;
    const inLine = (
      <div
        className={classNames("video video--broadcast", {
          "is-double-size": isDoubleSize, 
          "not-attached": !attached
        })}
        key="v1"
        ref={(ref) => this.setVideoWrapperRef(ref)}
        id="video1"
        style={{height: !attached ? "100%" : null, width: !attached ? "100%" : null}}
      >
        <div className="video__overlay">
          <div className={classNames("activities", {
            "on_full_browser": isOnFullScreen || !attached,
            "hide-cursor": shouldHideCursor
          })}>
            <div className={classNames("controls", {"controls--hidden": !showControls})}>
              <div className="controls__top">
                <button>
                  <Icon name="close" onClick={closeShidur}/>
                </button>
              </div>
              <div className="controls__bottom">
                <Radio
                  toggle
                  className="controls__toggle"
                  checked={isAv1}
                  onChange={this.toggleIsAv1}
                  label={t(`oldClient.${isAv1 ? "av1On" : "av1Off"}`)}
                />
                <Dropdown
                  upward
                  floating
                  scrolling
                  icon={null}
                  selectOnBlur={false}
                  trigger={
                    <button>
                      {video_option
                        ? video_option.value === NO_VIDEO_OPTION_VALUE
                          ? t(video_option.description)
                          : video_option.description
                        : ""}
                    </button>
                  }
                  className="video-selection"
                >
                  <Dropdown.Menu className="controls__dropdown">
                    {video_options.map((option, i) => {
                      if (option.divider === true) return <Dropdown.Divider key={i}/>;
                      if (option.header === true)
                        return (
                          <Dropdown.Header className="ui blue" icon={option.icon}>
                            {t(option.text)}
                            {option.description ? (
                              <Header as="div" size="tiny" color="grey" content={t(option.description)}/>
                            ) : (
                              ""
                            )}
                          </Dropdown.Header>
                        );
                      return (
                        <Dropdown.Item
                          key={i}
                          text={t(option.text)}
                          selected={option.value === videos}
                          icon={option.icon}
                          description={t(option.description)}
                          action={option.action}
                          onClick={() => this.setVideo(option.value)}
                        />
                      );
                    })}
                  </Dropdown.Menu>
                </Dropdown>

                <Dropdown
                  upward
                  floating
                  scrolling
                  icon={null}
                  selectOnBlur={false}
                  trigger={
                    <button>
                      {audio_option.icon ? <Icon name={audio_option.icon}/> : ""}
                      {audio_option.text ? `${audio_option.text}` : ""}
                    </button>
                  }
                  className="audio-selection"
                >
                  <Dropdown.Menu className="controls__dropdown">
                    {audiog_options2.map((option, i) => {
                      if (option.divider === true) return <Dropdown.Divider key={i}/>;
                      if (option.header === true)
                        return (
                          <Dropdown.Header className="ui blue" key={i}>
                            <Icon name={option.icon}/>
                            <div>
                              {t(option.text)}
                              <br/>
                              {option.description ? (
                                <Header as="span" size="tiny" color="grey" content={t(option.description)}/>
                              ) : (
                                ""
                              )}
                            </div>
                          </Dropdown.Header>
                        );
                      return (
                        <Dropdown.Item
                          key={i}
                          text={option.text}
                          selected={option.value === audios}
                          description={option.description}
                          action={option.action}
                          onClick={() => setAudio(option.value, option.eng_text)}
                        />
                      );
                    })}
                  </Dropdown.Menu>
                </Dropdown>
                <Volume media={JanusStream.audioElement}/>
                <Radio
                  toggle
                  className="controls__toggle"
                  checked={this.props.audios !== NOTRL_STREAM_ID}
                  onChange={this.toggleTranslation}
                  label={t(`oldClient.${this.props.audios !== NOTRL_STREAM_ID ? "translationOn" : "translationOff"}`)}
                />
                <div className="controls__spacer"></div>
                <button onClick={this.toggleFullScreen}>
                  <Icon name={isFullScreen(this.videoWrapper) ? "compress" : "expand"}/>
                </button>
                {!attached ? null : (
                  <button onClick={this.toggleNewWindow}>
                    <Icon name="external square"/>
                  </button>
                )}
              </div>
            </div>
            <SubtitlesContainer
              layout={isOnFullScreen ? "fullscreen" : !attached ? "detached" : layout}
              playerLang={playerLang}
            />
          </div>
          {talking && (
            <Label className="talk" size="massive" color="red">
              <Icon name="microphone"/>
              On
            </Label>
          )}
        </div>
        <div className="mediaplayer">
          {videos === NO_VIDEO_OPTION_VALUE ? (
            <Grid verticalAlign="middle" columns={1} centered>
              <Grid.Row>
                <Grid.Column>
                  <Image className="noVideoPlayerIcon" src={audioOnly}/>
                </Grid.Column>
              </Grid.Row>
            </Grid>
          ) : (
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
          )}
        </div>
      </div>
    );

    return (
      <Fragment>
        {attached && inLine}
        {!attached && (
          <NewWindow
            features={{width: "725", height: "635", left: "200", top: "200", location: "no"}}
            title="V4G"
            onUnload={this.onUnload}
            onBlock={this.onBlock}
          >
            {inLine}
          </NewWindow>
        )}
      </Fragment>
    );
  }
}

export default withTranslation()(VirtualStreaming);
