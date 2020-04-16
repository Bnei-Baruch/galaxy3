import React, { Component } from 'react'
import {Button, Container, Message} from 'semantic-ui-react'

class LoginMessage extends Component {
    state = { visible: true }

    handleDismiss = () => {
        this.setState({ visible: false })
    }

    render() {

        let login = (<Button primary onClick={() => window.open("https://galaxy.kli.one/user","_self")} >LOGIN</Button>);

        if (this.state.visible) {
            return (
                <Container textAlign='center' >
                    <Message visible negative size='massive' onDismiss={this.handleDismiss} >
                        <Message.Header>Please {login} to make it safe for us</Message.Header>
                    </Message>
                </Container>
            )
        }

        return (
            ""
        )
    }
}

export default LoginMessage