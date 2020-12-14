import { createMuiTheme } from '@material-ui/core/styles';
import { red } from '@material-ui/core/colors';

const dark = createMuiTheme({
  palette: {
    type: 'dark',
    overrides: {
      MuiButton: {
        border: {
          color: 'white',
        },
      },
    }
  },
});

export default dark;
