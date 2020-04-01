import React, { Component } from 'react';
import 'semantic-ui-css/semantic.min.css';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { isMobile } from 'react-device-detect';

import './i18n/i18n';
//import GalaxyApp from "./apps/GalaxyApp";
import OldClient from './apps/VirtualApp/OldClient';
import MobileClient from "./apps/MobileApp/MobileClient";
// import VirtualClient from "./apps/VirtualApp/VirtualClient";
// import VirtualStreaming from "./apps/VirtualApp/VirtualStreaming";
// import GroupClient from "./apps/GroupsApp/GroupClient";
// import GalaxyStream from "./apps/StreamApp/GalaxyStream";
// import AdminRoot from "./apps/AdminApp/AdminRoot";
// import AdminShidur from "./apps/AdminApp/AdminShidur";
// import AdminGuest from "./apps/AdminApp/AdminGuest";
// import ShidurApp from "./apps/ShidurApp/ShidurApp";
// import SndmanApp from "./apps/SndmanApp/SndmanApp";
// import AudioOutApp from "./apps/AudioOutApp/AudioOutApp";
// import SDIOutApp from "./apps/SDIOutApp/SDIOutApp";
// import AdminCongress from "./apps/AdminApp/AdminCongress";
// import AdminStreaming from "./apps/AdminApp/AdminStreaming";

class App extends Component {
  render() {
    return (
      <I18nextProvider i18n={i18n}>
        {/*<GalaxyApp />*/}
        {isMobile ? <MobileClient /> : <OldClient />}
        {/*<OldClient />*/}
        {/*<MobileClient/>*/}
        {/*<VirtualClient />*/}
        {/* <VirtualStreaming/>*/}
        {/*<GroupClient/>*/}
        {/* <GalaxyStream/>*/}
        {/*<AdminRoot />*/}
        {/*<AdminShidur />*/}
        {/* <AdminGuest/>*/}
        {/*<ShidurApp/>*/}
        {/*<SndmanApp/>*/}
        {/*<AudioOutApp />*/}
        {/*<SDIOutApp />*/}
        {/*<AdminCongress/>*/}
        {/*<AdminStreaming/>*/}
      </I18nextProvider>
    );
  }
}

export default App;
