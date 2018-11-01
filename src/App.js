import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
import './App.css';
// import ShidurApp from "./components/ShidurApp";
// import ShidurGroups from "./components/ShidurGroups";
// import SndmanClient from "./components/SndmanClient";
// import AdminStreaming from "./components/AdminStreaming";
// import ShidurUsers from "./components/ShidurUsers";
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
                {/*<ShidurUsers />*/}
                {/*<SDIOutClient />*/}
                {/*<SndmanClient />*/}
                {/*<AdminClient />*/}
                <VirtualClient />
                {/*<VirtualStreaming/>*/}
                {/*<ShidurGroups/>*/}
                {/*<ShidurApp/>*/}
            </Fragment>
        );
    }
}

export default App;
