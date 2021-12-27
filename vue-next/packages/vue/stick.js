/**
 * @title 卡片路由
 * @路由形式 /news/card/*
 */

export default [
  {
    businessId: 13,
    method: 'GET',
    id: 'cardParent',
    parentId: 'newsParent',
    path: '/news/card',
    title: '卡片管理',
    name: 'Card',
    component: resolve =>
      require(['../../components/RouterView/index.vue'], resolve),
    menu: true,
    childrenMenu: true
  },
  {
    businessId: 13,
    method: 'GET',
    id: 16,
    parentId: 'cardParent',
    path: '/news/card/template',
    title: '卡片模板管理',
    name: 'CardTemplate',
    component: resolve =>
      require(['../../containers/Content/Card/Template/index.vue'], resolve),
    meta: {
      breadcrumb: [
        { name: '首页', url: '/' },
        { name: '卡片管理' },
        { name: '卡片模板管理' }
      ]
    }
  },
  {
    businessId: 13,
    method: 'GET',
    id: 17,
    parentId: 'cardParent',
    path: '/news/card/setting',
    title: '卡片设置',
    name: 'CardSetting',
    component: resolve =>
      require(['../../containers/Content/Card/Setting/index.vue'], resolve),
    meta: {
      breadcrumb: [
        { name: '首页', url: '/' },
        { name: '卡片管理' },
        { name: '卡片设置' }
      ]
    }
  },
  {
    businessId: 13,
    method: 'GET',
    id: 18,
    parentId: 'cardParent',
    path: '/news/card/record',
    title: '卡片投放记录',
    name: 'CardRecord',
    component: resolve =>
      require(['../../containers/Content/Card/Record/index.vue'], resolve),
    meta: {
      breadcrumb: [
        { name: '首页', url: '/' },
        { name: '卡片管理' },
        { name: '卡片投放记录' }
      ]
    }
  },
  {
    businessId: 13,
    method: 'GET',
    id: 19,
    parentId: 'cardParent',
    path: '/news/card/stickstyle',
    title: '置顶样式选择',
    name: 'StickStyle',
    component: resolve =>
      require(['../../containers/Content/Card/StickStyle/index.vue'], resolve),
    meta: {
      breadcrumb: [
        { name: '首页', url: '/' },
        { name: '卡片管理' },
        { name: '置顶样式选择' }
      ]
    }
  }
]

import http from '../nhHttp'

export const getStickStyle = async () =>
  await http.get('/api/subjectCard/StickStyle')

export const modifyStickStyle = async () =>
  await http.put('/api/subjectCard/StickStyle')
