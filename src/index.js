import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import log from "loglevel";
import {initSentry} from "./shared/sentry";

if(process.env.NODE_ENV === "production") {
  initSentry();
}

log.setLevel('info')
const loglevel = new URLSearchParams(window.location.search).get('loglevel');
if(loglevel) {
  log.setLevel(loglevel)
}

ReactDOM.render(<App />, document.getElementById("root"));
