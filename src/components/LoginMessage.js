import React, { Component } from 'react'
import {Button, Container, Message, Icon} from 'semantic-ui-react'
import {withTranslation} from "react-i18next";

class LoginMessage extends Component {
    state = { visible: true }

    handleDismiss = () => {
        this.setState({ visible: false })
    }

    render() {
        const { t } = this.props;
        let login = (<Button primary size='massive' onClick={() => window.open("https://galaxy.kli.one/user","_self")} >LOGIN</Button>);

        if (this.state.visible) {
            return (
                <Container textAlign='center' >
                    <Message icon visible negative size='massive' onDismiss={this.handleDismiss} >
                        <Icon>{login}</Icon>
                        <Message.Header>{t('loginMessage.loginWarning')}</Message.Header>
                    </Message>
                </Container>
            )
        }

        return (
            ""
        )
    }
}

export default withTranslation()(LoginMessage);