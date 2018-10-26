import React, { Component } from 'react';
import NewWindow from 'react-new-window';
import { Janus } from "../lib/janus";
import {Segment, Menu, Select, Button,Sidebar,Input,Label} from "semantic-ui-react";
import {geoInfo, initJanus, checkDevices, micLevel, checkNotification} from "../shared/tools";
import '../shared/VideoConteiner.scss'
import {MAX_FEEDS} from "../shared/consts";
import nowebcam from './nowebcam.jpeg';
import ChatClient from "./ChatClient";
// import VirtualStreaming from './VirtualStreaming';

class VirtualClient extends Component {

    state = {
        count: 0,
        audioContext: null,
        audio_devices: [],
        video_devices: [],
        audio_device: "",
        video_device: "",
        janus: null,
        feeds: [],
        rooms: [],
        room: "",
        selected_room: "",
        videoroom: null,
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        audio: null,
        muted: false,
        cammuted: false,
        shidur: false,
        user: {},
        username_value: localStorage.getItem("username") || "",
        visible: false
    };

    componentDidMount() {
        let {user} = this.state;
        checkNotification();
        geoInfo('https://v4g.kbb1.com/geo.php?action=get', data => {
            Janus.log(data);
            user.ip = data.external_ip;
        });
        initJanus(janus => {
            user.session = janus.getSessionId();
            this.setState({janus, user});
            this.initVideoRoom();
        });
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    initDevices = () => {
        navigator.mediaDevices.enumerateDevices().then(devices => {
            Janus.log(" :: Got devices: ", devices);
            if (devices.length === 0) {
                alert(":: NO input devices found :(");
                return
            }
            let audio_devices = devices.filter(device => device.kind === "audioinput");
            let video_devices = devices.filter(device => device.kind === "videoinput");
            if (video_devices.length === 0) {
                Janus.log(" :: No Video input device found!");
                this.setState({audio_devices});
                this.setAudioDevice(audio_devices[0].deviceId);
            } else if (audio_devices.length === 0) {
                Janus.log(" :: No Audio input device found!");
                this.setState({video_devices});
                this.setVideoDevice(video_devices[0].deviceId);
            } else {
                this.setState({audio_devices, video_devices});
                this.setVideoDevice(video_devices[0].deviceId);
                this.setAudioDevice(audio_devices[0].deviceId);
            }
        });
    };

    setVideoDevice = (video_device) => {
        if(video_device !== this.state.video_device) {
            this.setState({video_device});
            if(this.state.video_device !== "") {
                checkDevices(this.state.audio_device,video_device,stream => {
                    Janus.log(" :: Check Devices: ", stream);
                    let myvideo = this.refs.localVideo;
                    Janus.attachMediaStream(myvideo, stream);
                })
            }
        }
    };

    setAudioDevice = (audio_device) => {
        if(audio_device !== this.state.audio_device) {
            this.setState({audio_device});
            if(this.state.audio_device !== "") {
                checkDevices(audio_device,this.state.video_device,stream => {
                    Janus.log(" :: Check Devices: ", stream);
                    let myvideo = this.refs.localVideo;
                    Janus.attachMediaStream(myvideo, stream);
                    if(this.state.audioContext) {
                        this.state.audioContext.close();
                    }
                    micLevel(stream ,this.refs.canvas1,audioContext => {
                        this.setState({audioContext});
                    });
                })
            }
        }
    };

    getRoomList = () => {
        const {videoroom} = this.state;
        if (videoroom) {
            videoroom.send({message: {request: "list"},
                success: (data) => {
                    Janus.log(" :: Get Rooms List: ", data.list)
                    data.list.sort((a, b) => {
                        // if (a.num_participants > b.num_participants) return -1;
                        // if (a.num_participants < b.num_participants) return 1;
                        if (a.description > b.description) return 1;
                        if (a.description < b.description) return -1;
                        return 0;
                    });
                    this.setState({rooms: data.list});
                }
            });
        }
    };

    initVideoRoom = () => {
        if(this.state.videoroom)
            this.state.videoroom.detach();
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "videoroom_user",
            success: (videoroom) => {
                Janus.log(" :: My handle: ", videoroom);
                Janus.log("Plugin attached! (" + videoroom.getPlugin() + ", id=" + videoroom.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;
                user.handle = videoroom.getId();
                this.setState({videoroom, user});

                Janus.listDevices(this.initDevices, { audio: true, video: false });
                //this.initDevices();
                // Get list rooms
                this.getRoomList();
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            consentDialog: (on) => {
                Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
            },
            mediaState: (medium, on) => {
                Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                    //sfutest.send({"message": { "request": "configure", "bitrate": bitrate }});
                    //return false;
            },
            onmessage: (msg, jsep) => {
                this.onMessage(this.state.videoroom, msg, jsep, false);
            },
            onlocalstream: (mystream) => {
                Janus.debug(" ::: Got a local stream :::");
                let {videoroom} = this.state;
                Janus.log(mystream);
                // Janus.log(" -- GOT AUDIO TRACK: ", mystream.getAudioTracks()[0])
                // mystream.getAudioTracks()[0].enabled = false;
                videoroom.muteAudio();
                this.setState({mystream});
                let myvideo = this.refs.localVideo;
                Janus.attachMediaStream(myvideo, mystream);
                if(videoroom.webrtcStuff.pc.iceConnectionState !== "completed" &&
                    videoroom.webrtcStuff.pc.iceConnectionState !== "connected") {
                    Janus.debug("Publishing... ");
                }
                let videoTracks = mystream.getVideoTracks();
                if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                    Janus.debug("No webcam");
                } else {
                    Janus.debug("Yes webcam");
                }
            },
            onremotestream: (stream) => {
                // The publisher stream is sendonly, we don't expect anything here
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
            }
        });
    };

