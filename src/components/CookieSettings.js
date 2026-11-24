import React from "react";
import {Box, IconButton, Tooltip} from "@mui/material";

// Reopens the CookieYes preferences, so consent can be changed as easily as it was given (GDPR 7(3))
export const CookieSettings = () => (
  <Tooltip title="Cookie settings">
    <IconButton size="small" aria-label="Cookie settings" onClick={() => window.revisitCkyConsent?.()}>
      <Box component="img" src="https://cdn-cookieyes.com/assets/images/revisit.svg" alt="" width={22} height={22}
           sx={{filter: theme => theme.palette.mode === "dark" ? "none" : "brightness(0)"}}/>
    </IconButton>
  </Tooltip>
);
