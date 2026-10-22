extends Control
const Network = preload("res://scripts/network.gd")
const WorldMap = preload("res://scripts/world_map.gd")
var net: SquarelandsConnection
var map: SquarelandsMap
var state: Dictionary = {}
var pending: Dictionary = {}
var catalog: Dictionary = {}
var current_id := ""
var chosen := Vector2i(-99999,-99999)
var build_type := ""
var language := "zh"
var connected_address := ""
var login_fields: Dictionary = {}
var login_panel: PanelContainer
var hud: HBoxContainer
var cities_box: VBoxContainer
var inspector: VBoxContainer
var toolbar: HBoxContainer
var hint: Label
var toast_label: Label
var toast_timer := 0.0
var screen: Window
var active_page := ""
var form_window: Window
var content: VBoxContainer
var page_scroll: ScrollContainer
var ui_font: Font
var seen_version := ""
var remembered_username := ""
const ACCENT := Color("426d58")

func tx(zh: String,en: String) -> String:
	return en if language=="en" else zh

func label_name(value: String) -> String:
	return str(catalog.get("english",{}).get(value,value)) if language=="en" else value

func resource_name(key: String) -> String:
	return label_name(str(catalog.get("resources",{}).get(key,[key])[0]))

func username(id: String) -> String:
	for p in state.get("players",[]):
		if p.id==id: return p.username
	return id

func city_by(id: String) -> Dictionary:
	for c in state.get("cities",[]):
		if c.id==id: return c
	return {}

func current() -> Dictionary:
	return city_by(current_id)

func mine(c: Dictionary) -> bool:
	return not c.is_empty() and c.owner==state.get("user",{}).get("id","")

func button(parent: Node,text: String,callback: Callable) -> Button:
	var b := Button.new()
	b.text=text
	b.custom_minimum_size.y=38
	b.pressed.connect(callback)
	parent.add_child(b)
	return b

func text(parent: Node,value: String,size_px: int=16,color: Color=Color("354c55")) -> Label:
	var node := Label.new()
	node.text=value
	node.add_theme_font_size_override("font_size",size_px)
	node.add_theme_color_override("font_color",color)
	node.autowrap_mode=TextServer.AUTOWRAP_OFF if parent is HBoxContainer else TextServer.AUTOWRAP_WORD_SMART
	node.clip_text=parent is HBoxContainer
	if parent is HBoxContainer and ui_font:node.custom_minimum_size.x=minf(340,ui_font.get_string_size(value,HORIZONTAL_ALIGNMENT_LEFT,-1,size_px).x+4)
	parent.add_child(node)
	return node

func clear(parent: Node) -> void:
	for node in parent.get_children():
		parent.remove_child(node)
		node.queue_free()

func box_style(color: Color,border: Color=Color("89795d"),radius: int=0) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color=color
	style.border_color=border
	style.set_border_width_all(2)
	style.set_corner_radius_all(radius)
	style.content_margin_left=14
	style.content_margin_right=14
	style.content_margin_top=10
	style.content_margin_bottom=10
	return style

func panel(rect: Rect2) -> PanelContainer:
	var node := PanelContainer.new()
	node.position=rect.position
	node.size=rect.size
	node.add_theme_stylebox_override("panel",box_style(Color("f0e5c7")))
	add_child(node)
	return node

func _ready() -> void:
	var preferences := ConfigFile.new()
	preferences.load("user://preferences.cfg")
	language=preferences.get_value("client","language","zh" if OS.get_locale_language()=="zh" else "en")
	connected_address=preferences.get_value("client","address","127.0.0.1:3211")
	remembered_username=preferences.get_value("client","username","")
	seen_version=preferences.get_value("client","seen_version","")
	if FileAccess.file_exists("res://assets/catalog.json"):
		catalog=JSON.parse_string(FileAccess.get_file_as_string("res://assets/catalog.json"))
	if ResourceLoader.exists("res://assets/NotoSansSC.ttf"):
		var variation := FontVariation.new()
		var base_font: FontFile=load("res://assets/NotoSansSC.ttf")
		base_font.antialiasing=TextServer.FONT_ANTIALIASING_NONE
		base_font.multichannel_signed_distance_field=false
		variation.base_font=base_font
		variation.variation_opentype={"wght":450.0}
		ui_font=variation
	else:
		var system := SystemFont.new()
		system.font_names=PackedStringArray(["PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Arial"])
		ui_font=system
	var theme_new := Theme.new()
	theme_new.default_font=ui_font
	theme_new.default_font_size=16
	theme_new.set_color("font_color","Label",Color("354c55"))
	for style in ["normal","focus"]: theme_new.set_stylebox(style,"Button",box_style(Color("e2d6b4")))
	theme_new.set_stylebox("hover","Button",box_style(Color("d1d2ac"),ACCENT))
	theme_new.set_stylebox("pressed","Button",box_style(Color("b8c39a"),ACCENT))
	theme_new.set_color("font_color","Button",Color("254c49"))
	theme_new.set_color("font_hover_color","Button",Color("153d39"))
	theme_new.set_stylebox("normal","LineEdit",box_style(Color("f8edcf")))
	theme_new.set_color("font_color","LineEdit",Color("233f45"))
	theme_new.set_color("font_placeholder_color","LineEdit",Color("7c9296"))
	theme_new.set_stylebox("panel","PopupMenu",box_style(Color("f0e5c7")))
	theme=theme_new
	net=Network.new()
	add_child(net)
	net.message.connect(_message)
	net.connection_lost.connect(func(reason):
		notify(reason)
		show_login())
	map=WorldMap.new()
	map.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	map.font=ui_font
	add_child(map)
	map.tile_selected.connect(_tile_selected)
	map.hovered.connect(func(tile):
		if hint: hint.text="%d, %d  ·  " % [tile.x,tile.y]+tx("拖动地图 · 滚轮缩放 · WASD 平移 · B 建造 · Esc 取消","Drag to pan · Wheel to zoom · WASD · B build · Esc cancel"))
	show_login()
	if "--demo" in OS.get_cmdline_user_args():
		var fixture=JSON.parse_string(FileAccess.get_file_as_string("res://assets/demo.json"))
		if fixture is Dictionary: apply_state(fixture)
	resized.connect(layout_ui)

