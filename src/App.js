import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
import VirtualClient from "./apps/VirtualApp/VirtualClient";
// import ShidurAdmin from "./apps/ShidurApp/ShidurAdmin";
// import SDIOutApp from "./apps/SDIOutApp/SDIOutApp";
// import ShidurApp from "./apps/ShidurApp/ShidurApp";
// import MobileClient from "./apps/MobileApp/MobileClient";
// import SndmanApp from "./apps/SndmanApp/SndmanApp";
// import GroupClient from "./apps/GroupsApp/GroupClient";
// import GalaxyStream from "./apps/StreamApp/GalaxyStream";
// import AdminGuest from "./apps/AdminApp/AdminGuest";

class App extends Component {

    render() {
        return (
            <Fragment>
                <VirtualClient/>
                 {/*<ShidurAdmin/>*/}
                {/*<SDIOutApp/>*/}
                 {/*<ShidurApp/>*/}
                 {/*<SndmanApp/>*/}
                {/*<GroupClient/>*/}
                 {/*<GalaxyStream/>*/}
                 {/*<AdminGuest/>*/}
                 {/*<MobileClient/>*/}
            </Fragment>
        );
    }
}

export default App;
