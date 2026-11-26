import React, {Component} from "react";
import classNames from "classnames";
import "./StudioBroadcast.scss";

// Studio "broadcast": host1, host2, screen and guest tiles arranged by event.layout.
// All four mountpoints stay watched all the time; the layout only shows/hides
// tiles, so switching is instant (no new watch, no waiting for a keyframe).
//
// Audio rules:
//   hosts  - always audible, also when hidden in the "screen" layout;
//   screen - audible only when visible (a clip played while hidden is not heard);
//   guest  - audible when on air, except for the guest themself (no delayed echo).
class Tile extends Component {
  videoRef = (el) => {
    this.video = el;
    this.attach();
  };

  componentDidUpdate(prevProps) {
    if (prevProps.stream !== this.props.stream) this.attach();
    if (this.video) this.video.muted = !!this.props.muted;
  }

  attach() {
    if (!this.video) return;
    if (this.video.srcObject !== this.props.stream) this.video.srcObject = this.props.stream || null;
    this.video.muted = !!this.props.muted;
    if (this.props.stream) {
      const p = this.video.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }

  render() {
    const {slot, visible, label, stream} = this.props;
    return (
      <div className={classNames("studio-tile", `studio-tile--${slot}`, {"studio-tile--hidden": !visible})}>
        <video ref={this.videoRef} autoPlay playsInline />
        {!stream && visible && <div className="studio-tile__empty" />}
        {label && visible && <div className="studio-tile__label">{label}</div>}
      </div>
    );
  }
}

export default class StudioBroadcast extends Component {
  render() {
    const {streams = {}, layout = "hosts", guest, isGuest} = this.props;
    const screenOn = layout === "screen" || layout === "screen_hosts";
    const hostsOn = layout !== "screen";
    const guestOn = !!guest;

    return (
      <div
        className={classNames("studio-broadcast", `studio-broadcast--${layout}`, {
          "studio-broadcast--guest": guestOn,
        })}
      >
        <Tile slot="screen" stream={streams.screen} visible={screenOn} muted={!screenOn} />
        <div className="studio-broadcast__people">
          <Tile slot="host1" stream={streams.host1} visible={hostsOn} muted={false} />
          <Tile slot="host2" stream={streams.host2} visible={hostsOn} muted={false} />
          <Tile
            slot="guest"
            stream={streams.guest}
            visible={guestOn}
            muted={!guestOn || isGuest}
            label={guestOn ? guest.display : null}
          />
        </div>
      </div>
    );
  }
}
