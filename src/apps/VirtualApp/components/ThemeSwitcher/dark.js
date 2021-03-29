import {createMuiTheme} from "@material-ui/core/styles";

const dark = createMuiTheme({
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