func save_preferences() -> void:
	if not OS.get_environment("SQUARELANDS_TEST_ADDRESS").is_empty():return
	var preferences := ConfigFile.new()
	preferences.set_value("client","language",language)
	preferences.set_value("client","address",connected_address)
	preferences.set_value("client","username",remembered_username)
	preferences.set_value("client","seen_version",seen_version)
	preferences.save("user://preferences.cfg")

func notify(value: String) -> void:
	if not is_instance_valid(toast_label):
		toast_label=Label.new()
		toast_label.add_theme_stylebox_override("normal",box_style(Color("fff6db")))
		toast_label.add_theme_color_override("font_color",Color("52482d"))
		toast_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
		toast_label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
		add_child(toast_label)
	toast_label.text=value
	toast_label.position=Vector2(size.x*.22,80)
	toast_label.size=Vector2(size.x*.56,65)
	toast_label.show()
	toast_label.move_to_front()
	toast_timer=6

func _process(delta: float) -> void:
	if toast_timer>0:
		toast_timer-=delta
		if toast_timer<=0 and is_instance_valid(toast_label): toast_label.hide()

func show_login() -> void:
	for child in get_children():
		if child is PanelContainer:child.hide()
	if is_instance_valid(screen): screen.hide()
	if is_instance_valid(form_window): form_window.hide()
	if is_instance_valid(login_panel): login_panel.queue_free()
	login_panel=panel(Rect2(Vector2(size.x/2-220,size.y/2-255),Vector2(440,510)))
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation",14)
	login_panel.add_child(col)
	text(col,"S Q U A R E L A N D S",25,ACCENT)
	text(col,tx("方域 · 建造你的世界","Build a world of your own"),19)
	text(col,tx("原生策略客户端  /  TCP 长连接","Native strategy client  /  TCP connection"),13)
	login_fields={}
	for field in [["address",tx("服务端 IP / 域名:端口","Server IP / domain:port"),connected_address],["username",tx("用户名","Username"),remembered_username],["password",tx("密码","Password"),""]]:
		text(col,field[1],14)
		var input := LineEdit.new()
		input.text=field[2]
		input.secret=field[0]=="password"
		input.custom_minimum_size.y=40
		col.add_child(input)
		login_fields[field[0]]=input
		input.text_submitted.connect(func(_value): authenticate(false))
	var row := HBoxContainer.new()
	col.add_child(row)
	button(row,tx("连接并登录","Connect & play"),func():authenticate(false))
	button(row,tx("注册账号","Register"),func():authenticate(true))
	button(col,"English / 简体中文",switch_language)
	text(col,tx("默认 TCP 端口 3211；加密连接可填写 tls://域名:端口。","Default TCP port 3211; use tls://domain:port for TLS."),12)

func authenticate(register_user: bool) -> void:
	connected_address=login_fields.address.text.strip_edges()
	remembered_username=login_fields.username.text.strip_edges()
	var credentials := {"username":remembered_username,"password":login_fields.password.text}
	var error := net.open(connected_address)
	if error!=OK:
		notify(tx("连接地址无效或无法连接","Invalid address or connection failed"))
		return
	pending.clear()
	var id := net.request("register" if register_user else "login",credentials)
	pending[id]={"op":"auth"}
	notify(tx("正在连接世界…","Connecting to world…"))
	save_preferences()

func send(op: String,data: Dictionary={}) -> int:
	var world_token: String=""
	if op=="state" and state.has("world"):world_token=str(state.world.seed)+":"+str(state.world.revision)
	var id := net.request(op,data,world_token)
	pending[id]={"op":op,"data":data.duplicate(true)}
	return id

func act(action: String,data: Dictionary={}) -> void:
	var payload := data.duplicate(true)
	payload.action=action
	if not payload.has("cityId") and current_id!="": payload.cityId=current_id
	send("action",payload)

func _message(value: Dictionary) -> void:
	if value.get("event","")=="state":
		apply_state(value.data)
		return
	if value.get("event","")=="sessionExpired":
		notify(str(value.get("error","Session expired")))
		net.close()
		show_login()
		return
	var id := int(value.get("id",0))
	if not pending.has(id): return
	var request: Dictionary = pending[id]
	pending.erase(id)
	if not value.get("ok",false):
		notify(str(value.get("error","Request failed")))
		if value.has("shortage") and request.op=="action" and not request.data.has("shortageMode"):
			shortage_dialog(request.data,value.shortage)
		return
	var data = value.get("data",{})
	match request.op:
		"logout":
			net.close()
			state={}
			map.state={}
			show_login()
		"auth": send("subscribe")
		"subscribe","state": apply_state(data)
		"action","admin":
			notify(tx("操作已提交","Order received"))
			if is_instance_valid(form_window): form_window.hide()
			send("state")
		"adminState": render_admin(data)

func apply_state(value: Dictionary) -> void:
	if value.has("world") and not value.world.has("tiles") and state.has("world"):
		value.world.tiles=state.world.get("tiles",[])
	state=value
	if not mine(current()):
		current_id=""
		for c in state.get("cities",[]):
			if mine(c): current_id=c.id; break
	map.state=state
	if is_instance_valid(login_panel):
		login_panel.queue_free()
		login_panel=null
		build_game_ui()
		var c := current()
		map.center_on(Vector2(c.get("x",15),c.get("y",15)))
	render_hud()
	render_inspector()
	if is_instance_valid(screen) and screen.visible and not (is_instance_valid(form_window) and form_window.visible): render_page(active_page)
	if seen_version!=str(state.get("version","")):
		seen_version=str(state.get("version",""))
		save_preferences()
		notify(tx("欢迎进入原生方域！版本 ","Welcome to native Squarelands! Version ")+seen_version+tx(" · B 建造，Tab 库存，Esc 取消"," · B build, Tab inventory, Esc cancel"))

func switch_language() -> void:
	language="en" if language=="zh" else "zh"
	save_preferences()
	if state.is_empty(): show_login()
	else:
		build_game_ui()
		render_hud()
		render_inspector()

