import {adaptV4Theme, createTheme} from "@mui/material/styles";
import {grey, purple, red} from "@mui/material/colors";

const light = createTheme(
  adaptV4Theme({
    palette: {
      primary: {
        main: grey[700],
      },
      secondary: {
        main: red[600],
      },
      info: {
        main: purple[800],
      },
    },
    paper: {
      main: grey[500],
    },
    overrides: {
      MuiButton: {
        root: {
          "&.donate > span": {
            color: red[500],
            margin: "0 .5em",
          },
        },
      },
    },
  })
);

export default light;
