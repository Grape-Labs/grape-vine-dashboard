'use client'
import React, { useState } from 'react';

import {
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  IconButton,
  Typography,
} from '@mui/material'

const data = [
  'XYZXYZXYZXYZXYZXYZXYZ',
  'XYZXYZXYZXYZXYZXYZXYZ',
  'XYZXYZXYZXYZXYZXYZXYZ',
];

const VineHolderComponent: React.FC = () => (
  <Box sx={{ flexGrow: 1 }}>
    <Divider>Holders</Divider>
    <List>
      {data && data.map((item, key) => (
        <ListItem key={key}>
          <Typography>[{key}]</Typography> {item} ()
        </ListItem>
      ))}
    </List>
  </Box>
);

export default VineHolderComponent;