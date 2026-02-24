import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#ff6d00' },
    background: { default: '#f5f5f5' },
  },
  typography: {
    fontFamily: '"Noto Sans KR", "Roboto", sans-serif',
    fontSize: 14,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: { borderTop: '1px solid #e0e0e0' },
      },
    },
  },
});

export default theme;
