import React, { Component, Fragment } from 'react';
import {
  Label,
  Dropdown,
  Header,
  Icon,
} from 'semantic-ui-react';
import NewWindow from 'react-new-window';
import {
  videos_options2,
  audiog_options2,
} from '../../shared/consts';
// import '../StreamApp/GalaxyStream.css';
import './BroadcastStream.scss';
import Volume from './components/Volume'

class VirtualStreaming extends Component {

  state = {
    videos: Number(localStorage.getItem('vrt_video')) || 1,
    audios: Number(localStorage.getItem('vrt_lang')) || 15,
    room: Number(localStorage.getItem('room')) || null,
    user: {},
    cssFixInterval: null,
    talking: false,
    fullScreen: false,
  };

  videoRef(ref) {
    this.props.virtualStreamingJanus.attachVideoStream(ref);
  }

  componentDidMount() {
    this.props.virtualStreamingJanus.onTalking((talking) => this.setState({talking}));
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

  toggleFullScreen = () => {
    const {fullScreen} = this.state;
    let vid = this.refs.video0;
    if (fullScreen) {
			if (vid.ownerDocument.exitFullscreen) {
				console.log('1exit full screen');
				vid.ownerDocument.exitFullscreen();
			} else if (vid.ownerDocument.webkitExitFullscreen) {
				console.log('2exit full screen');
				vid.ownerDocument.webkitExitFullscreen();
			} else if (vid.ownerDocument.mozCancelFullScreen) {
				console.log('3exit full screen');
				vid.ownerDocument.mozCancelFullScreen();
			}
    } else {
      if (vid.requestFullScreen) {
				console.log('1request full screen');
        vid.requestFullScreen();
      } else if (vid.webkitRequestFullScreen) {
				console.log('2request full screen');
        vid.webkitRequestFullScreen();
      } else if (vid.mozRequestFullScreen) {
				console.log('3request full screen');
        vid.mozRequestFullScreen();
      }
    }
    this.setState({fullScreen: !fullScreen})
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
      virtualStreamingJanus,
    } = this.props;
    const {
			fullScreen,
      audios,
      room,
      talking,
      videos,
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
            <div className="controls__top">
            <button>
                <Icon name='close' />
              </button>
            </div>
            <div className="controls__bottom">
                            <Dropdown
                upward
                floating
                scrolling
                icon={null}
                selectOnBlur={false}
                trigger={<button>{video_option ? `${video_option.description}` : ''}</button>}
                className="video-selection"
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
                trigger={<button>{audio_option.icon ? <Icon name={audio_option.icon}/> : ''}{audio_option.text ? `${audio_option.text}` : ''}</button>}
                className="audio-selection"
                >
                <Dropdown.Menu className='controls__dropdown'>
                  {audiog_options2.map((option, i) => {
                    if (option.divider === true) return (<Dropdown.Divider key={i}/>);
                    if (option.header === true) return (
                      <Dropdown.Header className='ui blue' icon={option.icon} key={i}>
                        <Icon name={option.icon}/>
                        <div>
                        {option.text}
                        <br/>
                        {(option.description ? <Header as='span' size='tiny' color='grey' content={option.description} /> : '')}
                        </div>
                      </Dropdown.Header>
                    );
                    return (
                      <Dropdown.Item
                        key={i}
                        text={option.text}
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
                <Icon name={fullScreen ? 'compress' : 'expand'} />
              </button>
              {!attached ? null :
                <button onClick={this.toggleNewWindow}>
                  <Icon name="external square"/>
                </button>
              }
            </div>
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

export default VirtualStreaming;
