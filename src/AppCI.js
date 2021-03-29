import React, {Component} from "react";
import "semantic-ui-css/semantic.min.css";
import {I18nextProvider} from "react-i18next";
import i18n from "i18next";

import "./i18n/i18n";

// IMPORT_PLACEHOLDER

class App extends Component {
  render() {
    return <I18nextProvider i18n={i18n}>{/* main_component_placeholder */}</I18nextProvider>;
  }
}

export default App;