func build_game_ui() -> void:
	for node in get_children():
		if node!=map and node!=net and node!=toast_label and not node is Window: node.queue_free()
	var header := panel(Rect2(16,12,size.x-32,62))
	header.name="Header"
	hud=HBoxContainer.new()
	hud.add_theme_constant_override("separation",18)
	header.add_child(hud)
	var left := panel(Rect2(16,90,190,size.y-250))
	left.name="Cities"
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED
	left.add_child(scroll)
	cities_box=VBoxContainer.new()
	cities_box.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	scroll.add_child(cities_box)
	var right := panel(Rect2(size.x-330,90,314,size.y-250))
	right.name="Inspector"
	var right_scroll := ScrollContainer.new()
	right_scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED
	right.add_child(right_scroll)
	inspector=VBoxContainer.new()
	inspector.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	inspector.add_theme_constant_override("separation",10)
	right_scroll.add_child(inspector)
	var bottom := panel(Rect2(222,size.y-146,size.x-238,130))
	bottom.name="Toolbar"
	var col := VBoxContainer.new()
	bottom.add_child(col)
	var nav := HBoxContainer.new()
	col.add_child(nav)
	for entry in [["inventory","库存","Inventory"],["market","市场","Market"],["logistics","运输","Freight"],["alliance","联盟","Alliance"],["messages","通讯","Messages"],["settings","城政","City"],["guide","手册","Guide"]]:
		button(nav,tx(entry[1],entry[2]),func():open_page(entry[0]))
	button(nav,"EN/中",switch_language)
	if state.get("user",{}).get("role","")=="root": button(nav,"ROOT",func():send("adminState"))
	button(nav,tx("离开","Leave"),func():send("logout"))
	var build_row := HBoxContainer.new()
	col.add_child(build_row)
	button(build_row,tx("建造 [B]","Build [B]"),build_menu)
	button(build_row,tx("铺轨","Rail"),func():set_build_mode("rail"))
	button(build_row,tx("建立城池","Found city"),func():set_build_mode("found"))
	button(build_row,tx("定位城池","Focus city"),func():var c=current();map.center_on(Vector2(c.get("x",15),c.get("y",15))))
	hint=text(col,tx("拖动地图 · 滚轮缩放 · WASD 平移","Drag map · Wheel zoom · WASD pan"),12)

func layout_ui() -> void:
	if is_instance_valid(login_panel):
		login_panel.position=Vector2(size.x/2-220,size.y/2-255)
	for node in get_children():
		if node.name=="Header": node.size.x=size.x-32
		elif node.name=="Cities": node.size.y=size.y-250
		elif node.name=="Inspector": node.position.x=size.x-330;node.size.y=size.y-250
		elif node.name=="Toolbar": node.position.y=size.y-146;node.size.x=size.x-238

func render_hud() -> void:
	if not is_instance_valid(hud): return
	clear(hud)
	text(hud,"SQUARELANDS",19,ACCENT)
	var c := current()
	text(hud,str(c.get("name",tx("选择城池","Select city"))),18)
	for k in ["money","wood","stone","iron","food","power"]:
		text(hud,resource_name(k)+"  "+str(int(c.get("stock",{}).get(k,0))),15)
	if state.get("paused",false): text(hud,tx("世界已暂停","WORLD PAUSED"),14,Color("b66d35"))
	clear(cities_box)
	text(cities_box,tx("你的城池","YOUR CITIES"),13,ACCENT)
	for city in state.get("cities",[]):
		if mine(city):
			button(cities_box,city.name+"  Lv."+str(int(city.level)),func():current_id=city.id;map.center_on(Vector2(city.x,city.y));render_hud();render_inspector())
	text(cities_box,tx("世界纪事","WORLD CHRONICLE"),13,ACCENT)
	for event in state.get("events",[]).slice(0,5): text(cities_box,str(event.message),12)

func _tile_selected(tile: Vector2i) -> void:
	chosen=tile
	if build_type!="":
		if build_type=="found":
			show_form(tx("建立新城","Found city"),[{"key":"name","label":tx("城池名称","City name"),"value":tx("新城","New city")}],func(p):p.x=tile.x;p.y=tile.y;p.sourceCityId=current_id;act("found",p))
		else: act("rail" if build_type=="rail" else "build",{"x":tile.x,"y":tile.y,"type":build_type})
		return
	var claim: String = state.get("claims",{}).get("%d,%d" % [tile.x,tile.y],"")
	var c := city_by(claim)
	if mine(c): current_id=c.id;render_hud()
	render_inspector()

func set_build_mode(type: String) -> void:
	build_type=type
	map.build_mode=type
	if is_instance_valid(screen): screen.hide()
	notify(tx("连续建造：点击地图放置，Esc 结束","Build mode: click map to place, Esc to exit")+" · "+type)

