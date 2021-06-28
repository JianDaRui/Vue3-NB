module.exports = {
  "title": "Vue-next深入浅出",
	"description": "Vue-next深入浅出源码解析",
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
				"link": "/me"
			},
		],
		"sidebar": [
			[
				"/",
				"前言"
			],
			{
				"title": "响应式",
				"collapsable": true,
				"children": [
					{
						"title": "第一章 Proxy响应式",
						"children": [
							[
								"/reactive/index",
								"React理念"
							],
						]
					}
				]
			},
		
	
		]
	},
	"base": ""
}