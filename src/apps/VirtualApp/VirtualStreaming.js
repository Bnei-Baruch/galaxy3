import React, { Component, Fragment } from 'react';
import { Label, Button, Select, Dropdown, Header, Icon } from 'semantic-ui-react';
import VolumeSlider from "../../components/VolumeSlider";
import NewWindow from 'react-new-window';
import {
  videos_options,
  videos_options2,
  audiog_options2,
  audiog_options,
} from '../../shared/consts';
// import '../StreamApp/GalaxyStream.css';
import './BroadcastStream.scss';

class VirtualStreaming extends Component {

  state = {
    videos: Number(localStorage.getItem('vrt_video')) || 1,
    audios: Number(localStorage.getItem('vrt_lang')) || 15,
    room: Number(localStorage.getItem('room')) || null,
    muted: false,
    user: {},
    cssFixInterval: null,
  };

  audioRef(ref) {
    if (ref && (!this.remoteAudio || this.remoteAudio !== ref)) {
      if (!this.remoteAudio) {
        this.props.virtualStreamingJanus.attachAudioStream(ref);
      } else {
        this.props.virtualStreamingJanus.reAttachAudioStream(ref);
      }
      this.remoteAudio = ref;
    }
  }

  trlAudioRef(ref) {
    if (ref && (!this.trlAudio || this.trlAudio !== ref)) {
      if (!this.trlAudio) {
        this.props.virtualStreamingJanus.attachTrlAudioStream(ref);
      } else {
        this.props.virtualStreamingJanus.reAttachTrlAudioStream(ref);
      }
      this.trlAudio = ref;
    }
  }

  videoRef(ref) {
    if (ref && (!this.remoteVideo || this.remoteVideo !== ref)) {
      if (!this.remoteVideo) {
        this.props.virtualStreamingJanus.attachVideoStream(ref);
      } else {
        this.props.virtualStreamingJanus.reAttachVideoStream(ref);
      }
      this.remoteVideo = ref;
    }
  }

  componentDidMount() {
    this.setState({cssFixInterval: setInterval(() => this.cssFix(), 500)});
  };

  cssFix() {
    const d = document.getElementsByClassName('controls__dropdown');
    if (d){
      const o = document.getElementById('video0');
      if (o) {
        Array.from(d).forEach(x => {
          x.style.maxHeight = `${o.offsetHeight-50}px`;
        });
      }
    }
  }

  componentWillUnmount() {
    if (this.state.cssFixInterval) {
      clearInterval(this.state.cssFixInterval);
    }
  };

  setVolume = (value) => {
    this.remoteAudio.volume = value;
  };

  audioMute = () => {
    const { muted } = this.state;
    this.props.virtualStreamingJanus.audioMute(!muted);
    this.setState({muted: !muted});
  };

  toggleFullScreen = () => {
    let vid = this.refs.mediaplayer;
    if (vid.requestFullScreen) {
      vid.requestFullScreen();
    } else if (vid.webkitRequestFullScreen) {
      vid.webkitRequestFullScreen();
    } else if (vid.mozRequestFullScreen) {
      vid.mozRequestFullScreen();
    }
  };

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
    this.setState({videos});
    this.props.virtualStreamingJanus.setVideo(videos);
  }

  setAudio(audios, text) {
    this.setState({audios});
    this.props.virtualStreamingJanus.setAudio(audios, text);
  }

  render() {
    const {
      attached,
    } = this.props;
    const {
      videos,
      audios,
      muted,
      talking,
      room,
    } = this.state;

    if (!room) {
      return (<b> :: THIS PAGE CAN NOT BE OPENED DIRECTLY ::</b>);
    }

    const video_option = videos_options2.find((option) => option.value === videos);
    const audio_option = audiog_options2.find((option) => option.value === audios);

    const inLine = (
      <div className="video video--broadcast" key='v0' ref='video0' id='video0'
           style={{height: !attached ? '100%' : null, width: !attached ? '100%' : null}}>
        <div className="video__overlay">
          <div className="controls">
            <Dropdown
              upward
              floating
              scrolling
              icon={null}
              selectOnBlur={false}
              trigger={<button>{video_option ? `${video_option.description}` : ''}</button>}
              >
              <Dropdown.Menu className='controls__dropdown'>
                {videos_options2.map((option, i) => {
                  if (option.divider === true) return (<Dropdown.Divider key={i}/>);
                  if (option.header === true) return (
                    <Dropdown.Header className='ui blue' icon={option.icon}>
                        {option.text}
                        {(option.description ? <Header as='div' size='tiny' color='grey' content={option.description} /> : '')}
                      </Dropdown.Header>
                  );
                  return (
                    <Dropdown.Item
                    key={i}
                    text={option.text}
                    icon={option.icon}
                    description={option.description}
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
              trigger={<button>{audio_option ? `${audio_option.text}` : ''}</button>}
              >
              <Dropdown.Menu className='controls__dropdown'>
                {audiog_options2.map((option, i) => {
                  if (option.divider === true) return (<Dropdown.Divider key={i}/>);
                  if (option.header === true) return (
                    <Dropdown.Header className='ui blue' icon={option.icon} key={i}>
                      {option.text}
                      {(option.description ? <Header as='div' size='tiny' color='grey' content={option.description} /> : '')}
                    </Dropdown.Header>
                  );
                  return (
                    <Dropdown.Item
                      key={i}
                      text={option.text}
                      icon={option.icon}
                      flag={option.flag}
                      description={option.description}
                      action={option.action}
                      onClick={() => this.setAudio(option.value, option.text)}
                    />
                  );
                })}
              </Dropdown.Menu>
            </Dropdown>

            <button onClick={this.audioMute}>
              <Icon name={muted ? 'volume off' : 'volume up'}/>
            </button>
            {/* <VolumeSlider volume={this.setVolume} /> */}
            <div className="controls__spacer"></div>
            <button onClick={this.toggleFullScreen}>
              <Icon name="expand"/>
            </button>
            {!attached ? null :
              <button onClick={this.toggleNewWindow}>
                <Icon name="external square"/>
              </button>
            }
          </div>
        </div>
        <div className='mediaplayer' ref="mediaplayer">
          <video ref={(ref) => this.videoRef(ref)}
                 id="remoteVideo"
                 width="134"
                 height="100"
                 autoPlay={true}
                 controls={false}
                 muted={true}
                 playsInline={true} />
          {talking && <Label className='talk' size='massive' color='red'>Icon name='microphone' />On</Label>}
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
        <audio ref={(ref) => this.audioRef(ref)}
               id="remoteAudio"
               autoPlay={true}
               controls={false}
               muted={muted}
               playsInline={true} />
        <audio ref={(ref) => this.trlAudioRef(ref)}
               id="trlAudio"
               autoPlay={true}
               controls={false}
               muted={true}
               playsInline={true} />
      </Fragment>
    );
  }
}

export default VirtualStreaming;
