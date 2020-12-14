import React, { Component, Fragment } from 'react';
import {
  Label,
  Dropdown,
  Header,
  Icon
} from 'semantic-ui-react';
import NewWindow from '@hinaser/react-new-window';
import {
  videos_options2,
  audiog_options2,
  NO_VIDEO_OPTION_VALUE,
} from '../../shared/consts';
// import '../StreamApp/GalaxyStream.css';
import './BroadcastStream.scss';
import Volume from './components/Volume';
import { withTranslation } from 'react-i18next';
import { isFullScreen, toggleFullScreen } from './FullScreenHelper';
import VirtualWorkshopQuestion from './VirtualWorkshopQuestion';

class VirtualStreaming extends Component {

  constructor(props) {
    super(props);
    this.handleFullScreenChange = this.handleFullScreenChange.bind(this);
  }

  state = {
    audios: Number(localStorage.getItem('vrt_lang')) || 2,
    room: Number(localStorage.getItem('room')) || null,
    user: {},
    cssFixInterval: null,
    talking: false
  };

  videoRef(ref) {
    this.props.virtualStreamingJanus.attachVideoStream(ref);
  }

  setVideoWrapperRef(ref) {
    if (ref && ref !== this.videoWrapper) {
      this.videoWrapper = ref;
      this.videoWrapper.ownerDocument.defaultView.removeEventListener('resize', this.handleFullScreenChange);
      this.videoWrapper.ownerDocument.defaultView.addEventListener('resize', this.handleFullScreenChange);
    }
  }

  handleFullScreenChange() {
    this.setState({ fullScreen: isFullScreen(this.videoWrapper) });
  }

  componentDidMount() {
    this.props.virtualStreamingJanus.onTalking((talking) => this.setState({ talking }));
    this.setState({ cssFixInterval: setInterval(() => this.cssFix(), 500) });
  };

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.props.audios && this.props.audios.audios !== prevState.audios) {
      const { audios, text } = this.props.audios;
      this.setAudio(audios, text);
    }
  }

  cssFix() {
    const d = document.getElementsByClassName('controls__dropdown');
    if (d) {
      const o = document.getElementById('video0');
      if (o) {
        Array.from(d).forEach(x => {
          x.style.maxHeight = `${o.offsetHeight - 50}px`;
        });
      }
    }
  }

  componentWillUnmount() {
    if (this.state.cssFixInterval) {
      clearInterval(this.state.cssFixInterval);
    }
  };

  isFullScreen = () => isFullScreen(this.videoWrapper);

  toggleFullScreen = () => toggleFullScreen(this.videoWrapper);

  toggleNewWindow = () => {
    this.props.attached ? this.props.setDetached() : this.props.setAttached();
  };

  onUnload = () => {
    this.props.setAttached();
  };

  onBlock = () => {
    alert('You browser is blocking our popup! You need to allow it');
  };

  setVideo(videos) {
    this.props.virtualStreamingJanus.setVideo(videos);
    this.props.setVideo(videos);
  }

  setAudio(audios, text) {
    this.setState({ audios });
    this.props.virtualStreamingJanus.setAudio(audios, text);
  }

  render() {
    const {
            attached,
            closeShidur,
            virtualStreamingJanus,
            t,
            videos,
            layout
          } = this.props;
    const {
            audios,
            room,
            talking,
          } = this.state;

    if (!room) {
      return (<b> :: THIS PAGE CAN NOT BE OPENED DIRECTLY ::</b>);
    }
    const isOnFullScreen = isFullScreen(this.videoWrapper);

    const video_option   = videos_options2.find((option) => option.value === videos);
    const audio_option   = audiog_options2.find((option) => option.value === audios);

    const inLine = (
      <div className="video video--broadcast" key='v0' ref={(ref) => this.setVideoWrapperRef(ref)} id='video0'
           style={{ height: !attached ? '100%' : null, width: !attached ? '100%' : null }}>
        <div className="video__overlay">
          <div className={`activities ${(isOnFullScreen || !attached) ? 'on_full_browser' : ''}`}>
            <div className="controls">
              <div className="controls__top">
                <button>
                  <Icon name='close' onClick={closeShidur} />
                </button>
              </div>
              <div className="controls__bottom">
                <Dropdown
                  upward
                  floating
                  scrolling
                  icon={null}
                  selectOnBlur={false}
                  trigger={
                    <button>{video_option ? (video_option.value === NO_VIDEO_OPTION_VALUE ? t(video_option.description) : video_option.description) : ''}</button>}
                  className="video-selection"
                >
                  <Dropdown.Menu className='controls__dropdown'>
                    {videos_options2.map((option, i) => {
                      if (option.divider === true) return (<Dropdown.Divider key={i} />);
                      if (option.header === true) return (
                        <Dropdown.Header className='ui blue' icon={option.icon}>
                          {t(option.text)}
                          {(option.description ?
                            <Header as='div' size='tiny' color='grey' content={t(option.description)} /> : '')}
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
                  trigger={<button>{audio_option.icon ?
                    <Icon name={audio_option.icon} /> : ''}{audio_option.text ? `${audio_option.text}` : ''}</button>}
                  className="audio-selection"
                >
                  <Dropdown.Menu className='controls__dropdown'>
                    {audiog_options2.map((option, i) => {
                      if (option.divider === true) return (<Dropdown.Divider key={i} />);
                      if (option.header === true) return (
                        <Dropdown.Header className='ui blue' key={i}>
                          <Icon name={option.icon} />
                          <div>
                            {t(option.text)}
                            <br />
                            {(option.description ?
                              <Header as='span' size='tiny' color='grey' content={t(option.description)} /> : '')}
                          </div>
                        </Dropdown.Header>
                      );
                      return (
                        <Dropdown.Item
                          key={i}
                          text={option.text}
                          selected={option.value === audios}
                          // icon={option.icon}
                          flag={option.flag}
                          description={option.description}
                          action={option.action}
                          onClick={() => this.setAudio(option.value, option.eng_text)}
                        />
                      );
                    })}
                  </Dropdown.Menu>
                </Dropdown>
                <Volume media={virtualStreamingJanus.audioElement} />
                <div className="controls__spacer"></div>
                <button onClick={this.toggleFullScreen}>
                  <Icon name={isFullScreen(this.videoWrapper) ? 'compress' : 'expand'} />
                </button>
                {!attached ? null :
                  <button onClick={this.toggleNewWindow}>
                    <Icon name="external square" />
                  </button>
                }
              </div>

            </div>
            <VirtualWorkshopQuestion layout={isOnFullScreen ? 'fullscreen' : !attached ? 'detached' : layout} />
          </div>
          {talking && <Label className='talk' size='massive' color='red'><Icon name='microphone' />On</Label>}
        </div>
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
    );

    return (
      <Fragment>
        {attached && inLine}
        {!attached &&
        <NewWindow
          features={{ width: '725', height: '635', left: '200', top: '200', location: 'no' }}
          title='V4G' onUnload={this.onUnload} onBlock={this.onBlock}>
          {inLine}
        </NewWindow>
        }
      </Fragment>
    );
  }
}

export default withTranslation()(VirtualStreaming);
