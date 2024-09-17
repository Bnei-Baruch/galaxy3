import React, {Component} from "react";
import "semantic-ui-css/semantic.min.css";
import {I18nextProvider} from "react-i18next";
import i18n from "i18next";

import "./i18n/i18n";
// import GalaxyApp from "./apps/GalaxyApp";
// import VirtualMqttClient from "./apps/VirtualApp/VirtualMqttClient";
// import AdminApp from "./apps/AdminApp/AdminApp";
// import ShidurAppMqtt from "./apps/ShidurApp/ShidurAppMqtt";
// import AudioOutMqtt from "./apps/AudioOutApp/AudioOutMqtt";
// import VideoOutMqtt from "./apps/VideoOutApp/VideoOutMqtt";
// import QstOutMqtt from "./apps/VideoOutApp/QstOutMqtt";
import WebOutMqtt from "./apps/WebOutApp/WebOutMqtt";

class App extends Component {
  render() {
    return (
      <I18nextProvider i18n={i18n}>
        {/*{<GalaxyApp />}*/}
        {/*<VirtualMqttClient />*/}
        {/*<AdminApp />*/}
        {/*<ShidurAppMqtt />*/}
        {/*<AudioOutMqtt />*/}
        {/*<VideoOutMqtt />*/}
        {/*<QstOutMqtt />*/}
        <WebOutMqtt />
      </I18nextProvider>
    );
  }
}

export default App;
