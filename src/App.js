import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import OldClient from './apps/VirtualApp/OldClient';
// import GalaxyApp from "./apps/GalaxyApp";
// import MobileClient from "./apps/MobileApp/MobileClient";
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
import { resources } from './translations';

// instance for client side
i18n
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: localStorage.getItem('lng') || 'en',

    languages: ['en', 'es', 'he', 'ru'],
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',

    debug: true,

    interpolation: {
      escapeValue: false, // react already safes from xss
    },

    react: {
      useSuspense: false,
    }
  });

class App extends Component {
  render() {
    return (
      <I18nextProvider i18n={i18n}>
        <Fragment>
          {/*<GalaxyApp />*/}
          <OldClient />
          {/*<MobileClient/>*/}
          {/*<VirtualClient />*/}
          {/* <VirtualStreaming/>*/}
          {/*<GroupClient/>*/}
          {/* <GalaxyStream/>*/}
          {/*<AdminRoot />*/}
          {/*<AdminShidur />*/}
          {/* <AdminGuest/>*/}
          {/*<ShidurApp/>*/}
          {/*<AudioOutApp />*/}
          {/*<SndmanApp/>*/}
          {/*<SDIOutApp />*/}
          {/*<AdminCongress/>*/}
          {/*<AdminStreaming/>*/}
        </Fragment>
      </I18nextProvider>
    );
  }
}

export default App;
