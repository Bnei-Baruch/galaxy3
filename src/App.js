import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
import './App.css';
// import SndmanClient from "./components/SndmanClient";
// import Streaming from "./components/Streaming";
// import ShidurClient from "./components/ShidurClient";
// import AdminClient from "./components/AdminClient";
// import SDIOutClient from "./components/SDIOutClient";
import VirtualClient from "./components/VirtualClient";
// import VirtualStreaming from "./components/VirtualStreaming";

class App extends Component {

    componentDidMount() {
    };

    render() {
        return (
            <Fragment>
                {/*<Streaming />*/}
                {/*<ShidurClient />*/}
                {/*<SDIOutClient />*/}
                {/*<SndmanClient />*/}
                {/*<AdminClient />*/}
                <VirtualClient />
                {/*<VirtualStreaming/>*/}
            </Fragment>
        );
    }
}

export default App;
