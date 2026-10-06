import {createTheme} from "@mui/material/styles";
import {green, grey, red, indigo, deepOrange, lightBlue} from "@mui/material/colors";

const dark = createTheme(
 {
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
        link: lightBlue[100]
      },
      success: {
        main: green[500],
      }
    },
    components: {
      MuiButton: {
        styleOverrides: {
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
        },
        variants: [
          {
            props: { variant: 'outlined' },
            style: {
              borderColor: "white",
            },
          },
        ],
      },
    },
  }
);

export default dark;
