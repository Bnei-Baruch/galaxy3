import React, { Component } from 'react';
import { Janus } from "./lib/janus";
import {client, getUser} from "../../components/UserManager";
import { Segment, Menu, Select, Button, Grid } from 'semantic-ui-react';
import VolumeSlider from "../../components/VolumeSlider";
import {videos_options, audiog_options, gxycol, trllang, JANUS_SRV_EURFR, STUN_SRV_STR} from "../../shared/consts";
import {geoInfo} from "../../shared/tools";
import LoginPage from "../../components/LoginPage";
import './GalaxyStream.css'


class GalaxyStream extends Component {

    state = {
        janus: null,
        videostream: null,
        audiostream: null,
        datastream: null,
        audio: null,
        videos: Number(localStorage.getItem("video")) || 1,
        audios: Number(localStorage.getItem("lang")) || 15,
        room: Number(localStorage.getItem("room")) || null,
        muted: true,
        mixvolume: null,
        user: null,
        talking: null,
    };

    componentDidMount() {
        getUser(user => {
            if(user) {
                let gxy_public = user.roles.filter(role => role === 'bb_user').length > 0;
                if (gxy_public) {
                    this.setState({user});
                    this.initStream();
                } else {
                    alert("Access denied!");
                    client.signoutRedirect();
                }
            }
        });
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    initStream = () => {
        geoInfo('https://v4g.kbb1.com/geo.php?action=get', info => {
            Janus.log(info);
            let {user} = this.state;
            this.setState({user: {...info,...user}});
            localStorage.setItem("extip", info.external_ip);
            let server = `${JANUS_SRV_EURFR}`;
            // if (info.country_code === "IL") {
            //     server = 'https://v4g.kbb1.com/janustrl';
            // } else {
            //     server = (info.sessions > 400) ? 'https://jnsuk.kbb1.com/janustrl' : 'https://jnseur.kbb1.com/janustrl';
            // }
            this.initJanus(server);
        });
        Janus.init({debug: false, callback: this.initJanus});
    };

    initJanus = (servers) => {
        if(this.state.janus)
           this.state.janus.destroy();
        if(!servers)
            return;
        Janus.log(" -- Going to connect to: " + servers);
        let janus = new Janus({
            server: servers,
            iceServers: [{urls: `${STUN_SRV_STR}`}],
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
            onmessage: (msg, jsep) => {
                this.onStreamingMessage(this.state.trlstream, msg, jsep, false);
            },
            onremotestream: (stream) => {
                Janus.log("Got a remote stream!", stream);
                let audio = this.refs.trlAudio;
                Janus.attachMediaStream(audio, stream);
                this.state.trlstream.getVolume();
                let talking = setInterval(this.ducerMixaudio, 200);
                this.setState({talking});
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
                error: (error) => {
                    Janus.log("WebRTC error: " + error);
                }
            });
        }
    };

    checkData = (json) => {
        let {talk,col,name,ip} = json;
        if(localStorage.getItem("extip") === ip)
            this.streamGalaxy(talk,col,name);
    };

    streamGalaxy = (talk,col,name) => {
        if(talk) {
            let mixvolume = this.refs.remoteAudio.volume;
            this.setState({mixvolume, talking: true});
            let trlaudio = this.refs.trlAudio;
            trlaudio.volume = mixvolume;
            let body = { "request": "switch", "id": gxycol[col] };
            this.state.audiostream.send({"message": body});
            //attachStreamGalaxy(gxycol[json.col],gxyaudio);
            if(name.match(/^(New York|Toronto)$/)) {
                //this.initTranslationStream(303);
            } else {
                this.initTranslationStream(trllang[localStorage.getItem("langtext")] || 303);
            }
            Janus.log("You now talking");
        } else if(this.state.talking) {
            Janus.log("Stop talking");
            clearInterval(this.state.talking);
            this.refs.remoteAudio.volume = this.state.mixvolume;
            let abody = { "request": "switch", "id": Number(localStorage.getItem("lang")) || 15};
            this.state.audiostream.send({"message": abody});
            if(this.state.trlstream) {
                let tbody = { "request": "stop" };
                this.state.trlstream.send({"message": tbody});
                this.state.trlstream.hangup();
            }
            this.setState({talking: null});
        }
    };

    ducerMixaudio = () => {
        let volume = this.state.trlstream.getVolume();
        let audio = this.refs.remoteAudio;
        if (volume > 1000) {
            audio.volume = 0.2;
        } else if (audio.volume + 0.04 <= this.state.mixvolume) {
            audio.volume = audio.volume + 0.04;
        }
        //Janus.log(":: Trl level: " + volume + " :: Current mixvolume: " + audio.volume)
    };

    setVideo = (videos) => {
        this.setState({videos});
        this.state.videostream.send({message: { request: "switch", id: videos }});
        localStorage.setItem("video", videos);
    };

    setAudio = (audios,options) => {
        let text = options.filter(k => k.value === audios)[0].text;
        this.setState({audios});
        this.state.audiostream.send({message: {request: "switch", id: audios}});
        localStorage.setItem("lang", audios);
        localStorage.setItem("langtext", text);
    };

    setVolume = (value) => {
        this.refs.remoteAudio.volume = value;
    };

    audioMute = () => {
        this.setState({muted: !this.state.muted});
        this.refs.remoteAudio.muted = !this.state.muted;
    };

    toggleFullScreen = () => {
        let vid = this.refs.remoteVideo;
        if(vid.requestFullScreen){
            vid.requestFullScreen();
        } else if(vid.webkitRequestFullScreen){
            vid.webkitRequestFullScreen();
        } else if(vid.mozRequestFullScreen){
            vid.mozRequestFullScreen();
        }
    };


    render() {

        const {videos, audios, muted, user, talking} = this.state;

        let login = (<LoginPage user={user} />);
        let content = (
            <Segment compact>
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
                    <video className={talking ? 'talk_border' : ''}
                           ref="remoteVideo"
                           id="remoteVideo"
                           width="640"
                           height="360"
                           autoPlay={true}
                           controls={false}
                           muted={true}
                           playsInline={true}/>

                    <audio ref="remoteAudio"
                           id="remoteAudio"
                           autoPlay={true}
                           controls={false}
                           muted={muted}
                           playsInline={true}/>
                    <audio ref="trlAudio"
                           id="trlAudio"
                           autoPlay={true}
                           controls={false}
                        // muted={muted}
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
