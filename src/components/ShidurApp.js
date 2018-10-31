import React, { Component } from 'react';
import {Grid} from "semantic-ui-react";
import ShidurUsers from "./ShidurUsers";
import ShidurGroups from "./ShidurGroups";


class ShidurApp extends Component {

    state = {};

    render() {

        return (

            <Grid columns={2}>
                <Grid.Column>
                    <ShidurGroups/>
                </Grid.Column>
                <Grid.Column>
                    <ShidurUsers/>
                </Grid.Column>
            </Grid>
        );
    }
}

export default ShidurApp;