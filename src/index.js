import React from "react";
import {createRoot} from 'react-dom/client';
import "./index.css";
import App from "./App";
import log from "loglevel";
import {initSentry} from "./shared/sentry";
initSentry();

log.setLevel('warn')
const loglevel = new URLSearchParams(window.location.search).get('loglevel');
if(loglevel) {
  log.setLevel(loglevel)
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
