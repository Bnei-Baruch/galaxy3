import React, {Component, Fragment} from 'react';
import {Janus} from "../../lib/janus";
import {kc} from "../../components/UserManager";
import {Button, Grid, Icon, Label, Menu, Segment, Select} from 'semantic-ui-react';
import VolumeSlider from "../../components/VolumeSlider";
import {audiog_options, gxycol, trllang, videos_options,} from "../../shared/consts";
import {GEO_IP_INFO} from "../../shared/env";
import LoginPage from "../../components/LoginPage";
import './GalaxyStream.css'
import api from "../../shared/Api";
import GxyJanus from "../../shared/janus-utils";


class GalaxyStream extends Component {

    state = {
        janus: null,
        videostream: null,
        audiostream: null,
        datastream: null,
        audio: null,
        videos: Number(localStorage.getItem("gxy_video")) || 1,
        audios: Number(localStorage.getItem("gxy_lang")) || 15,
        room: Number(localStorage.getItem("room")) || null,
        muted: true,
        mixvolume: null,
        user: null,
        talking: null,
        appInitError: null,
    };

    checkPermission = (user) => {
        const gxy_group = kc.hasRealmRole("gxy_group");
        const gxy_user = kc.hasRealmRole("gxy_user");
        if (gxy_user) {
            delete user.roles;
            user.role = gxy_group ? "group" : gxy_user ? "user" : "public";
            this.initApp(user);
        } else {
            alert("Access denied!");
            kc.logout();
        }
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    initApp = (user) => {
        fetch(`${GEO_IP_INFO}`)
            .then((response) => {
                if (response.ok) {
                    return response.json().then(
                        info => {
                            localStorage.setItem("gxy_extip", info.ip);
                            this.setState({user: {...info,...user}});
                            api.fetchConfig()
                                .then(data => GxyJanus.setGlobalConfig(data))
                                .then(() => this.initJanus(info.country))
                                .catch(err => {
                                    console.error("[GalaxyStream] error initializing app", err);
                                    this.setState({appInitError: err});
                                });
                        }
                    );
                } else {
                    this.setState({appInitError: "Error fetching geo info"});
                }
            })
            .catch(ex => console.log(`get geoInfo`, ex));
    };

    initJanus = (country) => {
        if(this.state.janus)
            this.state.janus.destroy();

        // const gateway = country === "IL" ? 'str4' : 'str3';
        const streamingGateways = GxyJanus.gatewayNames("streaming");
        const gateway = streamingGateways[Math.floor(Math.random() * streamingGateways.length)];
        const config = GxyJanus.instanceConfig(gateway);

        Janus.init({
            debug: process.env.NODE_ENV !== 'production' ? ["log", "error"] : ["error"],
            callback: () => {
                let janus = new Janus({
                    server: config.url,
                    iceServers: config.iceServers,
                    success: () => {
                        Janus.log(" :: Connected to JANUS");
                        this.setState({janus});
                        this.initVideoStream(janus);
                        this.initDataStream(janus);
                        //this.initAudioStream(janus);
                    },
                    error: (error) => {
                        Janus.error(error);
                        setTimeout(() => {
                            window.location.reload();
                        }, 5000);
                    },
                    destroyed: () => {
                        Janus.error("kill");
                        setTimeout(() => {
                            window.location.reload();
                        }, 5000);
                    }
                });
            }
        })
    };

    initVideoStream = (janus) => {
        let {videos} = this.state;
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
                if(!on) return;
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

    initAudioStream = (janus) => {
        let {audios} = this.state;
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
                if(!on) return;
                let stream = new MediaStream();
                stream.addTrack(track.clone());
                this.setState({audio_stream: stream});
                Janus.log("Created remote audio stream:", stream);
                let audio = this.refs.remoteAudio;
                Janus.attachMediaStream(audio, stream);
            },
            oncleanup: () => {
                Janus.log("Got a cleanup notification");
            }
        });
    };

    initDataStream(janus) {
        janus.attach({
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
            ondataopen: () => {
                Janus.log("The DataStreamChannel is available!");
            },
            ondata: (data) => {
                let json = JSON.parse(data);
                Janus.log("We got data from the DataStreamChannel! ", json);
                this.checkData(json);
            },
            onremotestream: (stream) => {
                Janus.log("Got a remote stream!", stream);
            },
            oncleanup: () => {
                Janus.log("Got a cleanup notification");
            }
        });
    };

    initTranslationStream = (streamId) => {
        let {janus} = this.state;
        janus.attach({
            plugin: "janus.plugin.streaming",
            opaqueId: "trlstream-"+Janus.randomString(12),
            success: (trlstream) => {
                Janus.log(trlstream);
                this.setState({trlstream});
                trlstream.send({message: {request: "watch", id: streamId}});
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
                this.onStreamingMessage(this.state.trlstream, msg, jsep, false);
            },
            onremotetrack: (track, mid, on) => {
                Janus.debug(" ::: Got a remote audio track event :::");
                Janus.debug("Remote audio track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                if(!on) return;
                let stream = new MediaStream();
                stream.addTrack(track.clone());
                this.setState({trlaudio_stream: stream});
                Janus.log("Created TRL audio stream:", stream);
                let audio = this.refs.trlAudio;
                Janus.attachMediaStream(audio, stream);
            },
            oncleanup: () => {
                Janus.log("Got a cleanup notification");
            }
        });
    };

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

    checkData = (json) => {
        let {talk,col,name,ip} = json;
        if(localStorage.getItem("gxy_extip") === ip)
            this.streamGalaxy(talk,col,name);
    };

    streamGalaxy = (talk,col,name) => {
        if(talk) {
            let mixvolume = this.refs.remoteAudio.volume;
            this.setState({mixvolume, talking: true});
            let trlaudio = this.refs.trlAudio;
            trlaudio.volume = mixvolume;
            trlaudio.muted = false;
            let body = { "request": "switch", "id": gxycol[col] };
            console.log(" :: Switch STR Stream: ",gxycol[col]);
            this.state.audiostream.send({"message": body});
            let id = trllang[localStorage.getItem("gxy_langtext")];
            if(name.match(/^(New York|Toronto)$/) || !id) {
                console.log(" :: Not TRL Stream attach")
            } else {
                let body = { "request": "switch", "id": id };
                this.state.trlstream.send({"message": body});
                let talking = setInterval(this.ducerMixaudio, 200);
                this.setState({talking});
                console.log(" :: Init TRL Stream: ",localStorage.getItem("gxy_langtext"),id)
            }
            Janus.log("You now talking");
        } else if(this.state.talking) {
            Janus.log("Stop talking");
            clearInterval(this.state.talking);
            this.refs.remoteAudio.volume = this.state.mixvolume;
            let id = Number(localStorage.getItem("gxy_lang")) || 15;
            let abody = { "request": "switch", "id": id};
            console.log(" :: Switch STR Stream: ",localStorage.getItem("gxy_lang"), id);
            this.state.audiostream.send({"message": abody});
            console.log(" :: Stop TRL Stream: ");
            let trlaudio = this.refs.trlAudio;
            trlaudio.muted = true;
            this.setState({talking: null});
        }
    };

    ducerMixaudio = () => {
        this.state.trlstream.getVolume(null, volume => {
            let audio = this.refs.remoteAudio;
            let trl_volume = this.state.mixvolume*0.05;
            if (volume > 0.05) {
                audio.volume = trl_volume;
            } else if (audio.volume + 0.01 <= this.state.mixvolume) {
                audio.volume = audio.volume + 0.01;
            }
            //console.log(":: Trl level: " + volume + " :: Current mixvolume: " + audio.volume + " :: Original mixvolume: " + this.state.mixvolume)
        });
    };

    setVideo = (videos) => {
        this.setState({videos});
        this.state.videostream.send({message: { request: "switch", id: videos }});
        localStorage.setItem("gxy_video", videos);
    };

    setAudio = (audios,options) => {
        let text = options.filter(k => k.value === audios)[0].text;
        this.setState({audios});
        if(this.state.audiostream)
            this.state.audiostream.send({message: {request: "switch", id: audios}});
        localStorage.setItem("gxy_lang", audios);
        localStorage.setItem("gxy_langtext", text);
    };

    setVolume = (value) => {
        this.refs.remoteAudio.volume = value;
    };

    audioMute = () => {
        const {janus,audiostream,muted} = this.state;
        this.setState({muted: !muted});
        if(audiostream) {
            muted ? audiostream.muteAudio() : audiostream.unmuteAudio()
        } else {
            this.initAudioStream(janus);
            let id = trllang[localStorage.getItem("gxy_langtext")] || 301;
            this.initTranslationStream(id);
        }
    };

    toggleFullScreen = () => {
        let vid = this.refs.mediaplayer;
        if(vid.requestFullScreen){
            vid.requestFullScreen();
        } else if(vid.webkitRequestFullScreen){
            vid.webkitRequestFullScreen();
        } else if(vid.mozRequestFullScreen){
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

        let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);
        let content = (
            <Segment compact secondary className="stream_segment">
                <Segment textAlign='center' className="ingest_segment" raised>
                    <Menu secondary>
                        <Menu.Item>
                            <Select
                                compact
                                error={!videos}
                                placeholder="Video:"
                                value={videos}
                                options={videos_options}
                                onChange={(e, {value}) => this.setVideo(value)}/>
                        </Menu.Item>
                        <Menu.Item>
                            <Select
                                compact={false}
                                scrolling={false}
                                error={!audios}
                                placeholder="Audio:"
                                value={audios}
                                options={audiog_options}
                                onChange={(e, {value, options}) => this.setAudio(value, options)}/>
                        </Menu.Item>
                        <canvas ref="canvas1" id="canvas1" width="25" height="50"/>
                    </Menu>
                </Segment>
                <Segment>
                    <div className='mediaplayer' ref="mediaplayer" >
                    <video ref="remoteVideo"
                           id="remoteVideo"
                           width="100%"
                           height="100%"
                           autoPlay={true}
                           controls={false}
                           muted={true}
                           playsInline={true}/>
                        {talking ? <Label className='talk' size='massive' color='red' >
                            <Icon name='microphone' />On
                        </Label> : ''}
                    </div>
                    <audio ref="remoteAudio"
                           id="remoteAudio"
                           autoPlay={true}
                           controls={false}
                           muted={muted}
                           playsInline={true}/>
                    <audio ref="trlAudio"
                           id="trlAudio"
                           autoPlay={true}
                           muted={true}
                           controls={false}
                           playsInline={true}/>
                </Segment>
                <Grid columns={3}>
                    <Grid.Column width={2}>
                        <Button color='blue'
                                icon='expand arrows alternate'
                                onClick={this.toggleFullScreen}/>
                    </Grid.Column>
                    <Grid.Column width={12}>
                        <VolumeSlider volume={this.setVolume}/>
                    </Grid.Column>
                    <Grid.Column width={1}>
                        <Button positive={!muted}
                                negative={muted}
                                icon={muted ? "volume off" : "volume up"}
                                onClick={this.audioMute}/>
                    </Grid.Column>
                </Grid>
            </Segment>
        );

        return (
            <div>
                {user ? content : login}
            </div>
        )
    }
}

export default GalaxyStream;