func render_inspector() -> void:
	if not is_instance_valid(inspector): return
	clear(inspector)
	var c := current()
	text(inspector,str(c.get("name",tx("欢迎来到方域","Welcome to Squarelands"))),23,ACCENT)
	if not c.is_empty():
		text(inspector,tx("人口 %d · 城市等级 %d\n领地 %d / %d · 仓储 %d\n建筑可用工人 %d · 运输可用 %d","Population %d · Level %d\nTerritory %d / %d · Storage %d\nAvailable builders %d · Freight %d") % [c.population,c.level,c.get("territoryUsed",0),c.get("territoryCapacity",0),c.get("capacity",0),c.get("constructionAvailable",0),c.get("transportAvailable",0)],14)
		if mine(c): button(inspector,tx("升级城市","Upgrade city"),func():act("upgrade"))
	if chosen.x==-99999:
		text(inspector,tx("点击地块查看详情。\nB 打开建造目录，选择设施后在地图连续放置。","Select a tile to inspect.\nPress B to choose a building, then place it on the map."),15)
		return
	var k := "%d,%d" % [chosen.x,chosen.y]
	text(inspector,tx("地块 ","TILE ")+k,18,ACCENT)
	var tile := tile_info(chosen)
	if tile.is_empty(): return
	text(inspector,label_name(str(catalog.get("terrains",{}).get(tile.terrain,{}).get("name",tile.terrain)))+" · "+(resource_name(str(tile.deposit)) if tile.get("deposit")!=null else tx("无矿藏","No deposit")),14)
	var owner := city_by(state.get("claims",{}).get(k,""))
	if not owner.is_empty(): text(inspector,owner.name+" / "+owner.ownerName,14)
	var building: Dictionary = {}
	for city in state.get("cities",[]):
		for b in city.buildings:
			if int(b.x)==chosen.x and int(b.y)==chosen.y: building=b
	if not building.is_empty():
		text(inspector,label_name(state.settings.buildings[building.type].name)+"  Lv."+str(int(building.level)),18)
		if building.get("readyAt"):
			text(inspector,tx("施工中，剩余 ","Under construction, remaining ")+str(maxi(0,int((float(building.readyAt)-float(state.serverTime))/1000)))+"s")
		var def: Dictionary = state.settings.buildings[building.type].duplicate(true)
		def.merge(building.get("overrides",{}),true)
		for flow in ["input","output"]:
			for key in def.get(flow,{}): text(inspector,(tx("消耗 ","Input ") if flow=="input" else tx("产出 ","Output "))+resource_name(key)+"  "+str(float(def[flow][key])*float(building.level)),13)
		if mine(owner):
			button(inspector,tx("升级建筑","Upgrade building"),func():act("upgrade",{"buildingId":building.id}))
			button(inspector,tx("拆除建筑","Demolish"),func():confirm_order(tx("确认拆除建筑？","Demolish building?"),func():act("demolish",{"buildingId":building.id})))
			if building.type in ["farm","vegetableFarm"]: button(inspector,tx("切换粮田 / 蔬菜田","Convert field"),func():act("convertFarm",{"buildingId":building.id}))
	if owner.is_empty() and mine(c): button(inspector,tx("解锁地块","Claim tile"),func():act("unlock",{"x":chosen.x,"y":chosen.y}))
	if mine(owner):
		button(inspector,tx("拆除铁路","Remove rail") if state.rails.has(k) else tx("铺设铁路","Lay rail"),func():act("removeRail" if state.rails.has(k) else "rail",{"cityId":owner.id,"x":chosen.x,"y":chosen.y}))
		if chosen!=Vector2i(owner.x,owner.y):
			button(inspector,tx("转交交界城池","Transfer to bordering city"),func():show_form(tx("转让地块","Transfer tile"),[{"key":"to","label":tx("接收城池","Destination"),"options":city_options(true,owner.id)}],func(p):p.x=chosen.x;p.y=chosen.y;p.cityId=owner.id;act("transferTile",p)))
			button(inspector,tx("放弃地块","Abandon tile"),func():confirm_order(tx("确认放弃空地？","Abandon cleared tile?"),func():act("abandonTile",{"cityId":owner.id,"x":chosen.x,"y":chosen.y})))
	if state.user.role=="root": button(inspector,tx("ROOT 编辑地块","ROOT edit tile"),tile_editor)

func tile_info(tile: Vector2i) -> Dictionary:
	var w: Dictionary = state.get("world",{})
	var x := tile.x-int(w.get("minX",0))
	var y := tile.y-int(w.get("minY",0))
	if x<0 or y<0 or x>=int(w.get("width",0)) or y>=int(w.get("height",0)): return {}
	var i := y*int(w.width)+x
	return w.get("tiles",[])[i] if i<w.get("tiles",[]).size() else {}

func open_page(page: String) -> void:
	active_page=page
	if not is_instance_valid(screen):
		screen=Window.new()
		screen.title="Squarelands"
		screen.transient=true
		screen.close_requested.connect(func():screen.hide())
		add_child(screen)
	screen.size=Vector2i(mini(1080,int(size.x)-80),mini(680,int(size.y)-80))
	screen.popup_centered()
	render_page(page)

func page_body(title: String) -> VBoxContainer:
	for child in screen.get_children(): child.queue_free()
	var background := PanelContainer.new()
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.add_theme_stylebox_override("panel",box_style(Color("f0e5c7")))
	screen.add_child(background)
	var outer := VBoxContainer.new()
	background.add_child(outer)
	var row := HBoxContainer.new()
	outer.add_child(row)
	var heading := text(row,title,24,ACCENT)
	heading.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	button(row,tx("关闭 [Esc]","Close [Esc]"),func():screen.hide())
	var scroll := ScrollContainer.new()
	page_scroll=scroll
	scroll.size_flags_vertical=Control.SIZE_EXPAND_FILL
	outer.add_child(scroll)
	content=VBoxContainer.new()
	content.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation",12)
	scroll.add_child(content)
	return content

func render_page(page: String) -> void:
	var saved_scroll: int=page_scroll.scroll_vertical if is_instance_valid(page_scroll) else 0
	match page:
		"inventory": render_inventory()
		"market": render_market()
		"logistics": render_logistics()
		"alliance": render_alliance()
		"messages": render_messages()
		"settings": render_city_settings()
		"guide": render_guide()
		"build": build_menu(false)

	if is_instance_valid(page_scroll): page_scroll.set_deferred("scroll_vertical",saved_scroll)

func build_menu(open: bool=true) -> void:
	if open: open_page("build");return
	page_body(tx("建设目录 · 选择后点击地图放置","Build menu · select and place on map"))
	for category in ["生产","工业","设施","城市","民生"]:
		text(content,label_name(category),19,ACCENT)
		var grid := GridContainer.new()
		grid.columns=3
		content.add_child(grid)
		for key in state.settings.buildings:
			var def: Dictionary = state.settings.buildings[key]
			if def.category!=category: continue
			var b := button(grid,label_name(def.name),func():set_build_mode(key))
			b.custom_minimum_size=Vector2(260,56)
			b.tooltip_text=JSON.stringify(def.cost)+"\n"+tx("岗位 ","Jobs ")+str(def.workers)

func render_inventory() -> void:
	page_body(tx("仓储总览","Warehouse"))
	var c := current()
	if c.is_empty(): return
	text(content,c.name+" · "+tx("每种库存上限 ","Capacity per resource ")+str(int(c.capacity)))
	var grid := GridContainer.new()
	grid.columns=4
	content.add_child(grid)
	for key in c.stock:
		var tile := PanelContainer.new()
		tile.add_theme_stylebox_override("panel",box_style(Color("e2d9b8")))
		grid.add_child(tile)
		var col := VBoxContainer.new()
		tile.add_child(col)
		text(col,resource_name(key),15)
		text(col,str(snappedf(float(c.stock[key]),.1))+"  /  "+str(int(c.capacity)) if key!="money" else str(int(c.stock[key])),20,ACCENT)
		text(col,"%+.1f / %s" % [float(c.get("rates",{}).get(key,0)),tx("周期","cycle")],13)
		if key!="money": button(col,tx("补货 / 出售阈值","Thresholds"),func():threshold_form(key))
	text(content,tx("每种资源独立容量。补货默认 5%，自动出售默认保留 95%；仓储与车站、机场直连。","Each resource has its own capacity. Restock defaults to 5%, sale retention 95%. Stations and airports directly access storage."),14)

