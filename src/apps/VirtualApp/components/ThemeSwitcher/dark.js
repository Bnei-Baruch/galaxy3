import {createTheme} from "@material-ui/core/styles";

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
});

export default dark;
