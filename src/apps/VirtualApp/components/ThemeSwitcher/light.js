import {createTheme} from "@mui/material/styles";
import {green, grey, red} from "@mui/material/colors";
import indigo from "@mui/material/colors/indigo";

const light = createTheme(
{
    palette: {
      primary: {
        main: grey[700],
      },
      secondary: {
        main: red[600],
      },
      info: {
        main: indigo[500],
      },
      success: {
        main: green[400],
      },
    },
    paper: {
      main: grey[500],
    },
    overrides: {
      MuiButton: {
        root: {
          "&.donate": {
            background: grey[900],
            color: grey[100],
            "& > span": {
              color: red[500],
              margin: "0 .5em",
            },
          },
        },
      },
    },
  }
);

export default light;
