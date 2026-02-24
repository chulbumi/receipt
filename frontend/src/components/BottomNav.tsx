import React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import {
  Home, AddCircle, ListAlt, CalendarMonth, MoreHoriz,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { label: '홈', icon: <Home />, path: '/' },
  { label: '등록', icon: <AddCircle />, path: '/capture' },
  { label: '내역', icon: <ListAlt />, path: '/records' },
  { label: '달력', icon: <CalendarMonth />, path: '/calendar' },
  { label: '더보기', icon: <MoreHoriz />, path: '/more' },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const currentIndex = navItems.findIndex((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  );

  return (
    <Paper
      sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }}
      elevation={3}
    >
      <BottomNavigation
        value={currentIndex === -1 ? false : currentIndex}
        onChange={(_, newValue) => navigate(navItems[newValue].path)}
        sx={{ height: 64 }}
      >
        {navItems.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            icon={item.icon}
            sx={{ minWidth: 0, '& .MuiBottomNavigationAction-label': { fontSize: '0.7rem' } }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default BottomNav;
