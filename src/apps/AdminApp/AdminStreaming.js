import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import { Segment, Menu, Select, Button, Grid } from 'semantic-ui-react';
import VolumeSlider from "../../components/VolumeSlider";
import {admin_videos_options, audios_options, JANUS_SRV_EURFR} from "../../shared/consts";
import './AdminStreaming.css';

class AdminStreaming extends Component {

    state = {
        janus: null,
        videostream: null,
        audiostream: null,
        datastream: null,
        audio: null,
        video: false,
        servers: `${JANUS_SRV_EURFR}`,
        videos: 1,
        audios: 15,
        muted: true,
        started: false
    };

    componentDidMount() {
        // Janus.init({debug: ["debug","log","error"], callback: this.initJanus});
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    startStream = (video) => {
        if(this.state.started)
            return;
        this.setState({started: true, video, videos: video ? 1 : 4});
        Janus.init({debug: ["log","error"], callback: this.initJanus});
        let promise = document.createElement("video").play();
        if(promise instanceof Promise) {
            promise.catch(function(error) {
                console.log("AUTOPLAY ERROR: ", error)
            }).then(function() {});
        }
    };

    initJanus = (servers) => {
        if(this.state.janus)
           this.state.janus.destroy();
        if(!servers)
            servers = this.state.servers;
        Janus.log(" -- Going to connect to: " + servers);
        let janus = new Janus({
            server: servers,
            iceServers: [{urls: "stun:stream.kli.one:3478"}],
            success: () => {
                Janus.log(" :: Connected to JANUS");
                this.state.video ? this.initVideoStream() : this.initAudioStream();
                //this.initDataStream();
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
            iceState: (state) => {
                Janus.log("ICE state changed to " + state);
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            },
            slowLink: (uplink, lost, mid) => {
                Janus.log("Janus reports problems " + (uplink ? "sending" : "receiving") +
                    " packets on mid " + mid + " (" + lost + " lost packets)");
            },
            onmessage: (msg, jsep) => {
                this.onStreamingMessage(this.state.videostream, msg, jsep, false);
            },
            onremotetrack: (track, mid, on) => {
                Janus.debug(" ::: Got a remote video track event :::");
                Janus.debug("Remote video track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                if(this.state.video_stream) return;
                let stream = new MediaStream();
                stream.addTrack(track.clone());
                this.setState({video_stream: stream});
                Janus.log("Created remote video stream:", stream);
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
                audiostream.muteAudio()
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            iceState: (state) => {
                Janus.log("ICE state changed to " + state);
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            },
            slowLink: (uplink, lost, mid) => {
                Janus.log("Janus reports problems " + (uplink ? "sending" : "receiving") +
                    " packets on mid " + mid + " (" + lost + " lost packets)");
            },
            onmessage: (msg, jsep) => {
                this.onStreamingMessage(this.state.audiostream, msg, jsep, false);
            },
            onremotetrack: (track, mid, on) => {
                Janus.debug(" ::: Got a remote audio track event :::");
                Janus.debug("Remote audio track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                if(this.state.audio_stream) return;
                let stream = new MediaStream();
                stream.addTrack(track.clone());
                this.setState({audio_stream: stream});
                Janus.log("Created remote audio stream:", stream);
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
                success: (jsep) => {
                    Janus.log("Got SDP!", jsep);
                    let body = { request: "start" };
                    handle.send({message: body, jsep: jsep});
                },
                customizeSdp: (jsep) => {
                    Janus.debug(":: Modify original SDP: ",jsep);
                    jsep.sdp = jsep.sdp.replace(/a=fmtp:111 minptime=10;useinbandfec=1\r\n/g, 'a=fmtp:111 minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1\r\n');
                },
                error: (error) => {
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
        if(videos === 4) {
            this.state.videostream.hangup();
            this.setState({videos, videostream: null, video_stream: null, video: false});
        } else {
            if(this.state.videostream) {
                this.setState({videos, video: true});
                this.state.videostream.send({message: { request: "switch", id: videos }});
            } else {
                this.setState({videos, video: true}, () => {
                    this.initVideoStream();
                });
            }
        }
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
        if(!this.state.audiostream && this.state.video) {
            this.initAudioStream();
        } else if(!this.state.audiostream && !this.state.video) {
            this.startStream(false);
        }
    };

    toggleFullScreen = () => {
        let vid = this.refs.remoteVideo;
        vid.webkitEnterFullscreen();
    };


  render() {

      const {servers, videos, audios, muted, video} = this.state;

    return (

      <Segment compact color='brown' raised>

          <Segment textAlign='center' className="ingest_segment" raised secondary>
              <Menu secondary size='huge'>
                  <Menu.Item>
                      {/*<Select*/}
                      {/*    error={!servers}*/}
                      {/*    placeholder="Server:"*/}
                      {/*    value={servers}*/}
                      {/*    options={servers_options}*/}
                      {/*    onChange={(e, {value}) => this.setServer(value)} />*/}
                      <Button positive size='big' fluid
                              icon='start'
                              onClick={() => this.startStream(true)} >Start</Button>
                  </Menu.Item>
                  <Menu.Item>
                      <Select
                          compact
                          error={!videos}
                          placeholder="Video:"
                          value={videos}
                          options={admin_videos_options}
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
                  <Menu.Item>
                      <Button positive={!muted} size='huge'
                              negative={muted}
                              icon={muted ? "volume off" : "volume up"}
                              onClick={this.audioMute}/>
                  </Menu.Item>
                  {/*<canvas ref="canvas1" id="canvas1" width="25" height="50" />*/}
              </Menu>
          </Segment>

          { !video ? '' :
          <video ref="remoteVideo"
                 id="remoteVideo"
                 width="100%"
                 height="100%"
                 autoPlay={true}
                 controls={false}
                 muted={true}
                 playsInline={true} /> }

          <audio ref="remoteAudio"
                 id="remoteAudio"
                 autoPlay={true}
                 controls={false}
                 muted={muted} />

          <Grid columns={3}>
              <Grid.Column>
              </Grid.Column>
              <Grid.Column width={14}>
                  <VolumeSlider volume={this.setVolume} />
              </Grid.Column>
              <Grid.Column width={1}>
                  <Button color='blue'
                          icon='expand arrows alternate'
                          onClick={this.toggleFullScreen}/>
              </Grid.Column>
          </Grid>
          {/*<VolumeMeter audioContext={this.remoteAudio.current} width={600} height={200}/>*/}
          {/*<AudioMeter/>*/}
      </Segment>
    );
  }
}

export default AdminStreaming;
