import React, {Component, Fragment} from "react";
import {kc} from "../../components/UserManager";
import {Button, Grid, Icon, Label, Menu, Segment, Select} from "semantic-ui-react";
import VolumeSlider from "../../components/VolumeSlider";
import {audiog_options, gxycol, trllang, videos_options} from "../../shared/consts";
import LoginPage from "../../components/LoginPage";
import "./GalaxyStream.css";
import mqtt from "../../shared/mqtt";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {JanusPlugin} from "../../lib/janus-plugin";

class GalaxyStream extends Component {

  state = {
    Janus: null,
    videoStream: null,
    audioStream: null,
    audio: null,
    videos: Number(localStorage.getItem("gxy_video")) || 1,
    audios: Number(localStorage.getItem("gxy_lang")) || 15,
    room: Number(localStorage.getItem("room")) || null,
    muted: true,
    mixvolume: null,
    user: null,
    talking: null,
    appInitError: null
  };

  checkPermission = (user) => {
    const gxy_user = kc.hasRealmRole("gxy_user");
    if (gxy_user) {
      delete user.roles;
      user.role = gxy_user ? "user" : "public";
      this.initMQTT(user);
    } else {
      alert("Access denied!");
      kc.logout();
    }
  };

  initMQTT = (user) => {
    mqtt.init(user, (data) => {
      console.log("[mqtt] init: ", data);

      let Janus = new JanusMqtt(user, 'str1')
      let videoStream = new JanusPlugin();

      Janus.init().then(data => {
        console.log(data)
        Janus.attach(videoStream).then(data => {
          this.setState({Janus, videoStream, user});
          console.log(data)
          videoStream.watch(1).then(stream => {
            let video = this.refs.remoteVideo;
            video.srcObject = stream;
            console.log(JanusMqtt)
          })
        })
      })

    });
  };

  setVideo = (videos) => {
    this.setState({videos});
    const {videoStream} = this.state;
    if(videoStream) {
      videoStream.switch(videos);
    }
    localStorage.setItem("gxy_video", videos);
  };

  setAudio = (audios, options) => {
    let text = options.filter((k) => k.value === audios)[0].text;
    this.setState({audios});
    localStorage.setItem("gxy_lang", audios);
    localStorage.setItem("gxy_langtext", text);
    const {audioStream} = this.state;
    if(audioStream) {
      audioStream.switch(audios);
    }
  };

  setVolume = (value) => {
    this.refs.remoteAudio.volume = value;
  };

  audioMute = () => {
    const {audioStream, muted} = this.state;
    this.setState({muted: !muted});
    if (!audioStream) {
      const {Janus} = this.state;
      let audioStream = new JanusPlugin();
      Janus.attach(audioStream).then(data => {
        this.setState({audioStream});
        console.log(data)
        audioStream.watch(15).then(stream => {
          let audio = this.refs.remoteAudio;
          audio.srcObject = stream;
        })
      })
      let id = trllang[localStorage.getItem("gxy_langtext")] || 301;
      //this.initTranslationStream(id);
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

  render() {
    const {videos, audios, muted, user, talking, appInitError} = this.state;

    if (appInitError) {
      return (
        <Fragment>
          <h1>Error Initializing Application</h1>
          {`${appInitError}`}
        </Fragment>
      );
    }

    let login = <LoginPage user={user} checkPermission={this.checkPermission} />;
    let content = (
      <Segment compact secondary className="stream_segment">
        <Segment textAlign="center" className="ingest_segment" raised>
          <Menu secondary>
            <Menu.Item>
              <Select
                compact
                error={!videos}
                placeholder="Video:"
                value={videos}
                options={videos_options}
                onChange={(e, {value}) => this.setVideo(value)}
              />
            </Menu.Item>
            <Menu.Item>
              <Select
                compact={false}
                scrolling={false}
                error={!audios}
                placeholder="Audio:"
                value={audios}
                options={audiog_options}
                onChange={(e, {value, options}) => this.setAudio(value, options)}
              />
            </Menu.Item>
            <canvas ref="canvas1" id="canvas1" width="25" height="50" />
          </Menu>
        </Segment>
        <Segment>
          <div className="mediaplayer" ref="mediaplayer">
            <video
              ref="remoteVideo"
              id="remoteVideo"
              width="100%"
              height="100%"
              autoPlay={true}
              controls={false}
              muted={true}
              playsInline={true}
            />
            {talking ? (
              <Label className="talk" size="massive" color="red">
                <Icon name="microphone" />
                On
              </Label>
            ) : (
              ""
            )}
          </div>
          <audio ref="remoteAudio" id="remoteAudio" autoPlay={true} controls={false} muted={muted} playsInline={true} />
          <audio ref="trlAudio" id="trlAudio" autoPlay={true} muted={true} controls={false} playsInline={true} />
        </Segment>
        <Grid columns={3}>
          <Grid.Column width={2}>
            <Button color="blue" icon="expand arrows alternate" onClick={this.toggleFullScreen} />
          </Grid.Column>
          <Grid.Column width={12}>
            <VolumeSlider volume={this.setVolume} />
          </Grid.Column>
          <Grid.Column width={1}>
            <Button
              positive={!muted}
              negative={muted}
              icon={muted ? "volume off" : "volume up"}
              onClick={this.audioMute}
            />
          </Grid.Column>
        </Grid>
      </Segment>
    );

    return <div>{user ? content : login}</div>;
  }
}

export default GalaxyStream;
