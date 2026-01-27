import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Checkbox, CircularProgress, Dialog, DialogTitle, DialogActions, DialogContent, DialogContentText, FormControlLabel, MenuItem, TextField } from "@mui/material";
import api from "../../../shared/Api";

// TODO: Replace with call to profiles backend API to fetch countries list
const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "IL", name: "Israel" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "RU", name: "Russia" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "JP", name: "Japan" },
];

export const CountrySelectionDialog = ({
  user,
  isOpen,
  onClose,
  onSubmit
}) => {
  const [country, setCountry] = useState("");
  const [error, setError] = useState(false);
  const [isProgress, setIsProgress] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const { t, i18n: { language } } = useTranslation();
  const isRTL = language === "he";

  const handleCountryChange = (e) => {
    setError(false);
    setCountry(e.target.value);
  };

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem("skipCountryDialog", "true");
    }
    onClose();
  };

  const handleSubmit = async () => {
    if (!country) {
      setError(true);
      return;
    }

    setIsProgress(true);
    try {
      await api.updateVHInfo({
        id: user.id,
        country: country
      });

      // Update user vhinfo with country
      if (user.vhinfo) {
        user.vhinfo.country = country;
      }

      if (dontShowAgain) {
        localStorage.setItem("skipCountryDialog", "true");
      }

      setIsProgress(false);
      onSubmit();
    } catch (e) {
      console.error("Failed to update country:", e);
      setIsProgress(false);
      setError(true);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      aria-labelledby="country-dialog-title"
      sx={{ direction: isRTL ? "rtl" : "inherit", zIndex: 1400 }}>
      <DialogTitle id="country-dialog-title">
        {t("onboarding.country_selection.title", { defaultValue: "Select Your Country" })}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {t("onboarding.country_selection.description", {
            defaultValue: "Please select your country to continue. This information is required for your account."
          })}
        </DialogContentText>
        <TextField
          select
          fullWidth
          variant="outlined"
          label={t("onboarding.registration.selectCountry", { defaultValue: "Country" })}
          onChange={handleCountryChange}
          value={country}
          required
          error={error}
          helperText={error ? t("onboarding.country_selection.error", { defaultValue: "Country is required" }) : ""}
          SelectProps={{
            MenuProps: {
              sx: { zIndex: 1401 }
            }
          }}
        >
          {COUNTRIES.map((c) => (
            <MenuItem key={c.code} value={c.name}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
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
          onClick={handleClose}
          color="primary"
          variant="outlined"
          disabled={isProgress}
        >
          {t("onboarding.country_selection.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          variant="contained"
          disabled={isProgress}
          sx={{
            marginRight: isRTL ? "8px" : "0",
            marginLeft: isRTL ? "0" : "8px"
          }}>
          {t("onboarding.country_selection.submit", { defaultValue: "Submit" })}
          {isProgress && <CircularProgress size={20} sx={{ ml: 1 }} />}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
