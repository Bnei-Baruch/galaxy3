import React, {
  Component,
  Fragment,
} from 'react';
import {
  Button,
  Divider,
	Grid,
} from "semantic-ui-react";
import LoginPage from '../components/LoginPage';
import {buildUserObject, client, pendingApproval} from "../components/UserManager";
import {withTranslation} from "react-i18next";
import VerifyAccount from './VirtualApp/components/VerifyAccount';

class GalaxyApp extends Component {

    state = {
        user: null,
        roles: [],
    };

    componentDidMount() {
      // When renew singin happends, every 10 minutes, we want to fetch new
      // user info including permissiong and attributes and apply it to client.
      // For example guest user may become regular user after approval.
      client.events.addUserLoaded((oidcUser) => {
        const user = buildUserObject(oidcUser);
        this.checkPermission(user);
      });
    };

    checkPermission = (user) => {
      const gxy = user.roles.filter(role => /gxy_/.test(role));
      const pending_approval = pendingApproval(user);
      const gxy_user = gxy.length === 0;
      if((!gxy_user && gxy.length > 1) || pending_approval) {
          this.setState({user, roles: user.roles});
      } else if (!gxy_user && gxy.length === 1 && gxy[0] === "gxy_user" && !pending_approval) {
          window.location = '/user';
      } else {
          alert("Access denied.");
          client.signoutRedirect();
      }
    };

    render() {
        const {i18n} = this.props;
        const {user, roles} = this.state;
				const approval = pendingApproval(user);
        const requested = user && user.request && !!user.request.length;

        const options = roles.map((role, i) => {
            if(role === "gxy_user" || role === "pending_approval") {
							return (<Button key={i} size='massive' color='green' onClick={() => window.open("user","_self")}>
								{approval ? 'Continue as Guest' : 'Galaxy'}
							</Button>);
						}
            if(role === "gxy_shidur") {
							return (<Button key={i} size='massive' color='green' onClick={() => window.open("shidur","_self")}>
								Shidur
							</Button>);
						}
            if(role === "gxy_sndman") {
							return (<Button key={i} size='massive' color='green' onClick={() => window.open("sndman","_self")}>
								SoundMan
							</Button>);
						}
            if(role.match(/^(gxy_admin|gxy_root|gxy_viewer)$/)) {
							return (<Button key={i} size='massive' color='green' onClick={() => window.open("admin","_self")}>
								Admin
							</Button>);
						}
            return false;
        }).filter(element => element);

        const enter = (
					<Grid columns={(!approval || requested) ? 1 : 2}>
						<Grid.Row>
              <Divider className="whole-divider" vertical />
							{(!approval || requested) ? null : <Grid.Column>
								<VerifyAccount user={user} loginPage={true} i18n={i18n}/>
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
