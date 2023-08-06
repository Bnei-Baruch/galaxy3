import React, {useState} from "react";
import {Trans, useTranslation} from "react-i18next";

import {Box, Button, IconButton, Modal, Typography} from "@mui/material";
import {Close} from "@mui/icons-material";
import {makeStyles} from "tss-react/mui";
import {useTheme} from "@mui/material/styles";
import {getLanguage} from "../../../i18n/i18n";

const useStyles = makeStyles()(() => ({
  modal: {
    border: "none",
    outline: "none",
    fontFamily: "Roboto",
    fontSize: 14
  },
  paper: {
    outline: "none",
    maxWidth: 490,
    margin: "3em auto 0",
    position: "relative"
  },
  content: {
    outline: "none",
    overflowX: "hidden",
    overflowY: "auto",
    maxHeight: 530,
    padding: "1em"
  },
  close: {
    position: "absolute",
    top: 4,
    background: 'white',
    borderRadius: 2,
    color: "black"
  },
  header: {
    marginBottom: "1em"
  },
  banner: {
    width: "100%"
  },
  btn: {
    color: "white",
    background: "#FC6719",
    margin: "0 1em 1em",

    "&:hover": {
      background: "#FC6719",
    }
  }
}));

const STORAGE_KEY = "donation_modal"
const needRender = () => {
  const _now = new Date()
  const _day = _now.getDay()
  if (_day > 1) return false
  if (_day === 1 && _now.getHours() > 6) return false
  return localStorage.getItem(STORAGE_KEY) !== _now.getMonth().toString();

}
const DonationModal = () => {
  const {t} = useTranslation();
  const [open, setOpen] = useState(true)
  const theme = useTheme();
  const {palette: {background: {paper}, primary: {contrastText}}} = theme;
  const language = getLanguage();

  const isRtl = language === "he";
  const {classes} = useStyles(isRtl);

  if (!needRender()) return null
  const onClose = () => {
    localStorage.setItem(STORAGE_KEY, (new Date()).getMonth().toString())
    setOpen(false)
  }

  return (
    <Modal
      open={open}
      componentsProps={
        {
          backdrop: {
            style: {
              backgroundColor: 'grey',
              opacity: 0.7
            }
          }
        }
      }
      className={classes.modal}
      dir={isRtl ? "rtl" : ""}
    >
      <Box className={classes.paper} bgcolor={paper} display="block">
        <Box
          className={classes.close}
          style={{
            left: isRtl ? 4 : 'auto',
            right: !isRtl ? 4 : 'auto',
            color: paper,
            background: contrastText
          }}
        >
          <IconButton onClick={onClose}> <Close/> </IconButton>
        </Box>
        <img
          className={classes.banner}
          src="https://kabbalahmedia.info/static/media/DonationBanner.79d3bc33bcc01750e949.jpg"
        />
        <Box className={classes.content}>
          <Typography
            variant="h6"
            className={classes.header}
            color="textPrimary"
          >
            {t("settings.donationHeader")}
          </Typography>
          <Typography
            fontSize="11"
            color="textPrimary"
          >
            <Trans
              i18nKey="settings.donationContent"
              components={{p: <p/>}}
            />
          </Typography>
        </Box>
        <Box textAlign={isRtl ? "left" : "right"}>
          <Button className={classes.btn} onClick={onClose}>
            {t("settings.donationBtn")}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
    ;
};

export default DonationModal;
