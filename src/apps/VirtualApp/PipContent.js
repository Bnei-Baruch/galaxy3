import React, {useEffect, useRef} from "react";
import classNames from "classnames";
import {Icon, Radio} from "semantic-ui-react";
import {withTranslation} from "react-i18next";
import "./PipContent.scss";

// Shows a stream that is already played by an element in the main tab.
// Source elements stay in place, so audio and subscriptions are not affected.
// Streams can be replaced (reconnect, cam on/off), so we re-check them periodically.
const MirrorVideo = ({getStream}) => {
  const ref = useRef(null);
  const getStreamRef = useRef(getStream);
  getStreamRef.current = getStream;

  useEffect(() => {
    const sync = () => {
      const video = ref.current;
      const stream = getStreamRef.current() || null;
      if (video && video.srcObject !== stream) {
        video.srcObject = stream;
      }
    };
    sync();
    const interval = setInterval(sync, 1000);
    return () => clearInterval(interval);
  }, []);

  return <video ref={ref} autoPlay playsInline muted/>;
};

const PipTile = ({name, cammute, talking, getStream}) => (
  <div className={classNames("pip__tile", {"pip__tile--talking": talking})}>
    {cammute ? <div className="pip__tile-noise">{name}</div> : <MirrorVideo getStream={getStream}/>}
    <div className="pip__tile-name">
      {!talking && <Icon name="microphone slash" color="red" size="small"/>}
      {name}
    </div>
  </div>
);

const PipContent = (props) => {
  const {
    t,
    view,
    setView,
    shidurOn,
    getShidurStream,
    feeds,
    local,
    getLocalStream,
    micMute,
    backToTab,
  } = props;

  const renderShidur = () =>
    shidurOn ? (
      <div className="pip__shidur">
        <MirrorVideo getStream={getShidurStream}/>
      </div>
    ) : (
      <div className="pip__empty">{t("oldClient.pipNoBroadcast")}</div>
    );

  const renderFeeds = () => (
    <div className="pip__feeds">
      <PipTile name={local.name} cammute={local.cammuted} talking={!local.muted} getStream={getLocalStream}/>
      {feeds.map((feed) => (
        <PipTile
          key={feed.id}
          name={feed.name}
          cammute={feed.cammute}
          talking={feed.talking}
          getStream={feed.getStream}
        />
      ))}
    </div>
  );

  return (
    <div className="pip">
      <div className="pip__main">{view === "feeds" ? renderFeeds() : renderShidur()}</div>
      <div className="pip__bar">
        <button
          className={classNames({"pip__btn--off": local.muted})}
          onClick={micMute}
          title={t(local.muted ? "oldClient.unMute" : "oldClient.mute")}
        >
          <Icon name={local.muted ? "microphone slash" : "microphone"}/>
        </button>
        <div className="pip__switch">
          <span
            className={classNames({"pip__switch--active": view === "shidur"})}
            onClick={() => setView("shidur")}
          >
            {t("oldClient.pipBroadcast")}
          </span>
          <Radio
            toggle
            checked={view === "feeds"}
            onChange={(e, {checked}) => setView(checked ? "feeds" : "shidur")}
          />
          <span
            className={classNames({"pip__switch--active": view === "feeds"})}
            onClick={() => setView("feeds")}
          >
            {t("oldClient.pipFeeds")}
          </span>
        </div>
        <button onClick={backToTab} title={t("oldClient.backToTab")}>
          <Icon name="window restore outline"/>
        </button>
      </div>
    </div>
  );
};

export default withTranslation()(PipContent);
