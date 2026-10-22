extends SceneTree
var app: Control
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var deadline := create_timer(35)
	deadline.timeout.connect(func():printerr("Native integration timed out");quit(1))
	app=load("res://scenes/main.tscn").instantiate()
	root.add_child(app)
	await process_frame
	app.login_fields.address.text=OS.get_environment("SQUARELANDS_TEST_ADDRESS")
	app.login_fields.username.text="root"
	app.login_fields.password.text="native-smoke-password"
	app.authenticate(false)
	while app.state.is_empty():await process_frame
	assert(app.net.connected)
	assert(app.state.world.tiles.size()>0)
	var tile: Dictionary={}
	for t in app.state.world.tiles:
		if t.terrain=="plain" and t.x>6 and t.y>6:tile=t;break
	app.act("found",{"x":tile.x,"y":tile.y,"name":"明湾 / Brightwater"})
	while app.current().is_empty():await process_frame
	assert(app.current().name=="明湾 / Brightwater")
	for lang in ["zh","en"]:
		app.language=lang
		app.build_game_ui()
		app.render_hud()
		app.chosen=Vector2i(tile.x,tile.y)
		app.render_inspector()
		for page in ["inventory","market","logistics","alliance","messages","settings","guide","build"]:
			app.open_page(page)
			await process_frame
		app.show_form("QA",[{"key":"n","type":"number","value":4},{"key":"s","value":"hello"},{"key":"b","type":"bool"},{"key":"o","options":[{"id":"a","label":"A"}]}],func(_p):pass)
		await process_frame
		app.form_window.hide()
	for facility in [["station",1,0],["airport",-1,0],["warehouse",0,1],["generator",0,-1],["farm",1,1]]:
		app.send("admin",{"op":"tile","x":tile.x+facility[1],"y":tile.y+facility[2],"ownerCityId":app.current_id,"terrain":"plain","buildingType":facility[0],"level":1,"rail":facility[0]=="station"})
	while not app.pending.is_empty():await process_frame
	app.act("allianceCreate",{"name":"Brightwater Union"})
	while app.state.alliances.is_empty():await process_frame
	app.open_page("alliance")
	await process_frame
	app.send("adminState")
	for i in range(30):await process_frame
	app.tile_editor()
	await process_frame
	app.form_window.hide()
	app.screen.hide()
	app.language="zh"
	app.build_game_ui()
	app.render_hud()
	app.render_inspector()
	app.map.center_on(Vector2(tile.x,tile.y))
	await process_frame
	if is_instance_valid(app.toast_label):app.toast_label.hide()
	if DisplayServer.get_name()!="headless":
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("/private/tmp/squarelands-godot-native.png")
	print("NATIVE_TCP_SMOKE_PASS: login, pushed state, city founding, bilingual screens, alliance, root editor")
	app.net.close()
	quit(0)
