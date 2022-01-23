import {createTheme} from "@material-ui/core/styles";
import {grey, red} from "@material-ui/core/colors";

const dark = createTheme({
  palette: {
    type: "dark",
    overrides: {
      MuiButton: {
        border: {
          color: "white",
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
});

export default dark;
