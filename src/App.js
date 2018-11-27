import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
import VirtualClient from "./apps/VirtualApp/VirtualClient";
// import ShidurAdmin from "./apps/ShidurApp/ShidurAdmin";
// import SndmanApp from "./apps/SndmanApp/SndmanApp";
// import ShidurApp from "./apps/ShidurApp/ShidurApp";
// import GroupClient from "./apps/GroupsApp/GroupClient";
// import SDIOutApp from "./apps/SDIOutApp/SDIOutApp";

class App extends Component {

    render() {
        return (
            <Fragment>
                <VirtualClient/>
                 {/*<ShidurAdmin/>*/}
                {/*<SDIOutApp/>*/}
                 {/*<ShidurApp/>*/}
                 {/*<GroupClient/>*/}
                 {/*<SndmanApp/>*/}
            </Fragment>
        );
    }
}

export default App;
