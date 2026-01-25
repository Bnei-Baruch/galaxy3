import React from "react";
import { useTranslation } from "react-i18next";
import { Button, Checkbox, Dialog, DialogTitle, DialogActions, DialogContent, DialogContentText, FormControlLabel } from "@mui/material";
import { PAY_USER_PROFILE } from "../../../shared/env";

export const SKIP_COUNTRY_DIALOG_KEY = "skipCountryDialog";

export const CountrySelectionDialog = ({
  isOpen,
  onClose,
}) => {
  const [dontShowAgain, setDontShowAgain] = React.useState(false);

  const { t, i18n: { language } } = useTranslation();
  const isRTL = language === "he";

  const handleRemindLater = () => {
    if (dontShowAgain) {
      // Don't show again - store in localStorage permanently
      localStorage.setItem("SKIP_COUNTRY_DIALOG_KEY", "true");
    } else {
      // Remind later - store in sessionStorage for this session only
      sessionStorage.setItem("SKIP_COUNTRY_DIALOG_KEY", "true");
    }
    onClose();
  };

  const handleRedirect = () => {
    if (dontShowAgain) {
      localStorage.setItem("SKIP_COUNTRY_DIALOG_KEY", "true");
    } else {
      sessionStorage.setItem("SKIP_COUNTRY_DIALOG_KEY", "true");
    }
    window.open(`${PAY_USER_PROFILE}`, "_blank");
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleRemindLater}
      aria-labelledby="country-dialog-title"
      sx={{ direction: isRTL ? "rtl" : "inherit", zIndex: 1400 }}>
      <DialogTitle id="country-dialog-title">
        {t("onboarding.country_selection.title", { defaultValue: "Select Your Country" })}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {t("onboarding.country_selection.description", {
            defaultValue: "Please update your country in your profile. Click 'Go to Profile' to open your profile page."
          })}
        </DialogContentText>
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              color="primary"
            />
          }
          label={t("onboarding.country_selection.dont_show_again", { defaultValue: "Don't show this again" })}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleRemindLater}
          color="primary"
          variant="outlined"
        >
          {dontShowAgain
            ? t("onboarding.country_selection.close", { defaultValue: "Close" })
            : t("onboarding.country_selection.remind_later", { defaultValue: "Remind Me Later" })
          }
        </Button>
        <Button
          onClick={handleRedirect}
          color="primary"
          variant="contained"
          sx={{
            marginRight: isRTL ? "8px" : "0",
            marginLeft: isRTL ? "0" : "8px"
          }}>
          {t("onboarding.country_selection.go_to_profile", { defaultValue: "Go to Profile" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
