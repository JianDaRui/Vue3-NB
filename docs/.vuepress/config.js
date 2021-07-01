module.exports = {
  "title": "Vue3深入浅出",
	"description": "Vue3深入浅出源码解析",
	"dest": "dist",
	"serviceWorker": false,
	"head": [
		["script", { "src": "/assets/js/tj.js" }]
	],
	"configureWebpack": {
		"resolve": {
			"alias": {}
		}
	},
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