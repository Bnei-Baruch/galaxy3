import React, { Component, Fragment } from 'react';
import {
  Button,
  Divider,
  Dropdown,
  Header,
  Icon,
  Label,
  List,
  Menu,
  Popup,
} from 'semantic-ui-react';
import {
  videos_options2,
  audiog_options2,
  NO_VIDEO_OPTION_VALUE,
} from '../../shared/consts';
// import '../StreamApp/GalaxyStream.css';
import classNames from "classnames";
import './BroadcastStream.scss';
import Volume from './Volume'
import {withTranslation} from "react-i18next";
import { isIOS } from 'react-device-detect';

class VirtualStreaming extends Component {
  constructor(props) {
    super(props);
    this.handleFullScreenChange = this.handleFullScreenChange.bind(this);
    // this.videoStateChanged = this.videoStateChanged.bind(this);
  }

  state = {
    videos: Number(localStorage.getItem('vrt_video')) || 1,
    audios: Number(localStorage.getItem('vrt_lang')) || 2,
    room: Number(localStorage.getItem('room')) || null,
    user: {},
    cssFixInterval: null,
    talking: false,
    fullScreen: false,
		// videoStateChanged: 0,
  };

	/*videoStateChanged(e) {
		console.log('videoStateChanged', e);
		if (e && e.type === 'pause' && this.props.audio) {
			this.props.audio.pause();
		}
		if (e && e.type === 'play' && this.props.audio) {
			this.props.audio.play();
		}
		this.setState({videoStateChanged: this.state.videoStateChanged + 1});
	}*/

  videoRef(ref) {
		if (ref && ref !== this.video) {
			/*if (this.video) {
				this.video.removeEventListener('pause', this.videoStateChanged);
				this.video.removeEventListener('play', this.videoStateChanged);
			}*/
			this.video = ref;
			/*this.video.addEventListener('pause', this.videoStateChanged);
			this.video.addEventListener('play', this.videoStateChanged);*/
			this.props.shidurJanus.attachVideoStream(ref);
			// this.setState({videoStateChanged: this.state.videoStateChanged + 1});
		}
  }

  setVideoWrapperRef(ref) {
    if (ref && ref !== this.videoWrapper) {
      this.videoWrapper = ref;
      this.videoWrapper.ownerDocument.defaultView.removeEventListener('resize', this.handleFullScreenChange);
      this.videoWrapper.ownerDocument.defaultView.addEventListener('resize', this.handleFullScreenChange);
    }
  }

  handleFullScreenChange() {
    this.setState({fullScreen: this.isFullScreen()});
  }

  componentDidMount() {
    this.props.shidurJanus.onTalking((talking) => this.setState({talking}));
    this.setState({cssFixInterval: setInterval(() => this.cssFix(), 500)});
  };

  cssFix() {
    const d = document.getElementsByClassName('controls__dropdown');
    if (d){
      const o = document.getElementById('video0');
      if (o) {
        Array.from(d).forEach(x => {
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
      this.videoWrapper.ownerDocument.defaultView.removeEventListener('resize', this.handleFullScreenChange);
    }
  };

  isFullScreen = () => {
    return !!this.videoWrapper && (this.videoWrapper.ownerDocument.fullscreenElement
      || this.videoWrapper.ownerDocument.mozFullScreenElemen
      || this.videoWrapper.ownerDocument.webkitFullscreenElement);
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
    }
  };

  setVideo(videos) {
    this.setState({videos});
    this.props.shidurJanus.setVideo(videos);
  }

  setAudio(audios, text) {
    this.setState({audios});
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
    const {
			shidur,
			shidurLoading,
      shidurJanus,
      t,
    } = this.props;
    const {
      audios,
      fullScreen,
      room,
      talking,
      videos,
    } = this.state;

    if (!room) {
      return (<b> :: THIS PAGE CAN NOT BE OPENED DIRECTLY ::</b>);
    }

    const video_option = videos_options2.find((option) => option.value === videos);
    const audio_option = audiog_options2.find((option) => option.value === audios);

    return (
      <Fragment>
        <div ref={(ref) => this.setVideoWrapperRef(ref)}>
          <div className="video video--broadcast" key='v0' id='video0'
               style={{border: 'none', height: '39.3em'}}>
            <div className="center-play">
							{!shidurLoading && !shidur && <Icon name="play" className="center-play" onClick={() => this.localToggleShidur()} />}
						</div>
            {talking && <Label className='talk' size='massive' color='red'><Icon name='microphone' />On</Label>}
            <div className='mediaplayer'>
              <video ref={(ref) => this.videoRef(ref)}
                     id="remoteVideo"
                     width="134"
                     height="100"
                     autoPlay={true}
                     controls={false}
                     muted={true}
                     playsInline={true} />
            </div>
          </div>
          <Menu icon='labeled' inverted className={classNames('toolbar', {'full-screen' : fullScreen})}>
            <Menu.Item onClick={() => this.localToggleShidur()}
											 disabled={shidurLoading || !shidur}>
              <Icon name="stop" />
            </Menu.Item>
            <Menu.Item>
              <Volume media={shidurJanus.audioElement} />
            </Menu.Item>
            <Dropdown
              upward
              floating
              scrolling
              icon={null}
              selectOnBlur={false}
              trigger={<Menu.Item name={video_option ?
                            (video_option.value === NO_VIDEO_OPTION_VALUE ?
                              t(video_option.description) : video_option.description) : ''} />}
              className="video-selection">
              <Dropdown.Menu className='controls__dropdown'>
                {videos_options2.map((option, i) => {
                  if (option.divider === true) return (<Dropdown.Divider key={i}/>);
                  return (
                    <Dropdown.Item
											key={i}
											text={t(option.text)}
											selected={option.value === videos}
											description={t(option.description)}
											onClick={() => this.setVideo(option.value)} />
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
              trigger={<Menu.Item icon={audio_option.icon ?audio_option.icon : ''} name={audio_option.text ? `${audio_option.text}` : ''} />}
              className="audio-selection"
              >
              <Dropdown.Menu className='controls__dropdown'>
                {audiog_options2.map((option, i) => {
                  if (option.divider === true) return (<Dropdown.Divider key={i}/>);
                  if (option.header === true) return (
                    <Dropdown.Header className='ui blue' icon={option.icon} key={i}>
                      <Icon name={option.icon}/>
                      <div>
                      {t(option.text)}
                      <br/>
                      {(option.description ? <Header as='span' size='tiny' color='grey' content={t(option.description)} /> : '')}
                      </div>
                    </Dropdown.Header>
                  );
                  return (
                    <Dropdown.Item
                      key={i}
                      text={option.text}
                      selected={option.value === audios}
                      //flag={option.flag}
                      description={option.description}
                      action={option.action}
                      onClick={() => this.setAudio(option.value, option.eng_text)}
                    />
                  );
                })}
              </Dropdown.Menu>
            </Dropdown>
            {!isIOS && <Menu.Item>
              <Icon name={fullScreen ? 'compress' : 'expand'} onClick={this.toggleFullScreen} style={{fontSize: '1.5em'}}/>
            </Menu.Item>}
          </Menu>
        </div>
      </Fragment>
    );
  }
}

export default withTranslation()(VirtualStreaming);

