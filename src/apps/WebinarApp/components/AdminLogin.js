import React, { Component } from 'react';
import {kc,getUser} from '../../../components/UserManager';
import { Container,Message,Button,Dropdown,Image } from 'semantic-ui-react';
import logo from './KL_Tree_128.png';

class AdminLogin extends Component {

  state = {
    disabled: true,
    loading: true,
  };

  componentDidMount() {
    this.appLogin();
  };

  appLogin = () => {
    getUser((user) => {
      if(user) {
        this.setState({loading: false});
        this.props.checkPermission(user);
      } else {
        this.setState({disabled: false, loading: false});
      }
    });
  };

  userLogin = () => {
    this.setState({disabled: true, loading: true});
    kc.login({redirectUri: window.location.href});
  };

  render() {

    const {disabled, loading} = this.state;

    let login = (<Button size='massive' primary onClick={this.userLogin} disabled={disabled} loading={loading}>Login</Button>);
    let logout = (<Image src={logo} centered />);

    return (
      <Container textAlign='center' >
        <Message size='massive'>
          <Message.Header>Arvut System</Message.Header>
          <p>Administrative Tools and Services</p>
          <Image src={logo} centered />
          <p>{this.props.user === null ? login : logout}</p>
        </Message>
      </Container>
    );
  }
}

export default AdminLogin;
