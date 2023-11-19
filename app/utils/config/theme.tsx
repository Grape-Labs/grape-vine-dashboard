import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: [
      'GrapeFont',
      'sans-serif',
    ].join(','),
  },  
  palette: {
    mode: "dark",
    background: {
      default: '#0A1D30',
      paper: "#000000"
    },
  }
});

export default theme;