func city_options(owned: bool=true,exclude: String="") -> Array:
	var options: Array=[]
	for c in state.get("cities",[]):
		if (not owned or mine(c)) and c.id!=exclude: options.append({"id":c.id,"label":c.name})
	return options

func resource_options(money: bool=false) -> Array:
	var options: Array=[]
	for key in catalog.get("resources",{}):
		if key!="money" or money: options.append({"id":key,"label":resource_name(key)})
	return options

func player_options(exclude: Array=[]) -> Array:
	var options: Array=[]
	for p in state.get("players",[]):
		if not p.id in exclude: options.append({"id":p.id,"label":p.username})
	return options

func amount_field(value: float=50) -> Dictionary:
	return {"key":"amount","label":tx("数量","Amount"),"type":"number","min":1,"max":state.get("settings",{}).get("trade",{}).get("maxAmount",10000),"value":value}

func threshold_form(resource: String) -> void:
	show_form(resource_name(resource),[{"key":"kind","label":tx("阈值类型","Threshold type"),"options":[{"id":"supplyThreshold","label":tx("补货下限","Restock floor")},{"id":"threshold","label":tx("出售保留量","Sale retention")}]},{"key":"mode","label":tx("模式","Mode"),"options":[{"id":"default","label":tx("服务器默认比例","Server default")},{"id":"custom","label":tx("自定义数量","Custom amount")},{"id":"disabled","label":tx("关闭","Disabled")}]},{"key":"value","label":tx("自定义阈值","Custom threshold"),"type":"number","max":1000000,"value":0}],func(p):var kind=p.kind;p.erase("kind");p.resource=resource;act(kind,p))

func render_market() -> void:
	page_body(tx("贸易市场","Trade market"))
	button(content,tx("官方市场买入 / 卖出","Official market buy / sell"),func():show_form(tx("官方市场","Official market"),[{"key":"resource","label":tx("物资","Resource"),"options":resource_options()},{"key":"side","label":tx("方向","Side"),"options":[{"id":"buy","label":tx("买入","Buy")},{"id":"sell","label":tx("卖出","Sell")}]},amount_field()],func(p):act("shop",p)))
	button(content,tx("发布现货 / 产能订单","Post spot / capacity offer"),func():show_form(tx("发布订单","Post offer"),[{"key":"kind","label":tx("类型","Kind"),"options":[{"id":"spot","label":tx("现货","Spot")},{"id":"capacity","label":tx("未来产能","Capacity")}]},{"key":"resource","label":tx("物资","Resource"),"options":resource_options()},amount_field(),{"key":"price","label":tx("单价","Unit price"),"type":"number","min":.1,"step":.1,"value":1},{"key":"cycles","label":tx("产能期数","Capacity cycles"),"type":"number","min":1,"max":20,"value":3}],func(p):act("offer",p)))
	for offer in state.get("offers",[]):
		var row := HBoxContainer.new()
		content.add_child(row)
		var l := text(row,resource_name(offer.resource)+" × "+str(offer.amount)+" · "+str(offer.price)+" · "+str(offer.seller)+" · "+str(offer.kind),16)
		l.size_flags_horizontal=Control.SIZE_EXPAND_FILL
		button(row,tx("撤单","Cancel") if offer.owner==state.user.id else tx("买入","Buy"),func():act("cancelOffer" if offer.owner==state.user.id else "buyOffer",{"offerId":offer.id,"cityId":offer.cityId if offer.owner==state.user.id else current_id}))
	text(content,tx("在售城池","Cities for sale"),20,ACCENT)
	for c in state.get("cities",[]):
		if c.get("salePrice")!=null and not mine(c): button(content,c.name+" · "+str(c.salePrice),func():act("buyCity",{"targetId":c.id}))
	for contract in state.get("contracts",[]): text(content,tx("合约 ","Contract ")+resource_name(contract.resource)+" × "+str(contract.amount)+" · "+str(contract.status)+" · "+tx("剩余 ","Remaining ")+str(contract.remaining))

func render_logistics() -> void:
	page_body(tx("运输网络","Transport network"))
	for kind in ["transfer","transferRule"]:
		button(content,tx("即时城际调拨","Dispatch freight") if kind=="transfer" else tx("设置每周期调拨","Set recurring transfer"),func():show_form(tx("城际调拨","Intercity freight"),[{"key":"to","label":tx("接收城池","Destination"),"options":city_options(true,current_id)},{"key":"resource","label":tx("物资","Resource"),"options":resource_options(true)},amount_field()],func(p):act(kind,p)))
	for rule in current().get("transferRules",[]): button(content,tx("删除周期规则：","Remove recurring rule: ")+resource_name(rule.resource)+" → "+str(city_by(rule.to).get("name","")),func():act("removeTransferRule",{"ruleId":rule.id}))
	for sh in state.get("shipments",[]):
		text(content,str(city_by(sh.from).get("name","?"))+" → "+str(city_by(sh.to).get("name","?"))+" · "+resource_name(sh.resource)+" × "+str(sh.amount),18,ACCENT)
		text(content,str(sh.get("mode","road"))+" · "+tx("运费 ","Fee ")+str(sh.fee)+" · "+tx("工人 ","Crew ")+str(sh.workers)+" · "+str(sh.status),14)
		var bar := ProgressBar.new()
		bar.max_value=100
		bar.value=100 if sh.status=="arrived" else clampf((float(state.serverTime)-float(sh.departAt))/maxf(1,float(sh.arriveAt)-float(sh.departAt))*100,0,100)
		content.add_child(bar)
		for mode in sh.get("fallbackReasons",{}):
			for reason in sh.fallbackReasons[mode]: text(content,mode+": "+str(reason.get(language,reason.get("en",""))),13)
	for operation in state.get("pendingActions",[]): text(content,tx("等待资源：","Waiting for resources: ")+operation.action)
	button(content,tx("取消本城待执行操作","Cancel queued city action"),func():act("cancelPending"))

func alliance_of(id: String) -> Dictionary:
	for a in state.get("alliances",[]):
		if id in a.members: return a
	return {}

