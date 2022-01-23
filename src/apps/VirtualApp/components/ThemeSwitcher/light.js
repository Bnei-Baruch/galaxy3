import {createTheme} from "@material-ui/core/styles";
import {grey, red} from "@material-ui/core/colors";

const light = createTheme({
  palette: {},
  overrides: {
    MuiButton: {
      root: {
        "&.donate": {
          backgroundColor: grey[900],
          color: grey[50],
          "& .MuiButton-label > span": {
            color: red[500],
            margin: "0 5px",
          },
        },
      },
    },
  },
});

export default light;
