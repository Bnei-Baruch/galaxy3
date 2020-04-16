import React, { Component, Fragment } from 'react';
import { Janus } from '../../lib/janus';
import { Label, Button, Select, Dropdown, Header } from 'semantic-ui-react';
import VolumeSlider from "../../components/VolumeSlider";
import NewWindow from 'react-new-window';
import {
  videos_options,
  videos_options2,
  audiog_options2,
  audiog_options,
  GEO_IP_INFO,
  JANUS_SRV_STR3,
  JANUS_SRV_STR4,
  STUN_SRV_STR,
  gxycol,
  trllang,
} from '../../shared/consts';
// import '../StreamApp/GalaxyStream.css';
import './BroadcastStream.scss';

class VirtualStreaming extends Component {

  state = {
    janus: null,
    videostream: null,
    audiostream: null,
    datastream: null,
    audio: null,
    videos: Number(localStorage.getItem('vrt_video')) || 1,
    audios: Number(localStorage.getItem('vrt_lang')) || 15,
    room: Number(localStorage.getItem('room')) || null,
    newWindow: localStorage.getItem('newWindow') || '0',
    muted: true,
    mixvolume: null,
    user: {},
    talking: null,
  };

  componentDidMount() {
    if (this.state.room) {
      fetch(`${GEO_IP_INFO}`)
        .then((response) => {
          if (response.ok) {
            return response.json().then(
              info => {
                let { user } = this.state;
                this.setState({ user: { ...info, ...user } });
                localStorage.setItem('vrt_extip', info.ip);
                let server = info && info.country === "IL" ? `${JANUS_SRV_STR4}` : `${JANUS_SRV_STR3}`;
                // if (info.country_code === "IL") {
                //     server = 'https://v4g.kbb1.com/janustrl';
                // } else {
                //     server = (info.sessions > 400) ? 'https://jnsuk.kbb1.com/janustrl' : 'https://jnseur.kbb1.com/janustrl';
                // }
                this.initJanus(server);
              }
            );
          }
        })
        .catch(ex => console.log(`get geoInfo`, ex));
    }
  };

  componentWillUnmount() {
    if (this.state.janus) {
      this.state.janus.destroy();
    }
  };

  onSuccess() {
    const {setLoading} = this.props;
    const {videostream, audiostream, datastream} = this.state;
    if (videostream && /*audiostream &&*/ datastream) {
      setLoading(false);
    }
  }

  initJanus = (server) => {
    if (this.state.janus) {
      this.state.janus.destroy();
    }
    Janus.init({
      debug: process.env.NODE_ENV !== 'production' ? ['log', 'error'] : ['error'],
      callback: () => {
        let janus = new Janus({
          server: server,
          iceServers: [{ urls: STUN_SRV_STR }],
          success: () => {
            Janus.log(' :: Connected to JANUS');
            console.log(janus);
            this.setState({ janus });
            this.initVideoStream(janus);
            this.initDataStream(janus);
            //this.initAudioStream(janus);
          },
          error: (error) => {
            Janus.log(error);
            setTimeout(() => {
              this.initJanus();
            }, 5000);
            console.log('RELOAD ON ERROR', error);
          },
          destroyed: () => {
            Janus.log('Janus handle successfully destroyed.');
          }
        });
      }
    });
  };