func render_alliance() -> void:
	page_body(tx("联盟与外交","Alliances & diplomacy"))
	button(content,tx("设置领土颜色","Territory color"),func():show_form(tx("领土颜色","Territory color"),[{"key":"color","label":"#RRGGBB","value":state.get("profiles",{}).get(state.user.id,{}).get("color","#4b9b83")}],func(p):act("playerColor",p)))
	var own := alliance_of(state.user.id)
	if own.is_empty():
		button(content,tx("创建联盟","Create alliance"),func():show_form(tx("创建联盟","Create alliance"),[{"key":"name","label":tx("联盟名称","Alliance name"),"value":""}],func(p):act("allianceCreate",p)))
		for a in state.get("alliances",[]):
			text(content,a.name+" · "+str(a.members.size())+tx(" 位成员"," members"),20,ACCENT)
			var applying: bool = state.user.id in a.get("applications",[])
			button(content,tx("取消申请","Cancel application") if applying else tx("申请加入","Apply to join"),func():act("allianceCancelApplication" if applying else "allianceApply",{"allianceId":a.id}))
			if state.user.id in a.get("invitations",[]):
				button(content,tx("接受邀请","Accept invitation"),func():act("allianceAcceptInvite",{"allianceId":a.id}))
				button(content,tx("拒绝邀请","Decline invitation"),func():act("allianceDeclineInvite",{"allianceId":a.id}))
		return
	var founder: bool = own.founder==state.user.id
	var manager: bool = founder or state.user.id in own.admins
	text(content,own.name+" · "+tx("内部关税 ","Internal tariff ")+str(own.internal.tariff)+"% · "+tx("交易优惠 ","Discount ")+str(own.internal.discount)+"%",20,ACCENT)
	for id in own.members:
		var row := HBoxContainer.new()
		content.add_child(row)
		var l := text(row,username(id)+(" ★" if id==own.founder else " ◆" if id in own.admins else ""))
		l.size_flags_horizontal=Control.SIZE_EXPAND_FILL
		if founder and id!=state.user.id:
			button(row,tx("撤销管理","Remove admin") if id in own.admins else tx("设为管理","Make admin"),func():act("allianceAdmin",{"playerId":id,"value":not id in own.admins}))
			button(row,tx("转让创建者","Transfer leadership"),func():confirm_order(tx("转让联盟创建者？","Transfer leadership?"),func():act("allianceFounder",{"playerId":id})))
		if manager and id!=own.founder and id!=state.user.id and (founder or not id in own.admins):
			button(row,tx("移出","Remove"),func():confirm_order(tx("移出联盟成员？","Remove member?"),func():act("allianceKick",{"playerId":id})))
	if manager:
		var candidates: Array=[]
		for p in state.players:
			if alliance_of(p.id).is_empty(): candidates.append({"id":p.id,"label":p.username})
		button(content,tx("邀请玩家","Invite player"),func():show_form(tx("邀请玩家","Invite player"),[{"key":"playerId","label":tx("玩家","Player"),"options":candidates}],func(p):act("allianceInvite",p)))
		for id in own.get("invitations",[]): button(content,tx("撤回邀请：","Revoke invitation: ")+username(id),func():act("allianceRevokeInvite",{"playerId":id}))
		for id in own.get("applications",[]):
			var row := HBoxContainer.new()
			content.add_child(row)
			text(row,username(id)+tx(" 申请加入"," applied"))
			button(row,tx("批准","Approve"),func():act("allianceReview",{"playerId":id,"accept":true}))
			button(row,tx("拒绝","Reject"),func():act("allianceReview",{"playerId":id,"accept":false}))
		button(content,tx("联盟内部政策","Internal policy"),func():show_form(tx("内部政策","Internal policy"),[{"key":"tariff","label":tx("关税 %","Tariff %"),"type":"number","max":state.settings.trade.maxTariff,"value":own.internal.tariff},{"key":"discount","label":tx("交易优惠 %","Trade discount %"),"type":"number","max":50,"value":own.internal.discount}],func(p):act("alliancePolicy",p)))
		button(content,tx("联盟对外政策","External policy"),func():show_form(tx("对外政策","External policy"),[{"key":"playerId","label":tx("玩家","Player"),"options":player_options(own.members)},{"key":"tariff","label":tx("关税 %","Tariff %"),"type":"number","max":state.settings.trade.maxTariff},{"key":"embargo","label":tx("禁运","Embargo"),"type":"bool"},{"key":"remove","label":tx("移除此玩家覆盖政策","Remove override"),"type":"bool"}],func(p):act("alliancePolicy",p)))
		for id in own.external: text(content,username(id)+" · "+str(own.external[id].tariff)+"% · "+str(own.external[id].embargo))
	button(content,tx("解散联盟","Disband alliance") if founder else tx("退出联盟","Leave alliance"),func():confirm_order(tx("确认解散联盟？","Disband alliance?") if founder else tx("确认退出联盟？","Leave alliance?"),func():act("allianceDisband" if founder else "allianceLeave")))

func render_messages() -> void:
	page_body(tx("广播、私信与联盟频道","Broadcasts, whispers & alliance chat"))
	var recipients: Array=[{"id":"","label":tx("全服广播","Broadcast")},{"id":"alliance","label":tx("联盟频道","Alliance")}]
	recipients.append_array(player_options([state.user.id]))
	button(content,tx("发送消息","Send message"),func():show_form(tx("发送消息","Send message"),[{"key":"recipient","label":tx("发送到","Recipient"),"options":recipients},{"key":"text","label":tx("内容（最多 500 字）","Message (max 500 chars)"),"value":""}],func(p):
		if p.recipient=="alliance": p.channel="alliance"
		elif p.recipient!="": p.toUser=p.recipient
		p.erase("recipient")
		act("message",p)))
	var messages: Array=state.get("messages",[]).duplicate()
	messages.reverse()
	for m in messages:
		text(content,str(m.name)+" · "+(tx("联盟","Alliance") if m.get("allianceId") else tx("私信","Whisper") if m.get("to") else tx("广播","Broadcast")),15,ACCENT)
		text(content,str(m.text),17)

