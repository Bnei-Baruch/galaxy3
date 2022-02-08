import React, {Component} from "react";
import "semantic-ui-css/semantic.min.css";
import {I18nextProvider} from "react-i18next";
import i18n from "i18next";

import "./i18n/i18n";
// import GalaxyApp from "./apps/GalaxyApp";
// import MobileClient from "./apps/MobileApp/MobileClient";
// import GalaxyStream from "./apps/StreamApp/GalaxyStream";
// import VirtualMqttClient from "./apps/VirtualApp/VirtualMqttClient";
// import VirtualHttpClient from "./apps/VirtualApp/VirtualHttpClient";
// import AdminApp from "./apps/AdminApp/AdminApp";
// import ShidurApp from "./apps/ShidurApp/ShidurApp";
// import SndmanApp from "./apps/SndmanApp/SndmanApp";
import AudioOutMqtt from "./apps/AudioOutApp/AudioOutMqtt";
// import SDIOutApp from "./apps/SDIOutApp/SDIOutApp";
// import WebOutApp from "./apps/WebOutApp/WebOutApp";

class App extends Component {
  render() {
    return (
      <I18nextProvider i18n={i18n}>
        {/*{<GalaxyApp />}*/}
        {/*<MobileClient />*/}
        {/*<GalaxyStream />*/}
        {/*<VirtualMqttClient />*/}
        {/*<VirtualHttpClient />*/}
        {/*<AdminApp />*/}
        {/*<ShidurApp />*/}
        {/*<SndmanApp />*/}
        <AudioOutMqtt />
        {/*<SDIOutApp />*/}
        {/*<WebOutApp />*/}
      </I18nextProvider>
    );
  }
}

export default App;