  initVideoStream = (janus) => {
    let { videos } = this.state;
    janus.attach({
      plugin: 'janus.plugin.streaming',
      opaqueId: 'videostream-' + Janus.randomString(12),
      success: (videostream) => {
        Janus.log(videostream);
        this.setState({ videostream });
        videostream.send({ message: { request: 'watch', id: videos } });
        this.onSuccess();
      },
      error: (error) => {
        Janus.log('Error attaching plugin: ' + error);
      },
      iceState: (state) => {
        Janus.log('ICE state changed to ' + state);
      },
      webrtcState: (on) => {
        Janus.log('Janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now');
      },
      slowLink: (uplink, lost, mid) => {
        Janus.log('Janus reports problems ' + (uplink ? 'sending' : 'receiving') +
          ' packets on mid ' + mid + ' (' + lost + ' lost packets)');
      },
      onmessage: (msg, jsep) => {
        this.onStreamingMessage(this.state.videostream, msg, jsep, false);
      },
      onremotetrack: (track, mid, on) => {
        Janus.debug(' ::: Got a remote video track event :::');
        Janus.debug('Remote video track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
        if (!on) {
          return;
        }
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        this.setState({ video_stream: stream });
        Janus.log('Created remote video stream:', stream);
        let video = this.refs.remoteVideo;
        Janus.attachMediaStream(video, stream);
      },
      oncleanup: () => {
        Janus.log('Got a cleanup notification');
      }
    });
  };

  initAudioStream = (janus) => {
    let { audios } = this.state;
    janus.attach({
      plugin: 'janus.plugin.streaming',
      opaqueId: 'audiostream-' + Janus.randomString(12),
      success: (audiostream) => {
        Janus.log(audiostream);
        this.setState({ audiostream });
        audiostream.send({ message: { request: 'watch', id: audios } });
        this.onSuccess();
      },
      error: (error) => {
        Janus.log('Error attaching plugin: ' + error);
      },
      iceState: (state) => {
        Janus.log('ICE state changed to ' + state);
      },
      webrtcState: (on) => {
        Janus.log('Janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now');
      },
      slowLink: (uplink, lost, mid) => {
        Janus.log('Janus reports problems ' + (uplink ? 'sending' : 'receiving') +
          ' packets on mid ' + mid + ' (' + lost + ' lost packets)');
      },
      onmessage: (msg, jsep) => {
        this.onStreamingMessage(this.state.audiostream, msg, jsep, false);
      },
      onremotetrack: (track, mid, on) => {
        Janus.debug(' ::: Got a remote audio track event :::');
        Janus.debug('Remote audio track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
        if (!on) {
          return;
        }
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        this.setState({ audio_stream: stream });
        Janus.log('Created remote audio stream:', stream);
        let audio = this.refs.remoteAudio;
        Janus.attachMediaStream(audio, stream);
      },
      oncleanup: () => {
        Janus.log('Got a cleanup notification');
      }
    });
  };

  initDataStream(janus) {
    janus.attach({
      plugin: 'janus.plugin.streaming',
      opaqueId: 'datastream-' + Janus.randomString(12),
      success: (datastream) => {
        Janus.log(datastream);
        this.setState({ datastream });
        let body = { request: 'watch', id: 101 };
        datastream.send({ 'message': body });
        this.onSuccess();
      },
      error: (error) => {
        Janus.log('Error attaching plugin: ' + error);
      },
      onmessage: (msg, jsep) => {
        this.onStreamingMessage(this.state.datastream, msg, jsep, true);
      },
      ondataopen: () => {
        Janus.log('The DataStreamChannel is available!');
      },
      ondata: (data) => {
        let json = JSON.parse(data);
        Janus.log('We got data from the DataStreamChannel! ', json);
        this.checkData(json);
      },
      onremotestream: (stream) => {
        Janus.log('Got a remote stream!', stream);
      },
      oncleanup: () => {
        Janus.log('Got a cleanup notification');
      }
    });
  };

  initTranslationStream = (streamId) => {
    let { janus } = this.state;
    janus.attach({
      plugin: 'janus.plugin.streaming',
      opaqueId: 'trlstream-' + Janus.randomString(12),
      success: (trlstream) => {
        Janus.log(trlstream);
        this.setState({ trlstream });
        trlstream.send({ message: { request: 'watch', id: streamId } });
      },
      error: (error) => {
        Janus.log('Error attaching plugin: ' + error);
      },
      iceState: (state) => {
        Janus.log('ICE state changed to ' + state);
      },
      webrtcState: (on) => {
        Janus.log('Janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now');
      },
      slowLink: (uplink, lost, mid) => {
        Janus.log('Janus reports problems ' + (uplink ? 'sending' : 'receiving') +
          ' packets on mid ' + mid + ' (' + lost + ' lost packets)');
      },
      onmessage: (msg, jsep) => {
        this.onStreamingMessage(this.state.trlstream, msg, jsep, false);
      },
      onremotetrack: (track, mid, on) => {
        Janus.debug(' ::: Got a remote audio track event :::');
        Janus.debug('Remote audio track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
        if (!on) {
          return;
        }
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        this.setState({ trlaudio_stream: stream });
        Janus.log('Created remote audio stream:', stream);
        let audio = this.refs.trlAudio;
        Janus.attachMediaStream(audio, stream);
      },
      oncleanup: () => {
        Janus.log('Got a cleanup notification');
      }
    });
  };

  onStreamingMessage = (handle, msg, jsep, initdata) => {
    Janus.log('Got a message', msg);

    if (jsep !== undefined && jsep !== null) {
      Janus.log('Handling SDP as well...', jsep);

      // Answer
      handle.createAnswer({
        jsep: jsep,
        media: { audioSend: false, videoSend: false, data: initdata },
        success: (jsep) => {
          Janus.log('Got SDP!', jsep);
          let body = { request: 'start' };
          handle.send({ message: body, jsep: jsep });
        },
        customizeSdp: (jsep) => {
          Janus.debug(':: Modify original SDP: ', jsep);
          jsep.sdp = jsep.sdp.replace(/a=fmtp:111 minptime=10;useinbandfec=1\r\n/g, 'a=fmtp:111 minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1\r\n');
        },
        error: (error) => {
          Janus.log('WebRTC error: ' + error);
        }
      });
    }
  };

  checkData = (json) => {
    let { talk, col, name, ip } = json;
    if (localStorage.getItem('vrt_extip') === ip) {
      this.streamGalaxy(talk, col, name);
    }
  };

  streamGalaxy = (talk, col, name) => {
    if (talk) {
      let mixvolume = this.refs.remoteAudio.volume;
      this.setState({ mixvolume, talking: true });
      let trlaudio    = this.refs.trlAudio;
      trlaudio.volume = mixvolume;
      trlaudio.muted  = false;
      let body        = { 'request': 'switch', 'id': gxycol[col] };
      console.log(' :: Switch STR Stream: ', gxycol[col]);
      this.state.audiostream.send({ 'message': body });
      let id = trllang[localStorage.getItem('vrt_langtext')];
      if (name.match(/^(New York|Toronto)$/) || !id) {
        console.log(' :: Not TRL Stream attach');
      } else {
        let body = { 'request': 'switch', 'id': id };
        this.state.trlstream.send({ 'message': body });
        let talking = setInterval(this.ducerMixaudio, 200);
        this.setState({ talking });
        console.log(' :: Init TRL Stream: ', localStorage.getItem('vrt_langtext'), id);
      }
      Janus.log('You now talking');
    } else if (this.state.talking) {
      Janus.log('Stop talking');
      clearInterval(this.state.talking);
      this.refs.remoteAudio.volume = this.state.mixvolume;
      let id                       = Number(localStorage.getItem('vrt_lang')) || 15;
      let abody                    = { 'request': 'switch', 'id': id };
      console.log(' :: Switch STR Stream: ', localStorage.getItem('vrt_lang'), id);
      this.state.audiostream.send({ 'message': abody });
      console.log(' :: Stop TRL Stream: ');
      let trlaudio   = this.refs.trlAudio;
      trlaudio.muted = true;
      this.setState({ talking: null });
    }
  };

  ducerMixaudio = () => {
    this.state.trlstream.getVolume(null, volume => {
      let audio      = this.refs.remoteAudio;
      let trl_volume = this.state.mixvolume * 0.05;
      if (volume > 0.05) {
        audio.volume = trl_volume;
      } else if (audio.volume + 0.01 <= this.state.mixvolume) {
        audio.volume = audio.volume + 0.01;
      }
      //console.log(":: Trl level: " + volume + " :: Current mixvolume: " + audio.volume + " :: Original mixvolume: " + this.state.mixvolume)
    });
  };

  setVideo = (videos) => {
    this.setState({ videos });
    this.state.videostream.send({ message: { request: 'switch', id: videos } });
    localStorage.setItem('vrt_video', videos);
  };

  setAudio = (audios, text) => {
    this.setState({ audios });
    if (this.state.audiostream) {
      this.state.audiostream.send({ message: { request: 'switch', id: audios } });
    }
    localStorage.setItem('vrt_lang', audios);
    localStorage.setItem('vrt_langtext', text);
  };

  setVolume = (value) => {
    this.refs.remoteAudio.volume = value;
  };

  audioMute = () => {
    const { janus, audiostream, muted } = this.state;
    this.setState({ muted: !muted });
    if (audiostream) {
      muted ? audiostream.muteAudio() : audiostream.unmuteAudio();
    } else {
      this.initAudioStream(janus);
      let id = trllang[localStorage.getItem('vrt_langtext')] || 301;
      this.initTranslationStream(id);
    }
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
    let { newWindow } = this.state;
    newWindow         = newWindow === '0' ? '1' : '0';
    this.setState({ newWindow: newWindow });
    localStorage.setItem('newWindow', newWindow);
    newWindow ? this.props.setDetached() : this.props.setAttached();
  };

  onUnload = () => {
    this.setState({ newWindow: '0' });
    localStorage.setItem('newWindow', '0');
    this.props.setDetached();
  };

  onBlock = () => {
    alert('You browser is blocking our popup! You need to allow it');
  };

  render() {

    const { videos, audios, muted, talking, room, newWindow } = this.state;

    if (!room) {
      return (<b> :: THIS PAGE CAN NOT BE OPENED DIRECTLY ::</b>);
    }

    const inWindow = (
      <NewWindow
        url='https://galaxy.kli.one/gxystr'
        features={{ width: '725', height: '635', left: '200', top: '200', location: 'no' }}
        title='V4G' onUnload={this.onUnload} onBlock={this.onBlock}>
      </NewWindow>
    );

    const video_option = videos_options2.find((option) => option.value === videos);
    const audio_option = audiog_options2.find((option) => option.value === audios);
    
    const inLine = (
      <div className="video video--broadcast" key='v0' ref='video0' id='video0'>
        <div className="video" ref="mediaplayer">
          <div className="video__overlay">
            <Button color='blue'
              icon='expand arrows alternate'
              onClick={this.toggleFullScreen} />
            <Button color='yellow'
              icon='expand arrows alternate'
              onClick={this.toggleNewWindow} />
            <VolumeSlider volume={this.setVolume} />
            <Button positive={!muted}
              negative={muted}
              icon={muted ? 'volume off' : 'volume up'}
              onClick={this.audioMute} />
            {/* <Select
              error={!videos}
              placeholder="Video quality:"
              value={videos}
              options={videos_options}
              onChange={(e, { value }) => this.setVideo(value)} 
            /> */}
            <Dropdown
              selection
              placeholder="Video quality"
              text={video_option ? `${video_option.text} ${video_option.description}` : ''}
              value={videos}
              >
              <Dropdown.Menu>
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
              selection
              placeholder="Audio"
              text={audio_option ? `${audio_option.text}` : ''}
              value={audios}
              >
                <Dropdown.Menu>
                  {audiog_options2.map((option, i) => {
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
                          flag={option.flag}
                          description={option.description}
                          action={option.action}
                          onClick={() => this.setAudio(option.value, option.text)}
                      />
                    );
                  })}
                </Dropdown.Menu>
              </Dropdown>

          </div>
          {/* <div className='mediaplayer' ref="mediaplayer"> */}
          <video ref="remoteVideo"
                 id="remoteVideo"
                 width="134"
                 height="100"
                 autoPlay={true}
                 controls={false}
                 muted={true}
                 playsInline={true} />
          {talking && <Label className='talk' size='massive' color='red'>Icon name='microphone' />On</Label>}
        </div>
        <audio ref="remoteAudio"
               id="remoteAudio"
               autoPlay={true}
               controls={false}
               muted={muted}
               playsInline={true} />
        <audio ref="trlAudio"
               id="trlAudio"
               autoPlay={true}
               controls={false}
               muted={true}
          // muted={muted}
               playsInline={true} />
        {/* </div> */}

        {/* <div className="video__overlay">
          <Segment compact secondary>
            <Grid columns={3}>
              <Grid.Column width={2}>
                <Button color='blue'
                        icon='expand arrows alternate'
                        onClick={this.toggleFullScreen} />
              </Grid.Column>
              <Grid.Column width={2}>
                <Button color='yellow'
                        icon='expand arrows alternate'
                        onClick={this.toggleNewWindow} />
              </Grid.Column>
              <Grid.Column width={12}>
                <VolumeSlider volume={this.setVolume} />
              </Grid.Column>
              <Grid.Column width={1}>
                <Button positive={!muted}
                        negative={muted}
                        icon={muted ? 'volume off' : 'volume up'}
                        onClick={this.audioMute} />
              </Grid.Column>
            </Grid>
            <Segment textAlign='center' className="ingest_segment" raised>
              <Menu secondary>
                <Menu.Item>
                  <Select
                    compact
                    error={!videos}
                    placeholder="Video:"
                    value={videos}
                    options={videos_options}
                    onChange={(e, { value }) => this.setVideo(value)} />
                </Menu.Item>
                <Menu.Item>
                  <Select
                    compact={false}
                    scrolling={false}
                    error={!audios}
                    placeholder="Audio:"
                    value={audios}
                    options={audiog_options}
                    onChange={(e, { value, options }) => this.setAudio(value, options)} />
                </Menu.Item>
                <canvas ref="canvas1" id="canvas1" width="25" height="50" />
              </Menu>
            </Segment>
            <Segment>
              <div className='mediaplayer' ref="mediaplayer">
                <video ref="remoteVideo"
                       id="remoteVideo"
                       width="100%"
                       height="100%"
                       autoPlay={true}
                       controls={false}
                       muted={true}
                       playsInline={true} />
                {talking && <Label className='talk' size='massive' color='red'>Icon name='microphone' />On</Label>}
              </div>
              <audio ref="remoteAudio"
                     id="remoteAudio"
                     autoPlay={true}
                     controls={false}
                     muted={muted}
                     playsInline={true} />
              <audio ref="trlAudio"
                     id="trlAudio"
                     autoPlay={true}
                     controls={false}
                     muted={true}
                // muted={muted}
                     playsInline={true} />
            </Segment>
            <Grid columns={3}>
              <Grid.Column width={2}>
                <Button color='blue'
                        icon='expand arrows alternate'
                        onClick={this.toggleFullScreen} />
              </Grid.Column>
              <Grid.Column width={2}>
                <Button color='yellow'
                        icon='expand arrows alternate'
                        onClick={this.toggleNewWindow} />
              </Grid.Column>
              <Grid.Column width={12}>
                <VolumeSlider volume={this.setVolume} />
              </Grid.Column>
              <Grid.Column width={1}>
                <Button positive={!muted}
                        negative={muted}
                        icon={muted ? 'volume off' : 'volume up'}
                        onClick={this.audioMute} />
              </Grid.Column>
            </Grid>
          </Segment>
        </div> */}
      </div>

    );

    return (
      <Fragment>
        {newWindow === '0' && inLine}
        {newWindow === '1' && inWindow}
      </Fragment>
    );
  }
}

export default VirtualStreaming;