func render_city_settings() -> void:
	page_body(tx("城政与自动化","City management"))
	var c := current()
	if not mine(c): return
	for kind in [["constructionReserve","constructionReserve","预留建筑工人","Reserved builders"],["transportReserve","transportReserve","预留运输工人","Reserved freight workers"]]:
		button(content,tx(kind[2],kind[3])+" · "+str(c.get(kind[1],4)),func():show_form(tx(kind[2],kind[3]),[{"key":"value","label":tx("人数","Workers"),"type":"number","max":100000,"value":c.get(kind[1],4)}],func(p):act(kind[0],p)))
	button(content,tx("关闭自动补货","Disable automatic restocking") if c.get("autoSupply",true) else tx("开启自动补货","Enable automatic restocking"),func():act("autoSupply",{"value":not c.get("autoSupply",true)}))
	button(content,tx("库存阈值","Stock thresholds"),func():open_page("inventory"))
	button(content,tx("默认通行政策","Default transit policy"),func():policy_form(false))
	button(content,tx("针对玩家的通行政策","Per-player transit policy"),func():policy_form(true))
	button(content,tx("出售本城","Sell this city"),func():show_form(tx("城池出售","Sell city"),[{"key":"price","label":tx("售价","Price"),"type":"number","min":1,"max":100000000,"value":10000}],func(p):act("sellCity",p)))
	button(content,tx("取消出售","Cancel city sale"),func():act("sellCity",{"price":null}))

func policy_form(individual: bool) -> void:
	var fields: Array=[{"key":"tariff","label":tx("关税 %","Tariff %"),"type":"number","max":state.settings.trade.maxTariff,"value":current().policy.tariff},{"key":"embargo","label":tx("禁运","Embargo"),"type":"bool","value":current().policy.embargo}]
	if individual:
		fields.push_front({"key":"playerId","label":tx("玩家","Player"),"options":player_options([state.user.id])})
		fields.append({"key":"remove","label":tx("删除覆盖","Remove override"),"type":"bool"})
	show_form(tx("通行政策","Transit policy"),fields,func(p):act("policy",p))

func render_guide() -> void:
	page_body(tx("方域玩法手册","Squarelands field manual"))
	button(content,tx("安装客户端资源更新包 .pck","Install client resource update .pck"),install_client_update)
	button(content,tx("回退到内置客户端资源","Restore bundled client resources"),func():confirm_order(tx("删除资源更新并在重启后恢复内置客户端？","Remove update and restore bundled client after restart?"),func():DirAccess.remove_absolute(ProjectSettings.globalize_path("user://updates/Squarelands.pck"));notify(tx("已回退，请重启客户端","Restored; restart the client"))))

	for chapter in catalog.get("guide",{}).get(language,[]):
		text(content,chapter.title,21,ACCENT)
		text(content,chapter.text,17)
	text(content,tx("原生操作：鼠标拖动平移，滚轮缩放，WASD 移动地图，B 建造，Tab 库存，Esc 关闭窗口/取消建造，F11 全屏。连续放置保留当前工具。车站与机场直连本城仓储。","Native controls: drag to pan, scroll to zoom, WASD to move, B to build, Tab for inventory, Esc to close/cancel, F11 fullscreen. Building placement remains active for repeated construction. Stations and airports directly access city storage."),17)

func install_client_update() -> void:
	var picker := FileDialog.new()
	picker.file_mode=FileDialog.FILE_MODE_OPEN_FILE
	picker.access=FileDialog.ACCESS_FILESYSTEM
	picker.use_native_dialog=true
	picker.filters=PackedStringArray(["*.pck ; Squarelands client resource pack"])
	add_child(picker)
	picker.file_selected.connect(func(path):
		var input := FileAccess.open(path,FileAccess.READ)
		if input==null or input.get_length()<32 or input.get_length()>512*1024*1024:
			notify(tx("无效的客户端资源包","Invalid client resource pack"));picker.queue_free();return
		if input.get_buffer(4).get_string_from_ascii()!="GDPC":
			notify(tx("请选择 .pck 客户端包，不能使用服务端更新包","Choose a .pck client pack, not a server update"));picker.queue_free();return
		input.close()
		var folder := ProjectSettings.globalize_path("user://updates")
		DirAccess.make_dir_recursive_absolute(folder)
		var temporary := folder+"/Squarelands.pck.tmp"
		if DirAccess.copy_absolute(path,temporary)!=OK:
			notify(tx("复制更新包失败","Could not copy update pack"));picker.queue_free();return
		if FileAccess.file_exists(folder+"/Squarelands.pck"):DirAccess.remove_absolute(folder+"/Squarelands.pck")
		if DirAccess.rename_absolute(temporary,folder+"/Squarelands.pck")!=OK:notify(tx("安装失败","Installation failed"))
		else:notify(tx("资源更新已安装，退出并重新打开客户端后生效","Resource update installed; quit and reopen the client"))
		picker.queue_free())
	picker.canceled.connect(func():picker.queue_free())
	picker.popup_centered_ratio(.7)

func show_form(title: String,fields: Array,submit: Callable) -> void:
	if is_instance_valid(form_window): form_window.queue_free()
	form_window=Window.new()
	form_window.title=title
	form_window.transient=true
	form_window.exclusive=true
	form_window.size=Vector2i(540,mini(620,120+fields.size()*78))
	form_window.close_requested.connect(func():form_window.hide())
	add_child(form_window)
	var bg := PanelContainer.new()
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.add_theme_stylebox_override("panel",box_style(Color("f0e5c7")))
	form_window.add_child(bg)
	var scroll := ScrollContainer.new()
	bg.add_child(scroll)
	var col := VBoxContainer.new()
	col.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	scroll.add_child(col)
	text(col,title,22,ACCENT)
	var controls: Dictionary={}
	for field in fields:
		text(col,str(field.get("label",field.key)),14)
		var control: Control
		if field.has("options"):
			var option := OptionButton.new()
			for item in field.options:
				option.add_item(str(item.label))
				option.set_item_metadata(option.item_count-1,item.id)
				if str(item.id)==str(field.get("value","")): option.select(option.item_count-1)
			control=option
		elif field.get("type","")=="number":
			var spin := SpinBox.new()
			spin.min_value=float(field.get("min",0))
			spin.max_value=float(field.get("max",1000000))
			spin.step=float(field.get("step",1))
			spin.value=float(field.get("value",spin.min_value))
			control=spin
		elif field.get("type","")=="bool":
			var check := CheckBox.new()
			check.button_pressed=bool(field.get("value",false))
			control=check
		else:
			var input := LineEdit.new()
			input.text=str(field.get("value",""))
			input.secret=field.key=="password"
			control=input
		control.custom_minimum_size.y=38
		col.add_child(control)
		controls[field.key]=control
	button(col,tx("确认","Confirm"),func():
		var p: Dictionary={}
		for key in controls:
			var input=controls[key]
			if input is OptionButton:
				if input.item_count==0: notify(tx("没有可选目标","No available target"));return
				p[key]=input.get_item_metadata(input.selected)
			elif input is SpinBox: p[key]=input.value
			elif input is CheckBox: p[key]=input.button_pressed
			else: p[key]=input.text
		form_window.hide()
		submit.call(p))
	form_window.popup_centered()

