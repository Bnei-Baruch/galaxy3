import React, { Component } from 'react';
import {client,BASE_URL} from './UserManager';
import { Container,Message,Button,Dropdown,Image } from 'semantic-ui-react';
import logo from './logo.svg';

class LoginPage extends Component {

    state = {
        disabled: true,
        loading: true,
    };

    componentDidMount() {
        setTimeout(() => this.setState({disabled: false, loading: false}), 1000);
        client.signinRedirectCallback().then(function(user) {
            if(user.state) window.location = user.state;
        }).catch(function(err)  {
            //console.log("callback error",err);
        });
    };

    getUser = () => {
        this.setState({disabled: true, loading: true});
        client.getUser().then(function(user) {
            (user === null) ? client.signinRedirect({state: `${BASE_URL}`}) : console.log(":: What just happend?");
        }).catch(function(error) {
            console.log("Error: ",error);
        });
    };

    render() {

        const {disabled, loading} = this.state;

        let login = (<Button size='massive' primary onClick={this.getUser} disabled={disabled} loading={loading}>Login</Button>);
        let enter = (<Button size='massive' color='green' onClick={() => this.props.enter()} disabled={disabled} loading={loading}>Enter</Button>);
        let profile = (
            <Dropdown inline text=''>
                <Dropdown.Menu>
                    <Dropdown.Item content='Profile:' disabled />
                    <Dropdown.Item text='My Account' onClick={() => window.open("https://accounts.kbb1.com/auth/realms/main/account", "_blank")} />
                    <Dropdown.Item text='Sign Out' onClick={() => client.signoutRedirect()} />
                </Dropdown.Menu>
            </Dropdown>);

        return (
            <Container textAlign='center' >
                <br />
                <Message size='massive'>
                    <Message.Header>
                        {this.props.user === null ? "Galaxy Groups" : "Welcome, "+this.props.user.name}
                        {this.props.user === null ? "" : profile}
                    </Message.Header>
                    <p>The Group Today Is You Tomorrow</p>
                    {this.props.user === null ? login : enter}
                    <Image size='large' src={logo} centered />
                </Message>
            </Container>
        );
    }
}

export default LoginPage;
