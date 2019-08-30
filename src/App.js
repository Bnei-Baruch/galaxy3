import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
import GalaxyApp from "./apps/GalaxyApp";
// import VirtualStreaming from "./apps/VirtualApp/VirtualStreaming";
// import GalaxyStream from "./apps/StreamApp/GalaxyStream";
// import AdminStreaming from "./apps/AdminApp/AdminStreaming";
// import VirtualClient from "./apps/VirtualApp/VirtualClient";
// import ShidurAdmin from "./apps/ShidurApp/ShidurAdmin";
// import SDIOutApp from "./apps/SDIOutApp/SDIOutApp";
// import ShidurApp from "./apps/ShidurApp/ShidurApp";
// import MobileClient from "./apps/MobileApp/MobileClient";
// import SndmanApp from "./apps/SndmanApp/SndmanApp";
// import GroupClient from "./apps/GroupsApp/GroupClient";
// import GalaxyStream from "./apps/StreamApp/GalaxyStream";
// import AdminGuest from "./apps/AdminApp/AdminGuest";
// import AdminCongress from "./apps/AdminApp/AdminCongress";

class App extends Component {

    render() {
        return (
            <Fragment>
                <GalaxyApp />
                {/*<VirtualClient/>*/}
                {/* <ShidurAdmin/>*/}
                {/*<SDIOutApp/>*/}
                {/* <ShidurApp/>*/}
                {/* <SndmanApp/>*/}
                {/*<GroupClient/>*/}
                {/* <GalaxyStream/>*/}
                {/* <AdminGuest/>*/}
                {/*<AdminCongress/>*/}
                {/*  <MobileClient/>*/}
                {/* <AdminStreaming/>*/}
                 {/*<GalaxyStream/>*/}
                 {/*<VirtualStreaming/>*/}
            </Fragment>
        );
    }
}

export default App;
