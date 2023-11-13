'use client'
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import VineHolderComponent from './VineHolderComponent'

import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { 
  Layout, 
  Menu, 
  Button, 
  theme } from 'antd';

const { Header, Sider, Content } = Layout;

const Home: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  return (
    <Layout
      style={{
      height: '100vh' }}
    >
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div className="demo-logo-vertical" />
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['1']}
          items={[
            {
              key: '1',
              icon: <DashboardOutlined />,
              label: 'Vine Dashboard',
            },
            {
              key: '2',
              icon: <LinkOutlined />,
              label: 'Governance',
              onClick: () => {
                window.open('https://governance.so', '_blank');
              },
            },
            {
              key: '3',
              icon: <LinkOutlined />,
              label: 'Grape Art',
              onClick: () => {
                window.open('https://grape.art', '_blank');
              },
            },
            {
              key: '4',
              icon: <LinkOutlined />,
              label: 'Identity',
              onClick: () => {
                window.open('https://grape.art/identity', '_blank');
              },
            },
            {
              key: '5',
              icon: <LinkOutlined />,
              label: 'Verification',
              onClick: () => {
                window.open('https://verify.grapes.network', '_blank');
              },
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />
          Vine Dashboard
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
          }}
        >
          <VineHolderComponent />
        </Content>
      </Layout>
    </Layout>
  );
};

export default Home;