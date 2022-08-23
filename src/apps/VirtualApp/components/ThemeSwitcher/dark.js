import {adaptV4Theme, createTheme} from "@mui/material/styles";
import {green, grey, red} from "@mui/material/colors";
import indigo from "@mui/material/colors/indigo";

const dark = createTheme(
  adaptV4Theme({
    palette: {
      mode: "dark",
      primary: {
        main: grey[300],
      },
      secondary: {
        main: red[500],
      },
      info: {
        main: indigo[500],
      },
      success: {
        main: green[500],
      },
    },
    overrides: {
      MuiButton: {
        root: {
          "&.donate": {
            background: grey[100],
            color: grey[900],
            "& > span": {
              color: red[500],
              margin: "0 .5em",
            },
          },
        },
        border: {
          color: "white",
        },
      },
    },
  })
);

export default dark;
