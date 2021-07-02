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
    ['script', { "src": 'https://cdn.jsdelivr.net/npm/vue-next@0.0.1/packages/vue/dist/vue.esm-browser.js' }],
    ['script', { "src": 'https://cdn.jsdelivr.net/npm/vue-next@0.0.1/packages/vue/dist/vue.global.js' }],
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
				"path": '/reactive/', 
				"children": [
					{
						"title": "第一章 Proxy响应式",
						"children": [
							[
								"reactive/reactive",
								"reactive",
							],[
								"reactive/effect",
								"effect",
							],[
								"reactive/ref",
								"ref",
							],[
								"reactive/computed",
								"computed",
							],[
								"reactive/baseHandlers",
								"baseHandlers",
							],[
								"reactive/collectionHandlers",
								"collectionHandlers",
							],
						]
					}
				]
			},
		]
	},
	"base": ""
}