import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import {initSentry} from "./shared/sentry";

if(process.env.NODE_ENV === "production") {
  initSentry();
}

ReactDOM.render(<App />, document.getElementById("root"));
