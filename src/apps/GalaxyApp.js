import React, {
  Component,
  Fragment,
} from 'react';
import {
  Button,
	Grid,
} from "semantic-ui-react";
import LoginPage from '../components/LoginPage';
import {client} from "../components/UserManager";
import {withTranslation} from "react-i18next";
import VerifyAccount from './VirtualApp/components/VerifyAccount';

class GalaxyApp extends Component {

    state = {
        user: null,
        roles: [],
    };

    pendingApproval = (user) => user && !!user.roles.find(role => role === 'pending_approval');

    checkPermission = (user) => {
      const gxy = user.roles.filter(role => /gxy_/.test(role));
      const pending_approval = this.pendingApproval(user);
      const gxy_user = gxy.length === 0;
      if((!gxy_user && gxy.length > 1) || pending_approval) {
          this.setState({user, roles: user.roles});
      } else if (!gxy_user && gxy.length === 1 && gxy[0] === "gxy_user" && !pending_approval) {
          alert('/user');
          // window.location = '/user';
      } else {
          alert("Access denied.");
          client.signoutRedirect();
      }
    };

    render() {
        const {user, roles} = this.state;

        const options = roles.map((role, i) => {
            if(role === "gxy_user") {
							return (<Button key={i} size='massive' color='blue' onClick={() => window.open("user","_self")}>
								{this.pendingApproval(user) ? 'Continue as Guest' : 'Galaxy'}
							</Button>);
						}
            if(role === "gxy_shidur") {
							return (<Button key={i} size='massive' color='blue' onClick={() => window.open("shidur","_self")}>
								Shidur
							</Button>);
						}
            if(role === "gxy_sndman") {
							return (<Button key={i} size='massive' color='blue' onClick={() => window.open("sndman","_self")}>
								SoundMan
							</Button>);
						}
            if(role.match(/^(gxy_admin|gxy_root|gxy_viewer)$/)) {
							return (<Button key={i} size='massive' color='blue' onClick={() => window.open("admin","_self")}>
								Admin
							</Button>);
						}
            return false;
        }).filter(element => element);

				const approval = this.pendingApproval(user);
        const enter = (
					<Grid columns={approval ? 2 : 1} divided>
						<Grid.Row>
							{!approval ? null : <Grid.Column>
								<VerifyAccount user={user} />
							</Grid.Column>}
							<Grid.Column style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
								{options}
							</Grid.Column>
						</Grid.Row>
					</Grid>
				);

        return (
            <Fragment>
                <LoginPage user={user} enter={enter} checkPermission={this.checkPermission} />
            </Fragment>
        );
    }
}

export default withTranslation()(GalaxyApp);
