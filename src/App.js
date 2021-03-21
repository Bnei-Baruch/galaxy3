import React, { Component } from 'react';
import 'semantic-ui-css/semantic.min.css';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

import './i18n/i18n';
// import GalaxyApp from "./apps/GalaxyApp";
import MobileClient from "./apps/MobileApp/MobileClient";
// import VirtualClient from './apps/VirtualApp/VirtualClient';
// import GalaxyStream from "./apps/StreamApp/GalaxyStream";
// import AdminRoot from "./apps/AdminApp/AdminRoot";
// import ShidurApp from "./apps/ShidurApp/ShidurApp";
// import SndmanApp from "./apps/SndmanApp/SndmanApp";
// import AudioOutApp from "./apps/AudioOutApp/AudioOutApp";
// import AdminApp from "./apps/AdminApp/AdminApp";
// import SDIOutApp from "./apps/SDIOutApp/SDIOutApp";
// import WebOutApp from "./apps/WebOutApp/WebOutApp";

class App extends Component {
  render() {
    return (
      <I18nextProvider i18n={i18n}>
        {/*{<GalaxyApp />}*/}
        <MobileClient />
        {/*<VirtualClient />*/}
        {/*<GalaxyStream/>*/}
        {/*{<AdminRoot />}*/}
        {/*<AdminApp />*/}
        {/*<ShidurApp />*/}
        {/*<SndmanApp />*/}
        {/*<AudioOutApp />*/}
        {/*<SDIOutApp />*/}
        {/*<WebOutApp />*/}
      </I18nextProvider>
    );
  }
}

export default App;
