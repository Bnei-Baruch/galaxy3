import React from "react";
import classNames from "classnames";
import {Popup} from "semantic-ui-react";

export const renderNoCam = (mute) => (
  <svg className={classNames("nowebcam", {hidden: !mute})} viewBox="0 0 32 18" preserveAspectRatio="xMidYMid meet">
    <text x="16" y="9" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">
      &#xf2bd;
    </text>
  </svg>
);

export const renderUserName = (display) => (
  <Popup
    content={display}
    mouseEnterDelay={200}
    mouseLeaveDelay={500}
    on="hover"
    trigger={<div className="title-name">{display}</div>}
  />
);

export const renderQuestion = () => (
  <div className="question">
    <svg viewBox="0 0 50 50">
      <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">
        &#xF128;
      </text>
    </svg>
  </div>
);
