import {adaptV4Theme, createTheme} from "@mui/material/styles";
import {blue, grey, purple, red} from "@mui/material/colors";

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
        main: purple[800],
      },
      overrides: {
        MuiButton: {
          border: {
            color: "white",
          },
          root: {
            "&.donate > span": {
              color: red[500],
              margin: "0 .5em",
            },
          },
        },
      },
    },
    overrides: {
      MuiButton: {
        root: {
          "&.donate": {
            backgroundColor: grey[50],
            color: grey[900],
            "& .MuiButton-label > span": {
              color: red[500],
              margin: "0 5px",
            },
          },
        },
      },
    },
  })
);

export default dark;
