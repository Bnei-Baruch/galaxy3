import React, { Component } from 'react';
import { Janus } from "../lib/janus";
import { Segment, Menu, Select, Button, Grid } from 'semantic-ui-react';
import VolumeSlider from "../shared/VolumeSlider";
import {servers_options, videos_options, audios_options} from "../shared/consts";


class AdminStreaming extends Component {

    state = {
        janus: null,
        videostream: null,
        audiostream: null,
        datastream: null,
        audio: null,
        servers: "",
        videos: 1,
        audios: 15,
        muted: true,
    };

    componentDidMount() {
        Janus.init({debug: true, callback: this.initJanus});
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    initJanus = (servers) => {
        if(this.state.janus)
           this.state.janus.destroy();
        if(!servers)
            return;
        Janus.log(" -- Going to connect to: " + servers);
        let janus = new Janus({
            server: servers,
            iceServers: [{urls: "stun:jnsuk.kbb1.com:3478"}],
            success: () => {
                Janus.log(" :: Connected to JANUS");
                this.initVideoStream();
                this.initDataStream();
                this.initAudioStream();
            },
            error: (error) => {
                Janus.log(error);
            },
            destroyed: () => {
                Janus.log("kill");
            }
        });
        this.setState({janus});
    };

    initVideoStream = () => {
        let {janus,videos} = this.state;
        janus.attach({
            plugin: "janus.plugin.streaming",
            opaqueId: "videostream-"+Janus.randomString(12),
            success: (videostream) => {
                Janus.log(videostream);
                this.setState({videostream});
                videostream.send({message: {request: "watch", id: videos}});
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            onmessage: (msg, jsep) => {
                this.onStreamingMessage(this.state.videostream, msg, jsep, false);
            },
            onremotestream: (stream) => {
                Janus.log("Got a remote stream!", stream);
                let video = this.refs.remoteVideo;
                Janus.attachMediaStream(video, stream);
            },
            oncleanup: () => {
                Janus.log("Got a cleanup notification");
            }
        });
    };

    initAudioStream = () => {
        let {janus,audios} = this.state;
        janus.attach({
            plugin: "janus.plugin.streaming",
            opaqueId: "audiostream-"+Janus.randomString(12),
            success: (audiostream) => {
                Janus.log(audiostream);
                this.setState({audiostream});
                audiostream.send({message: {request: "watch", id: audios}});
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            onmessage: (msg, jsep) => {
                this.onStreamingMessage(this.state.audiostream, msg, jsep, false);
            },
            onremotestream: (stream) => {
                Janus.log("Got a remote stream!", stream);
                let audio = this.refs.remoteAudio;
                Janus.attachMediaStream(audio, stream);
                //StreamVisualizer2(stream, this.refs.canvas1.current,50);
            },
            oncleanup: () => {
                Janus.log("Got a cleanup notification");
            }
        });
    };

    initDataStream() {
        this.state.janus.attach({
            plugin: "janus.plugin.streaming",
            opaqueId: "datastream-"+Janus.randomString(12),
            success: (datastream) => {
                Janus.log(datastream);
                this.setState({datastream});
                let body = { request: "watch", id: 101 };
                datastream.send({"message": body});
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            onmessage: (msg, jsep) => {
                this.onStreamingMessage(this.state.datastream, msg, jsep, true);
            },
            ondataopen: (data) => {
                Janus.log("The DataStreamChannel is available!");
            },
            ondata: (data) => {
                let json = JSON.parse(data);
                Janus.log("We got data from the DataStreamChannel! ", json);
                //checkData();
            },
            onremotestream: (stream) => {
                Janus.log("Got a remote stream!", stream);
            },
            oncleanup: () => {
                Janus.log("Got a cleanup notification");
            }
        });
    }

    onStreamingMessage = (handle, msg, jsep, initdata) => {
        Janus.log("Got a message", msg);

        if(jsep !== undefined && jsep !== null) {
            Janus.log("Handling SDP as well...", jsep);

            // Answer
            handle.createAnswer({
                jsep: jsep,
                media: { audioSend: false, videoSend: false, data: initdata },
                success: function(jsep) {
                    Janus.log("Got SDP!", jsep);
                    let body = { request: "start" };
                    handle.send({message: body, jsep: jsep});
                },
                error: function(error) {
                    Janus.log("WebRTC error: " + error);
                }
            });
        }
    };

    setServer = (servers) => {
        Janus.log(servers);
        this.setState({servers});
        this.initJanus(servers);
    };

    setVideo = (videos) => {
        Janus.log(videos);
        this.setState({videos});
        this.state.videostream.send({message: { request: "switch", id: videos }});
    };

    setAudio = (audios) => {
        Janus.log(audios);
        this.setState({audios});
        this.state.audiostream.send({message: {request: "switch", id: audios}});
    };

    setVolume = (value) => {
        this.refs.remoteAudio.volume = value;
    };

    audioMute = () => {
        this.setState({muted: !this.state.muted});
        this.refs.remoteAudio.muted = !this.state.muted;
    };


  render() {

      const {servers, videos, audios, muted} = this.state;

    return (

      <Segment compact>

          <Segment textAlign='center' className="ingest_segment" raised>
              <Menu secondary>
                  <Menu.Item>
                      <Select
                          error={!servers}
                          placeholder="Server:"
                          value={servers}
                          options={servers_options}
                          onChange={(e, {value}) => this.setServer(value)} />
                  </Menu.Item>
                  <Menu.Item>
                      <Select
                          compact
                          error={!videos}
                          placeholder="Video:"
                          value={videos}
                          options={videos_options}
                          onChange={(e,{value}) => this.setVideo(value)} />
                  </Menu.Item>
                  <Menu.Item>
                      <Select
                          compact={false}
                          error={!audios}
                          placeholder="Audio:"
                          value={audios}
                          options={audios_options}
                          onChange={(e,{value}) => this.setAudio(value)} />
                  </Menu.Item>
                  <canvas ref="canvas1" id="canvas1" width="25" height="50" />
              </Menu>
          </Segment>

          <video ref="remoteVideo"
                 id="remoteVideo"
                 width="640"
                 height="360"
                 autoPlay={true}
                 controls={true}
                 muted={true}
                 playsInline={true} />

          <audio ref="remoteAudio"
                 id="remoteAudio"
                 autoPlay={true}
                 controls={false}
                 muted={muted}
                 playsInline={true} />

          <Grid columns={3}>
              <Grid.Column>
              </Grid.Column>
              <Grid.Column width={14}>
                  <VolumeSlider volume={this.setVolume} />
              </Grid.Column>
              <Grid.Column width={1}>
                  <Button positive={!muted}
                          negative={muted}
                          icon={muted ? "volume off" : "volume up"}
                          onClick={this.audioMute}/>
              </Grid.Column>
          </Grid>
          {/*<VolumeMeter audioContext={this.remoteAudio.current} width={600} height={200}/>*/}
          {/*<AudioMeter/>*/}
      </Segment>
    );
  }
}

export default AdminStreaming;
