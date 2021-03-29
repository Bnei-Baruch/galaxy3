import React, {Component, Fragment} from "react";
import {kc, getUser} from "./UserManager";
import {Button, Container, Divider, Grid, Header, Image, Menu, Message, Segment, Select} from "semantic-ui-react";
import bblogo from "./logo.png";
import {languagesOptions, setLanguage, kcLocale} from "../i18n/i18n";
import {withTranslation} from "react-i18next";
import {Terms} from "./Terms";
import {Profile} from "./Profile";
import internet from "./internet.png";
import "./LoginPage.css";
import {SupportOld} from "../apps/VirtualApp/components/Support/SupportOld";

class LoginPage extends Component {
  state = {
    disabled: true,
    loading: true,
  };

  componentDidMount() {
    this.appLogin();
  }

  appLogin = () => {
    getUser((user) => {
      if (user) {
        this.setState({loading: false});
        this.props.checkPermission(user);
      } else {
        this.setState({disabled: false, loading: false});
      }
    });
  };

  userLogin = () => {
    this.setState({disabled: true, loading: true});
    kc.login({redirectUri: window.location.href, locale: kcLocale(this.props.i18n.language)});
  };

  render() {
    const {t, i18n} = this.props;
    const {disabled, loading} = this.state;
    const direction = i18n.language === "he" ? "rtl" : "";

    let login = (
      <Container textAlign="center">
        <br />
        <br />
        <br />
        <br />
        <br />
        <br />
        <br />
        <Message size="massive">
          <Message.Header>{t("loginPage.galaxy")}</Message.Header>
          <p>{t("loginPage.slogan")}</p>
          <Button size="massive" primary disabled={disabled} loading={loading}>
            {t("loginPage.login")}
          </Button>
        </Message>
      </Container>
    );

    let main = (
      <Container fluid>
        <Menu secondary style={{direction}}>
          <Menu.Item>
            <Image
              src={bblogo}
              style={{
                height: "8em",
                objectFit: "contain",
                objectPosition: i18n.language === "he" ? "-14px 0" : "14px 0",
              }}
            />
            <div>
              <div style={{fontSize: "medium", color: "#00c6d2", whiteSpace: "nowrap"}}>
                {t("loginPage.logoOurConnection")}
              </div>
              <div style={{fontSize: "large", color: "#00457c"}}>{t("loginPage.logoNetwork")}</div>
            </div>
          </Menu.Item>

          <Menu.Menu
            style={{
              display: "flex",
              marginRight: i18n.language === "he" ? "auto" : "",
              marginLeft: i18n.language === "he" ? "" : "auto",
            }}
          >
            <Menu.Item>
              <Select
                compact
                value={i18n.language}
                options={languagesOptions}
                onChange={(e, {value}) => {
                  setLanguage(value);
                }}
              />
            </Menu.Item>
            <Menu.Item>
              <SupportOld t={t} i18n={i18n} user={this.props.user} />
            </Menu.Item>
          </Menu.Menu>
        </Menu>
        <Container textAlign="center" style={{direction}}>
          <Message size="massive">
            <Message.Header>
              {this.props.user === null ? t("loginPage.galaxy") : "Welcome, " + this.props.user.username}
              {this.props.user === null ? "" : <Profile kc={kc} />}
            </Message.Header>
            <p>{t("loginPage.slogan")}</p>
            {this.props.user === null ? "" : this.props.enter}

            {this.props.user === null ? (
              <Segment basic>
                <Grid columns={2} stackable textAlign="center">
                  <Divider className="whole-divider" vertical />
                  <Grid.Row verticalAlign="bottom">
                    <Grid.Column>
                      <Header size="huge">{t("loginPage.regUsers")}</Header>
                      <br />
                      <Button size="massive" primary onClick={this.userLogin} disabled={disabled} loading={loading}>
                        {t("loginPage.login")}
                      </Button>
                    </Grid.Column>
                    <Grid.Column>
                      <Header size="huge">{t("loginPage.newUsers")}</Header>
                      <br />
                      <Button size="massive" primary onClick={this.userLogin}>
                        {t("loginPage.register")}
                      </Button>
                    </Grid.Column>
                  </Grid.Row>
                </Grid>
              </Segment>
            ) : (
              <Segment basic>
                <Button primary onClick={() => window.open("http://ktuviot.kbb1.com/three_languages", "_blank")}>
                  Workshop Questions
                </Button>
                <Button primary onClick={() => window.open("https://bb.kli.one/", "_blank")}>
                  BB KLI
                </Button>
              </Segment>
            )}
          </Message>
        </Container>
      </Container>
    );

    return (
      <Fragment>
        {loading ? login : main}
        <Container text textAlign="center" style={{direction, marginTop: "20px", fontSize: "1.5em"}}>
          <Image src={internet} style={{margin: "auto", width: "60px"}}></Image>
          <p style={{marginTop: "15px"}}>{t("loginPage.intro")}</p>
          <Button basic color="red" size="large" onClick={() => window.open("https://virtualhome.kli.one", "_blank")}>
            {t("loginPage.userFee")}
          </Button>
        </Container>
        <Terms />
      </Fragment>
    );
  }
}

export default withTranslation()(LoginPage);
