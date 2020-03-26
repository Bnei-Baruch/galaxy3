import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
// import GalaxyApp from "./apps/GalaxyApp";
import OldClient from "./apps/VirtualApp/OldClient";
// import MobileClient from "./apps/MobileApp/MobileClient";
// import VirtualClient from "./apps/VirtualApp/VirtualClient";
// import VirtualStreaming from "./apps/VirtualApp/VirtualStreaming";
// import GroupClient from "./apps/GroupsApp/GroupClient";
// import GalaxyStream from "./apps/StreamApp/GalaxyStream";
// import AdminRoot from "./apps/AdminApp/AdminRoot";
// import AdminShidur from "./apps/AdminApp/AdminShidur";
// import AdminGuest from "./apps/AdminApp/AdminGuest";
// import ShidurApp from "./apps/ShidurApp/ShidurApp";
// import SndmanApp from "./apps/SndmanApp/SndmanApp";
// import AudioOutApp from "./apps/AudioOutApp/AudioOutApp";
// import SDIOutApp from "./apps/SDIOutApp/SDIOutApp";
// import AdminCongress from "./apps/AdminApp/AdminCongress";
// import AdminStreaming from "./apps/AdminApp/AdminStreaming";

class App extends Component {

    render() {
        return (
            <Fragment>
                {/*<GalaxyApp />*/}
                <OldClient />
                {/*<MobileClient/>*/}
                {/*<VirtualClient />*/}
                {/* <VirtualStreaming/>*/}
                {/*<GroupClient/>*/}
                {/* <GalaxyStream/>*/}
                {/*<AdminRoot />*/}
                {/*<AdminShidur />*/}
                {/* <AdminGuest/>*/}
                {/*<ShidurApp/>*/}
                {/*<AudioOutApp />*/}
                {/*<SndmanApp/>*/}
                {/*<SDIOutApp />*/}
                {/*<AdminCongress/>*/}
                {/*<AdminStreaming/>*/}
            </Fragment>
        );
    }
}

export default App;
