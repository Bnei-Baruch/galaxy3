import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
// import GalaxyStream from "./components/GalaxyStream";
// import ShidurAdmin from "./apps/ShidurApp/ShidurAdmin";
// import ShidurApp from "./apps/ShidurApp/ShidurApp";
// import ShidurGroups from "./apps/ShidurApp/ShidurGroups";
// import GroupClient from "./apps/GroupsApp/GroupClient";
// import GroupsApp from "./apps/GroupsApp/GroupsApp";
// import SndmanClient from "./apps/SndmanApp/SndmanClient";
// import AdminStreaming from "./apps/AdminApp/AdminStreaming";
// import ShidurUsers from "././apps/ShidurApp/ShidurUsers";
// import AdminClient from "./apps/AdminApp/AdminClient";
// import SDIOutClient from "./apps/SDIOutApp/SDIOutClient";
import SDIOutApp from "./apps/SDIOutApp/SDIOutApp";
// import VirtualClient from "./apps/VirtualApp/VirtualClient";
// import VirtualStreaming from "./components/VirtualStreaming";

class App extends Component {

    componentDidMount() {
    };

    render() {
        return (
            <Fragment>
                {/*<GalaxyStream/>*/}
                {/*<Streaming />*/}
                {/*<ShidurUsers />*/}
                {/*<ShidurAdmin/>*/}
                {/*<SDIOutClient />*/}
                <SDIOutApp/>
                {/*<SndmanClient />*/}
                {/*<AdminStreaming/>*/}
                {/*<AdminClient />*/}
                {/*<VirtualClient />*/}
                {/*<VirtualStreaming/>*/}
                {/*<ShidurGroups/>*/}
                 {/*<ShidurApp/>*/}
                {/* <GroupClient/> */}
                 {/*<GroupsApp/>*/}
            </Fragment>
        );
    }
}

export default App;
