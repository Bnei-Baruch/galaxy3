import React, { Component } from 'react';
import 'semantic-ui-css/semantic.min.css';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

import './i18n/i18n';
import GalaxyApp from './apps/GalaxyApp';
import VirtualMqttClient from './apps/VirtualApp/VirtualMqttClient';
import AdminApp from './apps/AdminApp/AdminApp';
import ShidurAppMqtt from './apps/ShidurApp/ShidurAppMqtt';
import AudioOutMqtt from './apps/AudioOutApp/AudioOutMqtt';
import VideoOutMqtt from './apps/VideoOutApp/VideoOutMqtt';
import QstOutMqtt from './apps/VideoOutApp/QstOutMqtt';
import WebOutMqtt from './apps/WebOutApp/WebOutMqtt';

class App extends Component {
  render() {
    const appName = process.env.REACT_APP_GALAXY_APP || 'virtual';
    let AppComponent;

    switch (appName) {
      case 'galaxy':
        AppComponent = GalaxyApp;
        break;
      case 'admin':
        AppComponent = AdminApp;
        break;
      case 'shidur':
        AppComponent = ShidurAppMqtt;
        break;
      case 'audioout':
        AppComponent = AudioOutMqtt;
        break;
      case 'videoout':
        AppComponent = VideoOutMqtt;
        break;
      case 'qstout':
        AppComponent = QstOutMqtt;
        break;
      case 'webout':
        AppComponent = WebOutMqtt;
        break;
      case 'virtual':
      default:
        AppComponent = VirtualMqttClient;
        break;
    }

    return (
      <I18nextProvider i18n={i18n}>
        <AppComponent />
      </I18nextProvider>
    );
  }
}

export default App;