    newRemoteFeed = (id, talk) => {
        // A new feed has been published, create a new plugin handle and attach to it as a subscriber
        var remoteFeed = null;
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "remotefeed_user",
                success: (pluginHandle) => {
                    remoteFeed = pluginHandle;
                    remoteFeed.simulcastStarted = false;
                    Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                    Janus.log("  -- This is a subscriber");

                    let listen = { "request": "join", "room": this.state.room, "ptype": "subscriber", "feed": id, "private_id": this.state.mypvtid };
                    remoteFeed.send({"message": listen});
                },
                error: (error) => {
                    Janus.error("  -- Error attaching plugin...", error);
                },
                onmessage: (msg, jsep) => {
                    Janus.debug(" ::: Got a message (subscriber) :::");
                    Janus.debug(msg);
                    let event = msg["videoroom"];
                    Janus.debug("Event: " + event);
                    if(msg["error"] !== undefined && msg["error"] !== null) {
                        Janus.debug(":: Error msg: " + msg["error"]);
                    } else if(event !== undefined && event !== null) {
                        if(event === "attached") {
                            // Subscriber created and attached
                            let {feeds} = this.state;
                            for(let i=1;i<MAX_FEEDS;i++) {
                                if(feeds[i] === undefined || feeds[i] === null) {
                                    remoteFeed.rfindex = i;
                                    remoteFeed.rfid = msg["id"];
                                    remoteFeed.rfuser = JSON.parse(msg["display"]);
                                    remoteFeed.talk = talk;
                                    feeds[i] = remoteFeed;
                                    break;
                                }
                            }
                            this.setState(feeds);
                            Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") in room " + msg["room"]);
                        }
                    }
                    if(jsep !== undefined && jsep !== null) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        // Answer and attach
                        remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                // Add data:true here if you want to subscribe to datachannels as well
                                // (obviously only works if the publisher offered them in the first place)
                                media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { "request": "start", "room": this.state.room };
                                    remoteFeed.send({"message": body, "jsep": jsep});
                                },
                                error: (error) => {
                                    Janus.error("WebRTC error:", error);
                                }
                            });
                    }
                },
                webrtcState: (on) => {
                    Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
                },
                onlocalstream: (stream) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                },
                onremotestream: (stream) => {
                    Janus.debug("Remote feed #" + remoteFeed.rfindex);
                    let remotevideo = this.refs["remoteVideo" + remoteFeed.rfid];
                    // if(remotevideo.length === 0) {
                    //     // No remote video yet
                    // }
                    Janus.attachMediaStream(remotevideo, stream);
                    var videoTracks = stream.getVideoTracks();
                    if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                        // No remote video
                    } else {
                        // Yes remote video
                    }
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
                }
            });
    };

    publishOwnFeed = (useAudio) => {
        // Publish our stream
        let {videoroom,audio_device,video_device} = this.state;
        let height = (Janus.webRTCAdapter.browserDetails.browser === "safari") ? 480 : 360;
        videoroom.createOffer(
            {
                // Add data:true here if you want to publish datachannels as well
                media: {
                    audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true, audio: {
                        deviceId: {
                            exact: audio_device
                        }
                    },
                    video: {
                        width: 640,
                        height: height,
                        deviceId: {
                            exact: video_device
                        }
                    }
                },
                //media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true },	// Publishers are sendonly
                simulcast: false,
                success: (jsep) => {
                    Janus.debug("Got publisher SDP!");
                    Janus.debug(jsep);
                    let publish = { "request": "configure", "audio": useAudio, "video": true };
                    videoroom.send({"message": publish, "jsep": jsep});
                },
                error: (error) => {
                    Janus.error("WebRTC error:", error);
                    if (useAudio) {
                        this.publishOwnFeed(false);
                    } else {
                        Janus.error("WebRTC error... " + JSON.stringify(error));
                    }
                }
            });
    };

    onMessage = (videoroom, msg, jsep, initdata) => {
        Janus.debug(" ::: Got a message (publisher) :::");
        Janus.debug(msg);
        let event = msg["videoroom"];
        Janus.debug("Event: " + event);
        if(event !== undefined && event !== null) {
            if(event === "joined") {
                // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                this.setState({myid ,mypvtid});
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                this.publishOwnFeed(true);
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    let feeds_list = list.filter(feeder => JSON.parse(feeder.display).role === "user");
                    Janus.log(":: Got Pulbishers list: ", feeds_list);
                    if(feeds_list.length > 11) {
                        alert("Max users in this room is reached");
                        window.location.reload();
                    }
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(list);
                    for(let f in feeds_list) {
                        let id = feeds_list[f]["id"];
                        let display = JSON.parse(feeds_list[f]["display"]);
                        let talk = feeds_list[f]["talking"];
                        Janus.debug("  >> [" + id + "] " + display);
                        this.newRemoteFeed(id, talk);
                    }
                }
            } else if(event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                //let room = msg["room"];
                Janus.log("User: "+id+" - start talking");
                for(let i=1; i<MAX_FEEDS; i++) {
                    if(feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === id) {
                        feeds[i].talk = true;
                    }
                }
                this.setState({feeds});
            } else if(event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                //let room = msg["room"];
                Janus.log("User: "+id+" - stop talking");
                for(let i=1; i<MAX_FEEDS; i++) {
                    if(feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === id) {
                        feeds[i].talk = false;
                    }
                }
                this.setState({feeds});
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list);
                    for(let f in list) {
                        let id = list[f]["id"];
                        let display = JSON.parse(list[f]["display"]);
                        Janus.debug("  >> [" + id + "] " + display);
                        if(display.role === "user")
                            this.newRemoteFeed(id, false);
                    }
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let {feeds} = this.state;
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    let remoteFeed = null;
                    for(let i=1; i<MAX_FEEDS; i++) {
                        if(feeds[i] != null && feeds[i] !== undefined && feeds[i].rfid === leaving) {
                            remoteFeed = feeds[i];
                            break;
                        }
                    }
                    if(remoteFeed != null) {
                        Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") has left the room, detaching");
                        feeds[remoteFeed.rfindex] = null;
                        remoteFeed.detach();
                    }
                    this.setState({feeds});
                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    // One of the publishers has unpublished?
                    let {feeds} = this.state;
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        videoroom.hangup();
                        return;
                    }
                    let remoteFeed = null;
                    for(let i=1; i<MAX_FEEDS; i++) {
                        if(feeds[i] != null && feeds[i] !== undefined && feeds[i].rfid === unpublished) {
                            remoteFeed = feeds[i];
                            break;
                        }
                    }
                    if(remoteFeed !== null) {
                        Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") has left the room, detaching");
                        feeds[remoteFeed.rfindex] = null;
                        remoteFeed.detach();
                    }
                } else if(msg["error"] !== undefined && msg["error"] !== null) {
                    if(msg["error_code"] === 426) {
                        Janus.log("This is a no such room");
                    } else {
                        Janus.log(msg["error"]);
                    }
                }
            }
        }
        if(jsep !== undefined && jsep !== null) {
            Janus.debug("Handling SDP as well...");
            Janus.debug(jsep);
            videoroom.handleRemoteJsep({jsep: jsep});
        }
    };

    joinRoom = () => {
        let {videoroom, selected_room, user, username_value} = this.state;
        localStorage.setItem("room", selected_room);
        user.role = "user";
        user.display = username_value || "user-"+Janus.randomString(4);
        user.name = user.display;
        localStorage.setItem("username", user.display);
        let register = { "request": "join", "room": selected_room, "ptype": "publisher", "display": JSON.stringify(user) };
        videoroom.send({"message": register});
        this.setState({user, muted: true, room: selected_room});
    };

    exitRoom = () => {
        let {videoroom, room} = this.state;
        let leave = {request : "leave"};
        Janus.log(room);
        videoroom.send({"message": leave});
        this.setState({muted: false, mystream: null, room: "", selected_room: "", i: "", feeds: []});
        this.initVideoRoom();
    };

    selectRoom = (i) => {
        const {rooms} = this.state;
        let selected_room = rooms[i].room;
        let name = rooms[i].description;
        if (this.state.room === selected_room)
            return;
        this.setState({selected_room,name,i});
    };

    registerUsername = (i) => {
        Janus.log(i);
        let {videoroom, rooms, user} = this.state;
        let room = rooms[i].room;
        let name = rooms[i].description;
        user.role = "user";
        user.display = "user-"+Janus.randomString(4);
        let register = { "request": "join", "room": room, "ptype": "publisher", "display": JSON.stringify(user) };
        videoroom.send({"message": register});
        this.setState({room,name,user,i});
    };

    camMute = () => {
        let {videoroom,cammuted} = this.state;
        cammuted ? videoroom.unmuteVideo() : videoroom.muteVideo();
        this.setState({cammuted: !cammuted});
    };

    micMute = () => {
        let {videoroom, muted} = this.state;
        //mystream.getAudioTracks()[0].enabled = !muted;
        muted ? videoroom.unmuteAudio() : videoroom.muteAudio();
        this.setState({muted: !muted});
    };

    showShidur = () => {
        this.setState({shidur: !this.state.shidur})
    };

    onUnload = () => {
        this.setState({shidur: false})
    };

    onBlock = () => {
        alert("You browser is block our popup! You need allow it")
    };

    onNewMsg = () => {
        this.setState({count: this.state.count + 1});
    };


  render() {
      //Janus.log(" --- ::: RENDER ::: ---");
      const { rooms,room,audio_devices,video_devices,video_device,audio_device,i,muted,cammuted,mystream,selected_room,count} = this.state;
      const width = "134";
      const height = "100";
      const autoPlay = true;
      const controls = false;
      //const vmuted = true;

      let rooms_list = rooms.map((data,i) => {
          const {room, num_participants, description} = data;
          return ({ key: room, text: description, value: i, description: num_participants.toString()})
      });

      let adevices_list = audio_devices.map((device,i) => {
          const {label, deviceId} = device;
          return ({ key: i, text: label, value: deviceId})
      });

      let vdevices_list = video_devices.map((device,i) => {
          const {label, deviceId} = device;
          return ({ key: i, text: label, value: deviceId})
      });

      let videos = this.state.feeds.map((feed) => {
          if(feed) {
              let id = feed.rfid;
              let talk = feed.talk;
              return (<div className="video"
                           key={"v" + id}
                           ref={"video" + id}
                           id={"video" + id}>
                  <video className={talk ? "talk" : ""}
                         poster={nowebcam}
                         key={id}
                         ref={"remoteVideo" + id}
                         id={"remoteVideo" + id}
                         width={width}
                         height={height}
                         autoPlay={autoPlay}
                         controls={controls}
                         playsInline={true}/>
              </div>);
          }
          return true;
      });

      let l = (<Label key='Carbon' circular size='mini' color='red'>{count}</Label>);

      return (

          <Segment className="virtual_segment" color='blue' raised>

              <Segment textAlign='center' className="ingest_segment">
                  <Menu secondary>
                      <Menu.Item>
                          <Menu.Item >
                              <Button disabled={!mystream}
                                      icon='user x'
                                      onClick={this.exitRoom} />
                          </Menu.Item>
                          <Select className='room_selection'
                              disabled={mystream}
                              error={!selected_room}
                              scrolling
                              placeholder="Select Room:"
                              value={i}
                              options={rooms_list}
                              onClick={this.getRoomList}
                              onChange={(e, {value}) => this.selectRoom(value)} />
                          <Input className='name_selection'
                                 disabled={mystream}
                                 icon='user circle' fluid
                                 placeholder="Type your name..."
                                 value={this.state.username_value}
                                 onChange={(v,{value}) => this.setState({username_value: value})} />
                          :
                          <Button disabled={mystream}
                                  positive
                                  icon='add user'
                                  onClick={this.joinRoom} />
                      </Menu.Item>
                      <Menu.Item >
                          <Select className='select_device'
                                  disabled={mystream}
                                  error={!video_device}
                                  placeholder="Select Device:"
                                  value={video_device}
                                  options={vdevices_list}
                                  onChange={(e, {value}) => this.setVideoDevice(value)} />
                          :
                          <Button disabled={!mystream}
                                  positive={!cammuted}
                                  negative={cammuted}
                                  icon={!cammuted ? "video camera" : "eye slash"}
                                  onClick={this.camMute}/>
                      </Menu.Item>
                      <Menu.Item >
                          <Select className='select_device'
                                  disabled={mystream}
                                  error={!audio_device}
                                  placeholder="Select Device:"
                                  value={audio_device}
                                  options={adevices_list}
                                  onChange={(e, {value}) => this.setAudioDevice(value)}/>
                          :
                          <Button disabled={!mystream}
                                  positive={!muted}
                                  negative={muted}
                                  icon={!muted ? "microphone" : "microphone slash"}
                                  onClick={this.micMute}/>
                          <canvas className={muted ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15" height="35" />
                      </Menu.Item>
                      <Menu.Item >
                          <Button color='blue' disabled={this.state.shidur} onClick={this.showShidur} icon='tv' />
                          {this.state.shidur ?
                              <NewWindow
                                  url='https://v4g.kbb1.com/gxystr'
                                  features={{width:"725",height:"635",left:"200",top:"200",location:"no"}}
                                  title='V4G' onUnload={this.onUnload} onBlock={this.onBlock}>
                                  {/*<VirtualStreaming />*/}
                              </NewWindow> :
                              null
                          }
                      </Menu.Item>
                  </Menu>
              </Segment>
              <Sidebar.Pushable as={Segment}>

                  <Sidebar
                      as={Segment}
                      direction='right'
                      animation='overlay'
                      // onHide={this.handleSidebarHide}
                      vertical
                      visible={this.state.visible}
                      width='wide'
                  >
                      <ChatClient
                          visible={this.state.visible}
                          janus={this.state.janus}
                          room={room}
                          user={this.state.user}
                            onNewMsg={this.onNewMsg} />
                  </Sidebar>

                  <Sidebar.Pusher>
                      <Button attached='top' size='mini' toggle compact disabled={!mystream}
                              onClick={() => this.setState({ visible: !this.state.visible, count: 0 })}>
                          {this.state.visible ? "Close" : "Open"} chat {count > 0 ? l : ""}</Button>
                      <Segment attached className="videos_segment"
                               onDoubleClick={() => this.setState({ visible: !this.state.visible })} >
                          <div className="wrapper">
                              {/*<div className="title"><span>{name}</span></div>*/}
                              <div className="videos">
                                  <div className="videos__wrapper">
                                      <div className="video">
                                          <video className='mirror' ref="localVideo"
                                                 id="localVideo"
                                                 poster={nowebcam}
                                                 width={width}
                                                 height={height}
                                                 autoPlay={autoPlay}
                                                 controls={controls}
                                                 muted={true}
                                                 playsInline={true}/>
                                      </div>
                                      {videos}
                                  </div>
                              </div>
                          </div>
                      </Segment>

                  </Sidebar.Pusher>
              </Sidebar.Pushable>
          </Segment>

    );
  }
}

export default VirtualClient;