func confirm_order(title: String,callback: Callable) -> void:
	show_form(title,[],func(_p):callback.call())

func shortage_dialog(params: Dictionary,shortage: Dictionary) -> void:
	show_form(tx("资源不足：补齐方式","Resources needed: choose supply"),[{"key":"shortageMode","label":tx("方式","Method"),"options":[{"id":"supply","label":tx("从其他城池调拨（工人、运费、等待到货）","Intercity transfer (crew, fees and travel)")},{"id":"market","label":tx("官方市场购买（需资金与库存）","Buy from official market (funds and stock required)")}]}],func(p):var retry=params.duplicate(true);retry.shortageMode=p.shortageMode;send("action",retry))
	notify(tx("缺货成本：","Required resources: ")+JSON.stringify(shortage.get("cost",{})))

func render_admin(data: Dictionary) -> void:
	open_page("admin")
	page_body(tx("ROOT 世界管理","ROOT world administration"))
	button(content,tx("暂停 / 恢复世界","Pause / resume"),func():send("admin",{"op":"pause","value":not state.paused}))
	button(content,tx("官方市场补货","Restock official market"),func():send("admin",{"op":"refreshShop"}))
	button(content,tx("发放资源","Grant resources"),func():show_form(tx("发放资源","Grant resources"),[{"key":"cityId","label":tx("城池","City"),"options":city_options(false)},{"key":"resource","label":tx("物资","Resource"),"options":resource_options(true)},amount_field(100)],func(p):p.op="grant";send("admin",p)))
	for user in data.get("users",[]):
		var row := HBoxContainer.new()
		content.add_child(row)
		text(row,user.username+" / "+user.role)
		button(row,tx("修改账号","Edit account"),func():show_form(tx("账号编辑","Edit account"),[{"key":"username","label":tx("用户名","Username"),"value":user.username},{"key":"password","label":tx("新密码（留空不修改）","New password (blank keeps current)"),"value":""}],func(p):
			p.op="account"
			p.userId=user.id
			if p.password=="":p.erase("password")
			send("admin",p)))
		if user.role!="root": button(row,tx("解封","Unban") if user.banned else tx("封禁","Ban"),func():send("admin",{"op":"ban","userId":user.id,"value":not user.banned}))
	text(content,tx("世界参数","World parameters"),22,ACCENT)
	for field in data.get("settingFields",[]):
		button(content,str(field.path)+" = "+str(field.value),func():show_form(str(field.path),[{"key":"value","label":str(field.path),"type":"number","min":field.min,"max":field.max,"step":field.step,"value":field.value}],func(p):send("admin",{"op":"settings","values":{field.path:p.value}})))
	button(content,tx("重置世界（保留账号）","Reset world (keep accounts)"),func():show_form(tx("输入 重置世界 确认","Type 重置世界 to confirm"),[{"key":"confirm","label":tx("确认文本","Confirmation"),"value":""}],func(p):p.op="reset";send("admin",p)))

func tile_editor() -> void:
	var tile := tile_info(chosen)
	if tile.is_empty():return
	var city_list: Array=[{"id":"","label":tx("无主","Unclaimed")}]
	city_list.append_array(city_options(false))
	var terrains: Array=[]
	for key in state.settings.terrains: terrains.append({"id":key,"label":label_name(state.settings.terrains[key].name)})
	var buildings: Array=[{"id":"","label":tx("无建筑","No building")}]
	for key in state.settings.buildings: buildings.append({"id":key,"label":label_name(state.settings.buildings[key].name)})
	var existing: Dictionary={}
	for c in state.cities:
		for b in c.buildings:
			if int(b.x)==chosen.x and int(b.y)==chosen.y:existing=b
	var deposits: Array=[{"id":"","label":tx("无矿藏","No deposit")}]
	for key in ["iron","copper","gold","silver","rare","coal","oil"]:deposits.append({"id":key,"label":resource_name(key)})
	show_form(tx("ROOT 地块与设施","ROOT tile & facility"),[{"key":"ownerCityId","label":tx("归属","City"),"options":city_list,"value":state.claims.get("%d,%d" % [chosen.x,chosen.y],"")},{"key":"terrain","label":tx("地形","Terrain"),"options":terrains,"value":tile.terrain},{"key":"deposit","label":tx("矿藏","Deposit"),"options":deposits,"value":tile.get("deposit","")},{"key":"buildingType","label":tx("设施","Facility"),"options":buildings,"value":existing.get("type","")},{"key":"level","label":tx("等级","Level"),"type":"number","min":1,"max":state.settings.rules.maxBuildingLevel,"value":existing.get("level",1)},{"key":"rail","label":tx("铁路","Railway"),"type":"bool","value":state.rails.has("%d,%d" % [chosen.x,chosen.y])},{"key":"attributes","label":tx("单体属性 JSON：workers/power/input/output 等","Instance JSON: workers/power/input/output etc."),"value":JSON.stringify(existing.get("overrides",{}))}],func(p):
		p.x=chosen.x;p.y=chosen.y;p.op="tile"
		p.overrides=JSON.parse_string(p.attributes)
		p.erase("attributes")
		if not p.overrides is Dictionary:notify(tx("属性 JSON 无效","Invalid attributes JSON"));return
		if p.deposit=="":p.deposit=null
		send("admin",p))

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:return
	if event.keycode==KEY_ESCAPE:
		if is_instance_valid(form_window) and form_window.visible:form_window.hide()
		elif is_instance_valid(screen) and screen.visible:screen.hide()
		else:build_type="";map.build_mode="";map.queue_redraw()
	elif event.keycode==KEY_F11:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if DisplayServer.window_get_mode()==DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN)
	elif not state.is_empty() and not get_viewport().gui_get_focus_owner() is LineEdit:
		if event.keycode==KEY_B:build_menu()
		elif event.keycode==KEY_TAB:open_page("inventory")
