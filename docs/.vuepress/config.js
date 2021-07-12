module.exports = {
  "title": "Vue3深入浅出",
	"description": "Vue3深入浅出源码解析",
	"dest": "dist",
	"serviceWorker": false,
	"head": [
		["script", { "src": "/assets/js/tj.js" }],
		['script', { "src": 'https://cdn.jsdelivr.net/npm/react/umd/react.production.min.js' }],
    ['script', { "src": 'https://cdn.jsdelivr.net/npm/react-dom/umd/react-dom.production.min.js' }],
    ['script', { "src": 'https://cdn.jsdelivr.net/npm/vue/dist/vue.min.js' }],
    ['script', { "src": 'https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js' }],
	],
	"configureWebpack": {
		"resolve": {
			"alias": {}
		}
	},
	"plugins": [
    'demo-block'
  ],
	"markdown": {},
	"themeConfig": {
		"repo": "JianDaRui/Vue-Next-NB",
		"repoLabel": "点亮⭐不迷路",
		"editLinks": true,
		"docsDir": "docs",
		"editLinkText": "为该章节纠错",
		"lastUpdated": "上次更新",
		"nav": [
			{
				"text": "🐂一起变强",
				"link": "/about"
			},
		],
		"sidebar": [
			[
				"/",
				"前言"
			],
			{
				"title": "第一篇 依赖收集&变化侦测",
				"collapsable": true,
				"children": [
					{
						"title": "第一章 新旧响应式原理对比",
						"children": [
							[
								"/reactive/new_vs_old/proxy",
								"Object.defineProperty与Proxy",
							],[
								"/reactive/new_vs_old/module",
								"观察者模式与代理模式",
							],[
								"/reactive/new_vs_old/summary",
								"总结",
							]
						]
					},
					{
						"title": "第二章 基本类型、对象、数组的处理",
						"children": [
							[
								"/reactive/base_object_array/track&trigger",
								"如何Track&Trigger",
							],[
								"/reactive/base_object_array/effect&data",
								"依赖与数据",
							],[
								"/reactive/base_object_array/relation",
								"数据与依赖的关系",
							],[
								"/reactive/base_object_array/summary",
								"总结",
							]
						]
					},
					{
						"title": "第三章 Map与Set类型的处理",
						"children": [
							[
								"/reactive/map_set/map&set",
								"字典与集合",
							],[
								"/reactive/map_set/iterable&forEach",
								"迭代模式&遍历模式",
							],[
								"/reactive/map_set/adrc",
								"增删改查",
							],[
								"/reactive/map_set/summary",
								"总结",
							]
						]
					},
					{
						"title": "第四章 Reactive相关的API实现",
						"children": [
							[
								"/reactive/api/reactive",
								"reactive",
							],[
								"/reactive/api/ref",
								"ref",
							],[
								"/reactive/api/computed",
								"computed",
							],[
								"/reactive/api/effect",
								"effect",
							],[
								"/reactive/api/summary",
								"总结",
							]
						]
					}
				]
			},
		]
	},
	"base": ""
}