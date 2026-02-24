import React from 'react';
import { Box, AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';

interface LayoutProps {
  title?: string;
  children: React.ReactNode;
  showBack?: boolean;
  hideNav?: boolean;
  rightElement?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  title,
  children,
  showBack = false,
  hideNav = false,
  rightElement,
}) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {title && (
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'white', color: 'text.primary', borderBottom: '1px solid #e0e0e0' }}>
          <Toolbar>
            {showBack && (
              <IconButton edge="start" onClick={() => navigate(-1)} sx={{ mr: 1 }}>
                <ArrowBack />
              </IconButton>
            )}
            <Typography variant="h6" fontWeight={600} flex={1}>
              {title}
            </Typography>
            {rightElement}
          </Toolbar>
        </AppBar>
      )}

      <Box
        component="main"
        sx={{
          flex: 1,
          overflow: 'auto',
          pb: hideNav ? 0 : '70px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </Box>

      {!hideNav && <BottomNav />}
    </Box>
  );
};

export default Layout;
