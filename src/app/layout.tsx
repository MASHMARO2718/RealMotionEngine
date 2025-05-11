'use client';

// import { Inter } from 'next/font/google';
// const inter = Inter({ subsets: ['latin'] });
import './globals.css';
import ErrorSuppressor from '../components/shared/ErrorSuppressor';
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import Typography from '@mui/material/Typography';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import ListItemButton from '@mui/material/ListItemButton';

// ダークテーマの設定
const theme = {
  primaryColor: 'cyan',
  defaultRadius: 'md',
  fontFamily: 'Orbitron, sans-serif',
};

// クライアントコンポーネントとしてのレイアウト
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const handleDrawerOpen = () => setDrawerOpen(true);
  const handleDrawerClose = () => setDrawerOpen(false);

  return (
    <html lang="ja">
      <body>
        <Box sx={{ flexGrow: 1 }}>
          <AppBar position="static" color="default" elevation={1}>
            <Toolbar>
              <IconButton edge="start" color="inherit" aria-label="menu" onClick={handleDrawerOpen} sx={{ mr: 2 }}>
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" color="inherit" component="div" sx={{ flexGrow: 1 }}>
                RealMotionEngine
              </Typography>
            </Toolbar>
          </AppBar>
          <Drawer anchor="left" open={drawerOpen} onClose={handleDrawerClose}>
            <Box sx={{ width: 240 }} role="presentation" onClick={handleDrawerClose}>
              <List>
                <ListItem key="Home" disablePadding>
                  <ListItemButton>
                    <ListItemIcon><HomeIcon /></ListItemIcon>
                    <ListItemText primary="Home" />
                  </ListItemButton>
                </ListItem>
                <ListItem key="Settings" disablePadding>
                  <ListItemButton>
                    <ListItemIcon><SettingsIcon /></ListItemIcon>
                    <ListItemText primary="Settings" />
                  </ListItemButton>
                </ListItem>
              </List>
            </Box>
          </Drawer>
          <ErrorSuppressor>
            {children}
          </ErrorSuppressor>
        </Box>
      </body>
    </html>
  );
} 