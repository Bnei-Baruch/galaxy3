import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, Box, Button, Card, CardHeader, CardContent, CardActions, Container, Grid, Typography } from "@mui/material";
import { CheckCircleOutline, HighlightOff, PlaylistAddCheck, PauseCircleOutline, HowToReg, Theaters, Favorite, PlayCircleOutline, Tune } from "@mui/icons-material";
import { makeStyles } from "tss-react/mui";
import { blue, green, pink, red, teal } from "@mui/material/colors";
import { userRolesEnum } from "../../../shared/enums";
import { RegistrationForm } from "./RegistrationForm";


const useStyles = makeStyles()(() => ({
  avatar: {
    display: "inline-flex",
    margin: "0 1rem"
  },
  blue: {
    backgroundColor: blue[300],
  },
  pink: {
    backgroundColor: pink[300],
  },
  teal: {
    backgroundColor: teal[300],
  },
  green: {
    color: green[500],
  },
  red: {
    color: red[500],
  },
  card: {
    maxWidth: 345,
  },
  card_header_action: {
    alignSelf: "center",
    marginTop: 0
  }
}));

const OnboardingDoor = ({ user }) => {
  const { t, i18n: { language } } = useTranslation();
  const [modalState, setModalState] = useState(false);
  const { classes } = useStyles();

  const isRTL = language == 'he';
  const avatarSX = {
    "& .MuiCardHeader-avatar": {
      marginRight: isRTL ? "0" : "16px",
      marginLeft: isRTL ? "16px" : "0"
    }
  };
  const startIconSX = {
    "& .MuiButton-startIcon": {
      marginRight: isRTL ? "-2px" : "8px",
      marginLeft: isRTL ? "8px" : "-2px"
    }
  };

  const handleRegisterClick = () => {
    setModalState(true);
  }

  const handleModalClose = () => {
    setModalState(false);
  };

  const handleModalSubmit = () => {
    setModalState(false);
  }

  const renderRegistration = () => {
    return (
      <Card className={classes.card} variant="outlined">
        <CardHeader
          avatar={<Avatar aria-label="registration" className={classes.teal}><HowToReg /></Avatar>}
          title={t("onboarding.registration.title")}
          titleTypographyProps={{ variant: "h5" }}
          action={user.role === userRolesEnum.user ?
            <CheckCircleOutline fontSize="large" className={classes.green} /> :
            user.role === userRolesEnum.pending_approve ?
              <PauseCircleOutline fontSize="large" color="primary" /> :
              <HighlightOff fontSize="large" className={classes.red} />}
          classes={{ action: classes.card_header_action }}
          sx={avatarSX}
        />
        <CardContent>
          {
            user.role === userRolesEnum.user ?
              t("onboarding.registration.status_approved") :
              user.role === userRolesEnum.pending_approve ?
                t("onboarding.registration.status_pending") :
                t("onboarding.registration.status_new")
          }
        </CardContent>
        {
          user.role === userRolesEnum.new_user &&
          <CardActions>
            <Button
              aria-label="register"
              variant="outlined"
              color="primary"
              size="small"
              onClick={handleRegisterClick}
              startIcon={<PlaylistAddCheck />}
              sx={startIconSX}>
              {t("onboarding.registration.register")}
            </Button>
          </CardActions>
        }
      </Card>
    )
  };

  const renderMembership = () => {
    return (
      <Card className={classes.card} variant="outlined">
        <CardHeader
          avatar={<Avatar aria-label="membership" className={classes.pink}><Favorite /></Avatar>}
          title={t("onboarding.membership.title")}
          titleTypographyProps={{ variant: "h5" }}
          action={user.membership?.active ?
            <CheckCircleOutline fontSize="large" className={classes.green} /> :
            <HighlightOff fontSize="large" className={classes.red} />}
          classes={{ action: classes.card_header_action }}
          sx={avatarSX}
        />
        <CardContent>
          {t("onboarding.membership.statusMessage")}
          {
            user.membership?.active ?
              <Typography component="span" display="inline" color="success.main">{t("onboarding.membership.statusActive")}</Typography> :
              <Typography component="span" color="warning.main">{t("onboarding.membership.statusInactive")}</Typography>
          }
          .&nbsp;<br />
          {
            user.membership?.active ?
              t("onboarding.membership.good_to_go") :
              t("onboarding.membership.activate")
          }
        </CardContent>
        <CardActions>
          <Button
            aria-label="manage membership"
            variant="outlined"
            color="primary"
            size="small"
            href="https://kli.one/dash/membership"
            startIcon={<Tune />}
            direction={isRTL ? 'rtl' : 'inherit'}
            sx={startIconSX}
          >
            {t("onboarding.membership.manage")}
          </Button>
        </CardActions>
      </Card>
    )
  };

  const renderBroadcast = () => {
    return (
      <Card className={classes.card} variant="outlined">
        <CardHeader
          avatar={<Avatar aria-label="live-stream" className={classes.blue}><Theaters /></Avatar>}
          title={t("onboarding.broadcast.title")}
          titleTypographyProps={{ variant: "h5" }}
          sx={avatarSX}
        />
        <CardContent>
          <Typography>
            {t("onboarding.broadcast.body")}
          </Typography>
        </CardContent>
        <CardActions>
          <Button
            aria-label="go to broadcast"
            variant="outlined"
            color="primary"
            size="small"
            href="https://kli.one/dash/broadcast"
            startIcon={<PlayCircleOutline />}
            sx={Object.assign({}, startIconSX, isRTL ? {
              '& svg': {
                transform: 'scaleX(-1)',
              }
            } : {})}
          >
            {t("onboarding.broadcast.goto")}
          </Button>
        </CardActions>
      </Card>
    )
  };


  return <>
    <Box p={5}
      sx={{
        direction: isRTL ? 'rtl' : 'inherit'
      }}>
      <Container>
        <Typography variant="h3" display={"block"} paragraph>
          {t("onboarding.welcome", { name: user.display })}
        </Typography>
        <br />
        <Typography variant="h6">
          {t("onboarding.general_note")}
        </Typography>
        <br />
        <Typography variant="h6">
          {t("onboarding.email_note", { email: user.email })}
        </Typography>
        <br />

        <Grid container justifyContent="center" spacing={3}>
          <Grid item md={4}>{renderRegistration()}</Grid>
          <Grid item md={4}>{renderMembership()}</Grid>
          <Grid item md={4}>{renderBroadcast()}</Grid>
        </Grid>

      </Container>
    </Box>
    {modalState && <RegistrationForm
      user={user}
      id={user.id}
      onSubmit={handleModalSubmit}
      onClose={handleModalClose}
      isOpen={modalState} />}
  </>;
};

export default OnboardingDoor;
