import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
import './App.css';
// import ShidurApp from "./apps/ShidurApp/ShidurApp";
// import ShidurGroups from "./apps/ShidurApp/ShidurGroups";
// import SndmanClient from "./apps/SndmanApp/SndmanClient";
// import AdminStreaming from "./apps/AdminApp/AdminStreaming";
// import ShidurUsers from "././apps/ShidurApp/ShidurUsers";
// import AdminClient from "./apps/AdminApp/AdminClient";
// import SDIOutClient from "./apps/SDIOutApp/SDIOutClient";
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
                {/*<AdminStreaming/>*/}
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
