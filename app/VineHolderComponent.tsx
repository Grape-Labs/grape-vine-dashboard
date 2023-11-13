'use client'
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import {

} from '@ant-design/icons';

import { Divider, List, Typography } from 'antd';

const data = [
  'XYZXYZXYZXYZXYZXYZXYZ',
  'XYZXYZXYZXYZXYZXYZXYZ',
  'XYZXYZXYZXYZXYZXYZXYZ',
];

const VineHolderComponent: React.FC = () => (
  <>
    <Divider orientation="left">Holders</Divider>
    <List
      header={<div>Header</div>}
      footer={<div>Footer</div>}
      bordered
      dataSource={data}
      renderItem={(item, key) => (
        <List.Item>
          <Typography.Text mark>[{key}]</Typography.Text> {item} ()
        </List.Item>
      )}
    />
    
  </>
);

export default VineHolderComponent;