import React, { Component, Suspense, lazy } from 'react';
import 'semantic-ui-css/semantic.min.css';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

import './i18n/i18n';

const apps = {
  galaxy: lazy(() => import('./apps/GalaxyApp')),
  virtual: lazy(() => import('./apps/VirtualApp/VirtualMqttClient')),
  admin: lazy(() => import('./apps/AdminApp/AdminApp')),
  shidur: lazy(() => import('./apps/ShidurApp/ShidurAppMqtt')),
  audioout: lazy(() => import('./apps/AudioOutApp/AudioOutMqtt')),
  videoout: lazy(() => import('./apps/VideoOutApp/VideoOutMqtt')),
  qstout: lazy(() => import('./apps/VideoOutApp/QstOutMqtt')),
  webout: lazy(() => import('./apps/WebOutApp/WebOutMqtt')),
};

class App extends Component {
  render() {
    const appName = process.env.REACT_APP_GALAXY_APP || 'virtual';
    const AppComponent = apps[appName] || apps.virtual;

    return (
      <I18nextProvider i18n={i18n}>
        <Suspense fallback={null}>
          <AppComponent />
        </Suspense>
      </I18nextProvider>
    );
  }
}

export default App;
