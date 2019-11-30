import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
// import GalaxyApp from "./apps/GalaxyApp";
import OldClient from "./apps/VirtualApp/OldClient";
// import MobileClient from "./apps/MobileApp/MobileClient";
// import VirtualClient from "./apps/VirtualApp/VirtualClient";
// import VirtualStreaming from "./apps/VirtualApp/VirtualStreaming";
// import GroupClient from "./apps/GroupsApp/GroupClient";
// import GalaxyStream from "./apps/StreamApp/GalaxyStream";
// import ShidurAdmin from "./apps/ShidurApp/ShidurAdmin";
// import ShidurApp from "./apps/ShidurApp/ShidurApp";
// import SndmanApp from "./apps/SndmanApp/SndmanApp";
// import SDIOutApp from "./apps/SDIOutApp/SDIOutApp";
// import AdminGuest from "./apps/AdminApp/AdminGuest";
// import AdminCongress from "./apps/AdminApp/AdminCongress";
// import AdminStreaming from "./apps/AdminApp/AdminStreaming";

class App extends Component {

    render() {
        return (
            <Fragment>
                {/*<GalaxyApp />*/}
                <OldClient />
                {/*  <MobileClient/>*/}
                {/*<VirtualClient/>*/}
                {/* <VirtualStreaming/>*/}
                {/*<GroupClient/>*/}
                {/* <GalaxyStream/>*/}
                {/* <ShidurAdmin/>*/}
                {/* <ShidurApp/>*/}
                 {/*<SndmanApp/>*/}
                {/*<SDIOutApp/>*/}
                {/* <AdminGuest/>*/}
                {/*<AdminCongress/>*/}
                {/* <AdminStreaming/>*/}
            </Fragment>
        );
    }
}

export default App;
